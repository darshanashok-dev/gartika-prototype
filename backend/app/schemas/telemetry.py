"""
Telemetry Pydantic Data Schemas for Gartika Urban Intelligence.

Defines validation and serialization models for GPS location & IMU accelerometer readings.
"""

from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class TelemetryCreate(BaseModel):
    """
    Schema for incoming vehicle telemetry pings from edge mobile units.
    """
    bus_id: str
    latitude: float
    longitude: float
    accuracy: Optional[float] = 5.0
    speed: Optional[float] = 0.0
    ax: Optional[float] = 0.0
    ay: Optional[float] = 0.0
    az: Optional[float] = 9.81
    gx: Optional[float] = 0.0
    gy: Optional[float] = 0.0
    gz: Optional[float] = 0.0
    timestamp: Optional[datetime] = None

class TelemetryResponse(TelemetryCreate):
    """
    Schema for serialized telemetry database responses.
    """
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
