"""
Urban Defect & AI Event Database Model for Gartika Urban Intelligence.

Stores geotagged AI detections including road potholes, surface cracks,
waterlogging, and traffic density counts with confidence scores and evidence paths.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text, Index
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    """
    Return current timezone-aware UTC datetime.
    
    Returns:
        datetime: Current UTC timestamp.
    """
    return datetime.now(timezone.utc)

class Event(Base):
    """
    SQLAlchemy model representing an urban AI detection event.
    
    Attributes:
        id: Auto-incrementing primary key.
        event_id: Unique event code (e.g. 'EVT-POTH-A1B2C').
        bus_id: Identifier of the bus unit that sensed this defect.
        event_type: Category ('POTHOLE', 'ROAD_DEFECT', 'VEHICLE_COUNT', 'WATERLOGGING').
        confidence: AI model confidence score (0.00 to 1.00).
        latitude: GPS latitude coordinate of the event.
        longitude: GPS longitude coordinate of the event.
        timestamp: Time of observation in UTC.
        severity: Defect urgency ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').
        evidence_path: Relative URL path to annotated JPEG frame snapshot.
        status: Lifecycle status ('NEW', 'IN_REVIEW', 'WORK_ORDER_CREATED', 'RESOLVED').
        vehicle_class: Dominant vehicle class if traffic count event.
        count: Numerical count of vehicles if traffic event.
        vibration_level: IMU shock intensity ('LOW', 'MEDIUM', 'HIGH').
        location_name: Human readable landmark or address.
        extra_data: Optional JSON/text metadata payload.
    """
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(50), unique=True, index=True, nullable=False)
    bus_id = Column(String(50), index=True, nullable=False)
    event_type = Column(String(50), index=True, nullable=False) # POTHOLE, ROAD_DEFECT, VEHICLE_COUNT, WATERLOGGING, CRACK
    confidence = Column(Float, nullable=False)
    latitude = Column(Float, index=True, nullable=True)
    longitude = Column(Float, index=True, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)
    severity = Column(String(20), default="MEDIUM", index=True) # LOW, MEDIUM, HIGH, CRITICAL
    evidence_path = Column(String(255), nullable=True)
    status = Column(String(30), default="NEW", index=True) # NEW, IN_REVIEW, WORK_ORDER_CREATED, RESOLVED
    vehicle_class = Column(String(50), nullable=True)
    count = Column(Integer, nullable=True)
    vibration_level = Column(String(20), nullable=True) # LOW, MEDIUM, HIGH
    location_name = Column(String(150), nullable=True)
    extra_data = Column(Text, nullable=True)
