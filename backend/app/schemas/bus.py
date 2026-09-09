"""
Bus Pydantic Data Schemas for Gartika Urban Intelligence.

Defines request validation and response serialization schemas for bus sensing units.
"""

from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class BusBase(BaseModel):
    """
    Base properties shared across Bus create, update, and read models.
    """
    bus_id: str
    name: Optional[str] = "Live Mobile Unit"
    status: Optional[str] = "ONLINE"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    speed: Optional[float] = 0.0
    route_name: Optional[str] = "Live Real-Time Patrol"
    source_type: Optional[str] = "MOBILE_LIVE"

class BusCreate(BusBase):
    """
    Schema for registering a new Bus sensing unit.
    """
    pass

class BusUpdate(BaseModel):
    """
    Schema for partially updating an existing Bus unit's state.
    """
    name: Optional[str] = None
    status: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    speed: Optional[float] = None
    route_name: Optional[str] = None
    source_type: Optional[str] = None

class BusResponse(BusBase):
    """
    Schema for serializing a Bus database entity to JSON response.
    """
    id: int
    last_seen: datetime
    model_config = ConfigDict(from_attributes=True)
