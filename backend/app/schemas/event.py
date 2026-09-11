"""
Event Pydantic Data Schemas for Gartika Urban Intelligence.

Defines validation and serialization models for road defect and traffic events.
"""

from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class EventBase(BaseModel):
    """
    Base properties shared across Event schemas.
    """
    event_id: Optional[str] = None
    bus_id: str
    event_type: str  # POTHOLE, ROAD_DEFECT, VEHICLE_COUNT, WATERLOGGING, CRACK, SPEED_BREAKER, ROAD_ANOMALY
    confidence: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timestamp: Optional[datetime] = None
    severity: Optional[str] = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    evidence_path: Optional[str] = None
    status: Optional[str] = "NEW"
    vehicle_class: Optional[str] = None
    count: Optional[int] = None
    vibration_level: Optional[str] = None
    location_name: Optional[str] = None
    defect_id: Optional[str] = None
    sequence_number: Optional[int] = None
    extra_data: Optional[str] = None


class EventCreate(EventBase):
    """
    Schema for ingesting a new AI detection event.
    """
    pass

class EventUpdate(BaseModel):
    """
    Schema for updating an existing event (e.g. changing status to IN_REVIEW or RESOLVED).
    """
    status: Optional[str] = None
    severity: Optional[str] = None
    location_name: Optional[str] = None

class EventResponse(EventBase):
    """
    Schema for serializing an Event database entity into an API response.
    """
    id: int
    event_id: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
