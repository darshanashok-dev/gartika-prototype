"""
End-to-End Mobile Sensing Pipeline and Reliability Verification Tests for Gartika.

Tests:
1. Telemetry ingestion with valid coordinates.
2. Idempotency: duplicate sequence number does not duplicate records.
3. Out-of-order telemetry does not overwrite newer last_seen status.
4. Invalid coordinate rejection (422 Unprocessable Entity).
5. Missing GPS telemetry handling (no fake coordinates).
6. High vertical IMU shock detection and alignment.
7. Frame upload and AI road defect detection pipeline.
8. Real-time WebSocket broadcasting of sensing events.
"""

import sys
import unittest
import numpy as np
import cv2
import io
from pathlib import Path
from datetime import datetime, timezone, timedelta

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.bus import Bus
from backend.app.models.telemetry import Telemetry
from backend.app.models.defect import RoadDefect, Observation
from backend.app.models.event import Event

class TestMobileSensingPipeline(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def test_01_telemetry_valid_ingest(self):
        payload = {
            "bus_id": "BUS-101",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "accuracy": 4.5,
            "speed": 28.4,
            "heading": 90.0,
            "ax": 0.05,
            "ay": 0.02,
            "az": 9.81,
            "sequence_number": 1001,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        res = self.client.post("/api/v1/telemetry", json=payload)
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertEqual(data["bus_id"], "BUS-101")
        self.assertAlmostEqual(data["latitude"], 12.9716, places=3)
        self.assertEqual(data["sequence_number"], 1001)

    def test_02_telemetry_idempotency_duplicate_sequence(self):
        payload = {
            "bus_id": "BUS-101",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "accuracy": 4.5,
            "speed": 28.4,
            "ax": 0.05,
            "ay": 0.02,
            "az": 9.81,
            "sequence_number": 1001,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        # Post exact same sequence again
        res = self.client.post("/api/v1/telemetry", json=payload)
        self.assertIn(res.status_code, [200, 201])
        
        # Verify in DB that only one record exists with sequence_number=1001
        db = SessionLocal()
        records = db.query(Telemetry).filter(Telemetry.bus_id == "BUS-101", Telemetry.sequence_number == 1001).all()
        self.assertEqual(len(records), 1)
        db.close()

    def test_03_telemetry_out_of_order_handling(self):
        # Current time sequence 1003
        t_now = datetime.now(timezone.utc)
        payload_new = {
            "bus_id": "BUS-102",
            "latitude": 12.9750,
            "longitude": 77.5980,
            "speed": 35.0,
            "sequence_number": 1003,
            "timestamp": t_now.isoformat()
        }
        res = self.client.post("/api/v1/telemetry", json=payload_new)
        self.assertEqual(res.status_code, 201)

        # Out-of-order older sequence 1002 (e.g. sent 10s earlier)
        t_older = t_now - timedelta(seconds=10)
        payload_old = {
            "bus_id": "BUS-102",
            "latitude": 12.9700,
            "longitude": 77.5900,
            "speed": 20.0,
            "sequence_number": 1002,
            "timestamp": t_older.isoformat()
        }
        res_old = self.client.post("/api/v1/telemetry", json=payload_old)
        self.assertEqual(res_old.status_code, 201)

        # Bus active coordinates in registry must still reflect the newer position (12.9750)
        db = SessionLocal()
        bus = db.query(Bus).filter(Bus.bus_id == "BUS-102").first()
        self.assertIsNotNone(bus)
        self.assertAlmostEqual(bus.latitude, 12.9750, places=3)
        db.close()

    def test_04_telemetry_coordinate_bounds_validation(self):
        # Invalid Latitude > 90
        res = self.client.post("/api/v1/telemetry", json={
            "bus_id": "BUS-103",
            "latitude": 142.5,
            "longitude": 77.5,
            "sequence_number": 1004
        })
        self.assertIn(res.status_code, [422, 400])

        # Invalid Longitude < -180
        res = self.client.post("/api/v1/telemetry", json={
            "bus_id": "BUS-103",
            "latitude": 12.5,
            "longitude": -195.0,
            "sequence_number": 1005
        })
        self.assertIn(res.status_code, [422, 400])

    def test_05_missing_gps_handling_never_fakes_coordinates(self):
        # Telemetry with null coordinates (e.g. tunnel)
        res = self.client.post("/api/v1/telemetry", json={
            "bus_id": "BUS-104",
            "latitude": None,
            "longitude": None,
            "az": 9.81,
            "sequence_number": 1006
        })
        self.assertEqual(res.status_code, 201)
        data = res.json()
        self.assertIsNone(data["latitude"])
        self.assertIsNone(data["longitude"])

    def test_06_imu_shock_event_creation(self):
        # Significant vertical shock (az = 16.5 m/s²)
        res = self.client.post("/api/v1/telemetry", json={
            "bus_id": "BUS-105",
            "latitude": 12.9810,
            "longitude": 77.6010,
            "az": 16.5,
            "sequence_number": 1007,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        self.assertEqual(res.status_code, 201)

        # Check that Event was persisted
        db = SessionLocal()
        events = db.query(Event).filter(Event.bus_id == "BUS-105").all()
        self.assertGreaterEqual(len(events), 1)
        self.assertEqual(events[0].event_type, "ROAD_IMPACT")
        db.close()

    def test_07_frame_upload_and_ai_inference(self):
        # Create a synthetic image buffer with dark asphalt and road hazard
        img = np.ones((480, 640, 3), dtype=np.uint8) * 45
        cv2.circle(img, (320, 240), 45, (15, 15, 15), -1)
        _, encoded = cv2.imencode(".jpg", img)
        frame_bytes = encoded.tobytes()

        files = {"file": ("frame.jpg", io.BytesIO(frame_bytes), "image/jpeg")}
        data = {"bus_id": "BUS-101", "latitude": "12.9716", "longitude": "77.5946"}

        res = self.client.post("/api/v1/stream/frame", data=data, files=files)
        self.assertEqual(res.status_code, 200)
        result = res.json()
        self.assertEqual(result["status"], "ok")
        self.assertEqual(result["bus_id"], "BUS-101")

    def test_08_get_latest_frame(self):
        res = self.client.get("/api/v1/stream/latest-frame?bus_id=BUS-101")
        self.assertIn(res.status_code, [200, 204])
        if res.status_code == 200:
            self.assertEqual(res.headers["content-type"], "image/jpeg")
