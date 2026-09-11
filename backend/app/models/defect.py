"""
Persistent Road Defect & Multi-Bus Observation Database Models.

Separates physical persistent road defects (RoadDefect) from transient sensing
observations (Observation) recorded by individual bus sensing units over time.
Supports multi-bus verification, spatial deduplication, and closed-loop repair validation.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Boolean, Index
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

class RoadDefect(Base):
    """
    SQLAlchemy model representing a persistent physical road defect entity.
    
    A single defect may aggregate dozens of observations from multiple buses
    over days or weeks, tracking lifecycle from initial unverified detection
    to municipal repair and closed-loop post-repair verification.
    """
    __tablename__ = "road_defects"

    id = Column(Integer, primary_key=True, index=True)
    defect_id = Column(String(50), unique=True, index=True, nullable=False)
    defect_type = Column(String(50), index=True, nullable=False)  # POTHOLE, CRACK, SPEED_BREAKER, MANHOLE, WATERLOGGING, ROAD_ANOMALY
    latitude = Column(Float, index=True, nullable=False)
    longitude = Column(Float, index=True, nullable=False)
    severity = Column(String(20), default="MEDIUM", index=True)  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(30), default="UNVERIFIED", index=True)  # UNVERIFIED, SUSPECTED, VERIFIED, HIGH_CONFIDENCE, WORK_ORDER_CREATED, ASSIGNED, IN_PROGRESS, REPAIRED, REPAIR_VERIFIED, REPAIR_FAILED, CLOSED
    
    first_seen = Column(DateTime, default=utc_now, index=True)
    last_seen = Column(DateTime, default=utc_now, index=True)
    observation_count = Column(Integer, default=1)
    unique_bus_count = Column(Integer, default=1)
    verifying_buses = Column(Text, default="[]")  # JSON-serialized list of bus IDs
    
    best_confidence = Column(Float, default=0.0)
    latest_evidence_path = Column(String(255), nullable=True)
    location_name = Column(String(150), nullable=True)
    
    # Closed-loop repair verification fields
    repair_status = Column(String(30), default="NONE", index=True)  # NONE, PENDING_REPAIR, REPAIRED, REPAIR_VERIFIED, REPAIR_FAILED
    repair_verified_at = Column(DateTime, nullable=True)
    repair_verified_by_bus_id = Column(String(50), nullable=True)
    work_order_id = Column(String(50), nullable=True, index=True)

class Observation(Base):
    """
    SQLAlchemy model representing a single sensor observation of a road defect.
    
    Contains exact spatial coordinates, camera snapshot evidence, IMU shock metrics,
    source metadata (YOLO vs OpenCV heuristic), and timestamp for a specific bus pass.
    """
    __tablename__ = "observations"

    id = Column(Integer, primary_key=True, index=True)
    observation_id = Column(String(50), unique=True, index=True, nullable=False)
    defect_id = Column(String(50), index=True, nullable=False)
    bus_id = Column(String(50), index=True, nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    speed = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)
    
    source = Column(String(30), default="sensor_fusion")  # yolo, opencv_heuristic, imu_shock, sensor_fusion
    visual_confidence = Column(Float, nullable=True)
    heuristic_score = Column(Float, nullable=True)
    imu_shock_magnitude = Column(Float, nullable=True)
    vibration_level = Column(String(20), default="NORMAL")
    evidence_path = Column(String(255), nullable=True)
    sequence_number = Column(Integer, nullable=True)
    
    # Repair verification metadata
    is_repair_check = Column(Boolean, default=False)
    repair_check_result = Column(String(30), nullable=True)  # CONFIRMED_REPAIRED, DEFECT_PERSISTS, INCONCLUSIVE
