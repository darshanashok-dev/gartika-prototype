from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class EventBase(BaseModel):
    event_id: Optional[str] = None
    bus_id: str
    event_type: str # POTHOLE, ROAD_DEFECT, VEHICLE_COUNT, WATERLOGGING, CRACK
    confidence: float
    latitude: float
    longitude: float
    timestamp: Optional[datetime] = None
    severity: Optional[str] = "MEDIUM" # LOW, MEDIUM, HIGH, CRITICAL
    evidence_path: Optional[str] = None
    status: Optional[str] = "NEW"
    vehicle_class: Optional[str] = None
    count: Optional[int] = None
    vibration_level: Optional[str] = None
    location_name: Optional[str] = None
    extra_data: Optional[str] = None

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    status: Optional[str] = None
    severity: Optional[str] = None
    location_name: Optional[str] = None

class EventResponse(EventBase):
    id: int
    event_id: str
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
