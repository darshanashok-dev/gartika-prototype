"""
Road Defect and Multi-Bus Observation Pydantic Schemas.

Defines request/response data contracts for persistent road defects,
temporal sensor observations, multi-bus verification, and repair tracking.
"""

from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from typing import Optional, List, Any

class ObservationBase(BaseModel):
    """Base fields for a sensor observation."""
    defect_id: Optional[str] = None
    bus_id: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    speed: Optional[float] = None
    heading: Optional[float] = None
    source: str = "sensor_fusion"  # yolo, opencv_heuristic, imu_shock, sensor_fusion
    visual_confidence: Optional[float] = None
    heuristic_score: Optional[float] = None
    imu_shock_magnitude: Optional[float] = None
    vibration_level: Optional[str] = "NORMAL"
    evidence_path: Optional[str] = None
    sequence_number: Optional[int] = None
    timestamp: Optional[datetime] = None

class ObservationCreate(ObservationBase):
    """Schema for recording a new defect observation."""
    pass

class ObservationResponse(ObservationBase):
    """Schema for returning observation details."""
    id: int
    observation_id: str
    timestamp: datetime
    is_repair_check: bool = False
    repair_check_result: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

class RoadDefectBase(BaseModel):
    """Base fields for persistent road defects."""
    defect_id: Optional[str] = None
    defect_type: str = "POTHOLE"  # POTHOLE, CRACK, SPEED_BREAKER, MANHOLE, WATERLOGGING, ROAD_ANOMALY
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    severity: str = "MEDIUM"  # LOW, MEDIUM, HIGH, CRITICAL
    status: str = "UNVERIFIED"  # UNVERIFIED, SUSPECTED, VERIFIED, HIGH_CONFIDENCE, WORK_ORDER_CREATED, ASSIGNED, IN_PROGRESS, REPAIRED, REPAIR_VERIFIED, REPAIR_FAILED, CLOSED
    best_confidence: float = 0.0
    latest_evidence_path: Optional[str] = None
    location_name: Optional[str] = None
    repair_status: str = "NONE"
    work_order_id: Optional[str] = None

class RoadDefectCreate(RoadDefectBase):
    """Schema for creating a road defect."""
    bus_id: str
    observation: Optional[ObservationCreate] = None

class RoadDefectUpdate(BaseModel):
    """Schema for updating road defect status, severity, or repair verification."""
    severity: Optional[str] = None
    status: Optional[str] = None
    location_name: Optional[str] = None
    repair_status: Optional[str] = None
    work_order_id: Optional[str] = None

class RoadDefectResponse(RoadDefectBase):
    """Schema for returning road defect entity."""
    id: int
    defect_id: str
    first_seen: datetime
    last_seen: datetime
    observation_count: int
    unique_bus_count: int
    verifying_buses: Any = []
    repair_verified_at: Optional[datetime] = None
    repair_verified_by_bus_id: Optional[str] = None
    observations: Optional[List[ObservationResponse]] = None
    model_config = ConfigDict(from_attributes=True)
