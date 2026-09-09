from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    bus_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), index=True, nullable=False) # POTHOLE, ROAD_DEFECT, VEHICLE_COUNT, WATERLOGGING, CRACK
    confidence = Column(Float, nullable=False)
    latitude = Column(Float, index=True, nullable=False)
    longitude = Column(Float, index=True, nullable=False)
    timestamp = Column(DateTime, default=utc_now, index=True)
    severity = Column(String(20), default="MEDIUM", index=True) # LOW, MEDIUM, HIGH, CRITICAL
    evidence_path = Column(String(255), nullable=True)
    status = Column(String(30), default="NEW", index=True) # NEW, IN_REVIEW, WORK_ORDER_CREATED, RESOLVED
    vehicle_class = Column(String(50), nullable=True)
    count = Column(Integer, nullable=True)
    vibration_level = Column(String(20), nullable=True) # LOW, MEDIUM, HIGH
    location_name = Column(String(150), nullable=True)
    extra_data = Column(Text, nullable=True)

