"""
End-to-End System Integration Test Suite for Gartika Urban Intelligence.

Validates health checks, aggregation stats, event ingestion, maintenance work order
lifecycles, sensor shock detection, and static web app route availability.
"""

import sys
import unittest
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import engine, Base, SessionLocal
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder

class TestGartikaE2E(unittest.TestCase):
    """
    End-to-end unit test case suite.
    """
    @classmethod
    def setUpClass(cls):
        """Initialize database schema tables and instantiate FastAPI TestClient."""
        Base.metadata.create_all(bind=engine)
        cls.client = TestClient(app)

    def test_01_health(self):
        """Test /health endpoint to verify API and DB status."""
        resp = self.client.get("/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["backend_status"], "ONLINE")
        print("✓ Health check endpoint passed")

    def test_02_stats(self):
        """Test /stats endpoint for dashboard aggregations."""
        resp = self.client.get("/stats")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("bandwidth_comparison", data)
        print("✓ Stats endpoint passed")

    def test_03_create_and_get_event(self):
        """Test creating an AI detection event and creating a maintenance work order from it."""
        payload = {
            "bus_id": "BUS-101",
            "event_type": "POTHOLE",
            "confidence": 0.93,
            "latitude": 12.9716,
            "longitude": 77.5946,
            "severity": "HIGH",
            "location_name": "MG Road Test Location"
        }
        resp = self.client.post("/events", json=payload)
        self.assertEqual(resp.status_code, 201)
        event_data = resp.json()
        self.assertIn("event_id", event_data)
        event_id = event_data["event_id"]
        
        # Retrieve event
        get_resp = self.client.get(f"/events/{event_id}")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["event_id"], event_id)
        print(f"✓ Event creation & retrieval passed: {event_id}")

        # Create Work Order from this event
        wo_payload = {
            "event_id": event_id,
            "title": "Repair Pothole on MG Road",
            "priority": "HIGH",
            "assigned_to": "BBMP Ward 112 Team"
        }
        wo_resp = self.client.post("/work-orders", json=wo_payload)
        self.assertEqual(wo_resp.status_code, 201)
        wo_data = wo_resp.json()
        self.assertIn("work_order_id", wo_data)
        print(f"✓ Work order creation passed: {wo_data['work_order_id']}")

    def test_04_telemetry_ingestion(self):
        """Test /telemetry endpoint for GPS and accelerometer sensor ingestion."""
        payload = {
            "bus_id": "BUS-101",
            "latitude": 12.9755,
            "longitude": 77.6155,
            "accuracy": 3.0,
            "speed": 34.0,
            "ax": 0.1,
            "ay": 0.2,
            "az": 14.5 # bump shock
        }
        resp = self.client.post("/telemetry", json=payload)
        self.assertEqual(resp.status_code, 201)
        print("✓ Telemetry ingestion passed")

    def test_05_static_routes(self):
        """Test static mounting of Mobile UI and Dashboard HTML pages."""
        resp = self.client.get("/mobile/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("GARTIKA EDGE UNIT", resp.text)
        print("✓ Mobile web app static route verified")

        resp2 = self.client.get("/")
        self.assertEqual(resp2.status_code, 200)
        self.assertIn("GARTIKA", resp2.text)
        print("✓ GIS Dashboard static route verified")

if __name__ == "__main__":
    unittest.main()
