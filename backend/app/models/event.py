from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime, timezone
from backend.app.database import Base

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    bus_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), nullable=False) # POTHOLE, ROAD_DEFECT, VEHICLE_COUNT, WATERLOGGING, CRACK
    confidence = Column(Float, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    severity = Column(String(20), default="MEDIUM") # LOW, MEDIUM, HIGH, CRITICAL
    evidence_path = Column(String(255), nullable=True)
    status = Column(String(30), default="NEW") # NEW, REVIEWED, WORK_ORDER_CREATED, RESOLVED
    vehicle_class = Column(String(50), nullable=True)
    count = Column(Integer, nullable=True)
    vibration_level = Column(String(20), nullable=True) # LOW, MEDIUM, HIGH
    location_name = Column(String(150), nullable=True)
    extra_data = Column(Text, nullable=True)
