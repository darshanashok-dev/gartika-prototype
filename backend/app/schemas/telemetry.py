from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class TelemetryCreate(BaseModel):
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
    id: int
    timestamp: datetime
    model_config = ConfigDict(from_attributes=True)
