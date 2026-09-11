"""
Unit & Integration Tests for Gartika Sensor Fusion, Multi-Bus Verification, and Closed-Loop Repair.
"""

import time
import pytest
import numpy as np
import cv2
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.database import SessionLocal, Base, engine
from backend.app.models.defect import RoadDefect, Observation
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder
from backend.app.models.bus import Bus
from backend.app.fusion.engine import fusion_engine
from backend.app.fusion.buffer import buffer_manager
from backend.app.fusion.privacy import privacy_filter
from backend.app.fusion.models import ImuReading, GpsReading

client = TestClient(app)

@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    # Clean tables
    db.query(Observation).delete()
    db.query(RoadDefect).delete()
    db.query(WorkOrder).delete()
    db.query(Event).delete()
    db.query(Bus).delete()
    db.commit()
    yield db
    db.close()

def test_sensor_buffer_isolation():
    """Test that per-bus buffers remain completely isolated."""
    buf_a = buffer_manager.get_buffer("BUS-A")
    buf_b = buffer_manager.get_buffer("BUS-B")

    now = time.time()
    buf_a.add_imu(ImuReading(timestamp=now, ax=0.1, ay=0.2, az=14.5), sequence_number=1)
    buf_b.add_imu(ImuReading(timestamp=now, ax=0.0, ay=0.0, az=9.81), sequence_number=1)

    assert len(buf_a.imu_buffer) == 1
    assert len(buf_b.imu_buffer) == 1
    assert buf_a.latest_imu.az == 14.5
    assert buf_b.latest_imu.az == 9.81
    assert buf_a.latest_imu.az != buf_b.latest_imu.az

def test_privacy_filter_blurring():
    """Test that privacy filter anonymizes detected faces/plates."""
    test_img = np.ones((100, 100, 3), dtype=np.uint8) * 128
    filtered = privacy_filter.anonymize_frame(test_img)
    assert filtered is not None
    assert filtered.shape == test_img.shape

def test_sensor_fusion_multi_bus_elevation(db_session):
    """Test that a second bus passing the same spot upgrades defect to VERIFIED."""
    # Register buses
    b1 = Bus(bus_id="BUS-01", name="Bus 1", status="ONLINE", latitude=12.9716, longitude=77.5946, speed=30.0, route_name="Route 1", source_type="TEST")
    b2 = Bus(bus_id="BUS-02", name="Bus 2", status="ONLINE", latitude=12.9716, longitude=77.5946, speed=28.0, route_name="Route 2", source_type="TEST")
    db_session.add_all([b1, b2])
    db_session.commit()

    # BUS-01 detects pothole
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    _, buf = cv2.imencode('.jpg', frame)
    frame_bytes = buf.tobytes()

    fusion_engine.process_imu_telemetry(
        bus_id="BUS-01", ax=0.2, ay=0.1, az=15.0, lat=12.97160, lon=77.59460, speed=30.0, db=db_session
    )
    fusion_engine.process_frame(
        bus_id="BUS-01", frame_bytes=frame_bytes,
        visual_defects=[{"event_type": "POTHOLE", "confidence": 0.85, "bbox": [100, 100, 200, 200], "source": "yolo"}],
        db=db_session, gps_override=(12.97160, 77.59460)
    )

    defect = db_session.query(RoadDefect).first()
    assert defect is not None
    assert defect.status in ["SUSPECTED", "UNVERIFIED"]
    assert defect.unique_bus_count == 1

    # BUS-02 corroborates at nearby coordinate (< 15 meters)
    fusion_engine.process_imu_telemetry(
        bus_id="BUS-02", ax=0.1, ay=0.2, az=14.8, lat=12.97163, lon=77.59462, speed=28.0, db=db_session
    )
    fusion_engine.process_frame(
        bus_id="BUS-02", frame_bytes=frame_bytes,
        visual_defects=[{"event_type": "POTHOLE", "confidence": 0.90, "bbox": [105, 102, 205, 202], "source": "yolo"}],
        db=db_session, gps_override=(12.97163, 77.59462)
    )

    db_session.refresh(defect)
    assert defect.status == "VERIFIED"
    assert defect.unique_bus_count == 2
    assert "BUS-01" in defect.verifying_buses
    assert "BUS-02" in defect.verifying_buses

def test_closed_loop_repair_verification(db_session):
    """Test that a repaired defect is verified and closed when bus detects smooth road."""
    # Create repaired defect
    defect = RoadDefect(
        defect_id="DEF-TEST-999",
        defect_type="POTHOLE",
        latitude=12.97200,
        longitude=77.59500,
        severity="HIGH",
        status="REPAIRED",
        repair_status="PENDING_VERIFICATION",
        verifying_buses='["BUS-01"]',
        unique_bus_count=1,
        observation_count=1
    )
    db_session.add(defect)
    db_session.commit()

    smooth_imu = ImuReading(timestamp=time.time(), ax=0.0, ay=0.0, az=9.81)

    # 1st clean pass -> records observation, stays PENDING_VERIFICATION
    fusion_engine.check_repair_verification(
        bus_id="BUS-01",
        lat=12.97202,
        lon=77.59501,
        has_visual_defect=False,
        aligned_imu=smooth_imu,
        db=db_session
    )
    db_session.refresh(defect)
    assert defect.repair_status == "PENDING_VERIFICATION"

    # 2nd clean pass -> satisfies clean_repair_threshold (2), closes defect!
    fusion_engine.check_repair_verification(
        bus_id="BUS-02",
        lat=12.97201,
        lon=77.59502,
        has_visual_defect=False,
        aligned_imu=smooth_imu,
        db=db_session
    )
    db_session.refresh(defect)
    assert defect.status == "CLOSED"
    assert defect.repair_status == "REPAIR_VERIFIED"
    assert defect.repair_verified_by_bus_id == "BUS-02"


def test_closed_loop_repair_failure(db_session):
    """Test that a defect marked REPAIRED is flagged REPAIR_FAILED if shock/visual persists."""
    defect = RoadDefect(
        defect_id="DEF-TEST-888",
        defect_type="POTHOLE",
        latitude=12.97300,
        longitude=77.59600,
        severity="HIGH",
        status="REPAIRED",
        repair_status="PENDING_VERIFICATION",
        verifying_buses='["BUS-01"]',
        unique_bus_count=1,
        observation_count=1
    )
    db_session.add(defect)
    db_session.commit()

    bumpy_imu = ImuReading(timestamp=time.time(), ax=0.0, ay=0.0, az=18.0)
    fusion_engine.check_repair_verification(
        bus_id="BUS-02",
        lat=12.97301,
        lon=77.59602,
        has_visual_defect=True,
        aligned_imu=bumpy_imu,
        db=db_session
    )
    db_session.refresh(defect)
    assert defect.status == "REPAIR_FAILED"
    assert defect.repair_status == "REPAIR_FAILED"


def test_missing_gps_handling(db_session):
    """Test that missing GPS telemetry does NOT generate hardcoded fallback coordinates."""
    # Process IMU shock without coordinates
    fusion_engine.process_imu_telemetry(
        bus_id="BUS-NO-GPS",
        ax=0.0,
        ay=0.0,
        az=19.5,
        lat=None,
        lon=None,
        speed=15.0,
        heading=90.0,
        sequence_number=1,
        db=db_session
    )

    defect = db_session.query(RoadDefect).filter(RoadDefect.location_status == "UNKNOWN_LOCATION").first()
    assert defect is not None
    assert defect.latitude is None
    assert defect.longitude is None
    assert defect.location_status == "UNKNOWN_LOCATION"


def test_authentication_and_authorization():
    """Test token verification and role permissions."""
    from backend.app.auth import verify_api_token, UserRole

    # Valid mobile unit token
    mobile_user = verify_api_token("mobile-bus-token-secret")
    assert mobile_user is not None
    assert mobile_user.role == UserRole.MOBILE_UNIT

    # Valid admin token
    admin_user = verify_api_token("admin-super-token-secret")
    assert admin_user is not None
    assert admin_user.role == UserRole.ADMIN

    # Invalid token
    invalid_user = verify_api_token("completely-invalid-token")
    assert invalid_user is None


def test_api_v1_endpoints(db_session):
    """Test versioned /api/v1 defect endpoints."""
    # Health and Ready
    resp = client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "healthy"

    resp = client.get("/api/v1/ready")
    assert resp.status_code == 200
    assert resp.json()["ready"] is True

    # Defect list
    resp = client.get("/api/v1/defects")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
