"""
Gartika Failure-Proofing & Reliability Test Suite.

Ensures that the entire platform operates gracefully across partial hardware failures,
missing sensors, network disconnects, invalid payloads, and corrupted frames without crashing.
"""

import io
import time
import pytest
import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.main import app
from backend.app.database import Base, engine, SessionLocal
from backend.app.models.defect import RoadDefect, Observation
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.models.telemetry import Telemetry
from backend.app.models.work_order import WorkOrder
from backend.app.fusion.engine import fusion_engine
from backend.app.fusion.models import ImuReading
from ai.pothole_detector import PotholeDetector
from ai.tracker import IoUTracker

client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    session = SessionLocal()
    session.query(Observation).delete()
    session.query(RoadDefect).delete()
    session.query(WorkOrder).delete()
    session.query(Event).delete()
    session.query(Telemetry).delete()
    session.query(Bus).delete()
    session.commit()
    try:
        yield session
    finally:
        session.close()


# ==============================================================================
# 1. AI Model & Corrupted Frame Failure Resilience
# ==============================================================================

def test_ai_detector_corrupt_frame_handling():
    """Ensure PotholeDetector gracefully returns empty list for corrupt/empty frames."""
    detector = PotholeDetector()
    
    # Empty frame
    res_empty = detector.detect(np.array([]))
    assert res_empty == []
    
    # None frame
    res_none = detector.detect(None)
    assert res_none == []
    
    # Microscopic frame (less than ROI minimum)
    tiny_frame = np.zeros((10, 10, 3), dtype=np.uint8)
    res_tiny = detector.detect(tiny_frame)
    assert isinstance(res_tiny, list)


def test_ai_tracker_empty_detection_handling():
    """Ensure IoUTracker operates smoothly without exceptions on empty detections."""
    tracker = IoUTracker(iou_threshold=0.30)
    
    # Frame with no detections
    tracks = tracker.update([])
    assert tracks == []
    assert tracker.total_tracked_count == 0


def test_stream_corrupt_image_upload():
    """Uploading random corrupted bytes to /api/v1/stream/frame should return 400 without crashing."""
    corrupt_bytes = b"NOT_A_VALID_JPEG_IMAGE_DATA_12345"
    resp = client.post(
        "/api/v1/stream/frame",
        files={"file": ("corrupt.jpg", io.BytesIO(corrupt_bytes), "image/jpeg")},
        data={"bus_id": "BUS-FAIL-01"}
    )
    assert resp.status_code == 400
    assert "Invalid or unreadable image frame" in resp.json()["detail"]["message"]


# ==============================================================================
# 2. Sensor Failure Handling (Missing GPS, Missing IMU)
# ==============================================================================

def test_missing_gps_telemetry_handling(db_session):
    """Missing GPS telemetry must NOT fabricate coordinates and must set UNKNOWN_LOCATION."""
    payload = {
        "bus_id": "BUS-NO-GPS",
        "latitude": None,
        "longitude": None,
        "speed": 25.0,
        "heading": 0.0,
        "timestamp": time.time(),
        "ax": 0.0,
        "ay": 0.0,
        "az": 18.5,  # Trigger shock
        "sequence_number": 1
    }
    resp = client.post("/api/v1/telemetry", json=payload)
    assert resp.status_code == 201

    # Defect must be created with NULL coordinates and UNKNOWN_LOCATION
    defect = db_session.query(RoadDefect).filter(RoadDefect.location_status == "UNKNOWN_LOCATION").first()
    assert defect is not None
    assert defect.latitude is None
    assert defect.longitude is None


def test_invalid_gps_coordinates_rejected():
    """GPS coordinates outside [-90, +90] and [-180, +180] must be rejected."""
    payload = {
        "bus_id": "BUS-INVALID-GPS",
        "latitude": 999.0,
        "longitude": 888.0,
        "speed": 0.0,
        "heading": 0.0,
        "timestamp": time.time(),
        "ax": 0.0,
        "ay": 0.0,
        "az": 9.81,
        "sequence_number": 1
    }
    resp = client.post("/api/v1/telemetry", json=payload)
    assert resp.status_code == 422  # Pydantic validation rejection


# ==============================================================================
# 3. Closed-Loop Multi-Pass Repair Verification & Failure Injection
# ==============================================================================

def test_full_closed_loop_repair_lifecycle(db_session):
    """
    Test complete lifecycle:
    Defect detected -> Dispatched -> Contractor repairs -> 
    Pass 1 clean -> Pass 2 clean -> Verified & Closed.
    """
    # 1. Defect created
    defect = RoadDefect(
        defect_id="DEF-LIFECYCLE-01",
        defect_type="POTHOLE",
        latitude=12.97150,
        longitude=77.59450,
        severity="HIGH",
        status="REPAIR_PENDING",
        repair_status="PENDING_VERIFICATION",
        unique_bus_count=2,
        observation_count=3,
        verifying_buses='["BUS-01", "BUS-02"]'
    )
    db_session.add(defect)
    db_session.commit()

    smooth_imu = ImuReading(timestamp=time.time(), ax=0.0, ay=0.0, az=9.81)

    # Pass 1: Clean pass (1/2) -> Still pending verification
    fusion_engine.check_repair_verification(
        bus_id="BUS-01",
        lat=12.97152,
        lon=77.59451,
        has_visual_defect=False,
        aligned_imu=smooth_imu,
        db=db_session
    )
    db_session.refresh(defect)
    assert defect.repair_status == "PENDING_VERIFICATION"
    assert defect.status == "REPAIR_PENDING"

    # Pass 2: Clean pass (2/2) -> Satisfies clean_repair_threshold -> CLOSED!
    fusion_engine.check_repair_verification(
        bus_id="BUS-03",
        lat=12.97151,
        lon=77.59450,
        has_visual_defect=False,
        aligned_imu=smooth_imu,
        db=db_session
    )
    db_session.refresh(defect)
    assert defect.status == "CLOSED"
    assert defect.repair_status == "REPAIR_VERIFIED"
    assert defect.repair_verified_by_bus_id == "BUS-03"


def test_repair_verification_failure_injection(db_session):
    """When a repaired defect still produces high vibration shock, flag as REPAIR_FAILED."""
    defect = RoadDefect(
        defect_id="DEF-FAIL-REPAIR-02",
        defect_type="POTHOLE",
        latitude=12.97500,
        longitude=77.59800,
        severity="HIGH",
        status="REPAIR_PENDING",
        repair_status="PENDING_VERIFICATION",
        unique_bus_count=1,
        observation_count=1,
        verifying_buses='["BUS-01"]'
    )
    db_session.add(defect)
    db_session.commit()

    shock_imu = ImuReading(timestamp=time.time(), ax=0.0, ay=0.0, az=18.5)
    fusion_engine.check_repair_verification(
        bus_id="BUS-02",
        lat=12.97501,
        lon=77.59802,
        has_visual_defect=False,
        aligned_imu=shock_imu,
        db=db_session
    )
    db_session.refresh(defect)
    assert defect.status == "REPAIR_FAILED"
    assert defect.repair_status == "REPAIR_FAILED"


# ==============================================================================
# 4. System Health & Observability Readiness
# ==============================================================================

def test_system_health_and_readiness():
    """Health check must report detailed subsystem statuses."""
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert data["database"] == "CONNECTED"
    assert data["ai_engine_status"] == "ONLINE"
    assert "version" in data
