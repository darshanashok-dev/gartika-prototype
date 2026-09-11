"""
Telemetry Pydantic Data Schemas for Gartika Urban Intelligence.

Defines validation and serialization models for GPS location & IMU accelerometer readings.
"""

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime, timezone
from typing import Optional

class TelemetryCreate(BaseModel):
    """
    Schema for incoming vehicle telemetry pings from edge mobile units.
    """
    bus_id: str
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to +90)")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to +180)")
    accuracy: Optional[float] = 5.0
    speed: Optional[float] = 0.0
    heading: Optional[float] = None
    ax: Optional[float] = 0.0
    ay: Optional[float] = 0.0
    az: Optional[float] = 9.81
    gx: Optional[float] = 0.0
    gy: Optional[float] = 0.0
    gz: Optional[float] = 0.0
    sequence_number: Optional[int] = None
    timestamp: Optional[datetime] = None


class TelemetryResponse(TelemetryCreate):
    """
    Schema for serialized telemetry database responses.
    """
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
