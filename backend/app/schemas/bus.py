from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class BusBase(BaseModel):
    bus_id: str
    name: Optional[str] = "BMTC Urban Sense"
    status: Optional[str] = "ONLINE"
    latitude: Optional[float] = 12.9716
    longitude: Optional[float] = 77.5946
    speed: Optional[float] = 0.0
    route_name: Optional[str] = "Route 335E (Majestic - Whitefield)"
    source_type: Optional[str] = "DEMO_VIDEO"

class BusCreate(BusBase):
    pass

class BusUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    speed: Optional[float] = None
    route_name: Optional[str] = None
    source_type: Optional[str] = None

class BusResponse(BusBase):
    id: int
    last_seen: datetime
    model_config = ConfigDict(from_attributes=True)
