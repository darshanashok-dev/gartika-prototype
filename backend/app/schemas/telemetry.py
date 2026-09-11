"""
Telemetry Pydantic Data Schemas for Gartika Urban Intelligence.

Defines validation and serialization models for GPS location & IMU accelerometer readings.
"""

from pydantic import BaseModel, ConfigDict, Field, field_validator
from datetime import datetime, timezone
from typing import Optional, Union

class TelemetryCreate(BaseModel):
    """
    Schema for incoming vehicle telemetry pings from edge mobile units.
    """
    bus_id: str
    latitude: Optional[float] = Field(None, ge=-90.0, le=90.0, description="Latitude in decimal degrees (-90 to +90)")
    longitude: Optional[float] = Field(None, ge=-180.0, le=180.0, description="Longitude in decimal degrees (-180 to +180)")
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
    timestamp: Optional[Union[datetime, float, int, str]] = None

    @field_validator("timestamp", mode="before")
    @classmethod
    def parse_timestamp(cls, v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return datetime.fromtimestamp(v, tz=timezone.utc)
        if isinstance(v, str):
            try:
                # Handle standard ISO formats
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            except Exception:
                try:
                    return datetime.fromtimestamp(float(v), tz=timezone.utc)
                except Exception:
                    return None
        return v


class TelemetryResponse(BaseModel):
    """
    Schema for serialized telemetry database responses.
    """
    id: int
    bus_id: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
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
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
