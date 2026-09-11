"""
Data Models for Gartika Sensor Fusion & Multi-Modal Perception.

Defines strongly-typed dataclasses and Pydantic models for raw sensor snapshots,
visual defect candidates, IMU impact shocks, and fused event outcomes.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
import numpy as np

def current_utc() -> datetime:
    """Return current timezone-aware UTC datetime."""
    return datetime.now(timezone.utc)

@dataclass
class ImuReading:
    """Single 3-axis accelerometer and gyroscope reading with high-precision timestamp."""
    timestamp: float  # Unix timestamp in seconds
    ax: float = 0.0
    ay: float = 0.0
    az: float = 9.81
    gx: float = 0.0
    gy: float = 0.0
    gz: float = 0.0

    @property
    def vertical_shock(self) -> float:
        """Deviation from 1g standard gravity (9.81 m/s²)."""
        return abs(self.az - 9.81)

    @property
    def total_acceleration(self) -> float:
        """Total dynamic acceleration magnitude (excluding baseline gravity)."""
        return abs(self.ax) + abs(self.ay) + self.vertical_shock

@dataclass
class GpsReading:
    """GPS location fix with timestamp, speed, heading, and accuracy."""
    timestamp: float  # Unix timestamp in seconds
    latitude: float
    longitude: float
    accuracy: float = 5.0
    speed: float = 0.0
    heading: Optional[float] = None

    @property
    def is_valid(self) -> bool:
        """Validate latitude in [-90, 90] and longitude in [-180, 180] and non-zero."""
        if self.latitude is None or self.longitude is None:
            return False
        if not (-90.0 <= self.latitude <= 90.0 and -180.0 <= self.longitude <= 180.0):
            return False
        # Reject 0.0, 0.0 (null island / uninitialized GPS)
        if abs(self.latitude) < 1e-5 and abs(self.longitude) < 1e-5:
            return False
        return True

@dataclass
class FrameReading:
    """Camera frame captured from edge device with timestamp and raw/decoded data."""
    timestamp: float  # Unix timestamp in seconds
    frame_bytes: bytes
    image_bgr: Optional[np.ndarray] = None
    width: int = 640
    height: int = 480

@dataclass
class VisualCandidate:
    """Road defect or feature visually detected by neural network or CV heuristic."""
    defect_type: str  # POTHOLE, CRACK, SPEED_BREAKER, MANHOLE, WATERLOGGING, ROAD_PATCH
    bbox: List[int]   # [x1, y1, x2, y2]
    source: str       # "yolo" | "opencv_heuristic"
    confidence: float # Final visual score
    model_confidence: Optional[float] = None  # Trained neural network probability (0.00-1.00)
    heuristic_score: Optional[float] = None   # Computer vision contrast/contour heuristic score (0.00-1.00)
    area: int = 0
    aspect_ratio: float = 1.0

@dataclass
class ImpactCandidate:
    """Mechanical impact shock detected on IMU accelerometer."""
    timestamp: float
    shock_magnitude: float  # Deviation from baseline gravity
    peak_az: float
    severity: str  # LOW, MEDIUM, HIGH, CRITICAL
    imu_score: float = 0.0  # Normalized shock score (0.00-1.00)
    duration_ms: float = 100.0

@dataclass
class SensorSnapshot:
    """
    Unified point-in-time sensor snapshot for a specific vehicle.
    """
    bus_id: str
    timestamp: datetime = field(default_factory=current_utc)
    gps: Optional[GpsReading] = None
    imu: Optional[ImuReading] = None
    frame: Optional[FrameReading] = None
    sequence_number: Optional[int] = None

@dataclass
class FusionResult:
    """
    Outcome of multi-modal sensor fusion evaluation with transparent score breakdown.
    """
    event_type: str  # POTHOLE, SPEED_BREAKER, ROAD_ANOMALY, POTHOLE_CANDIDATE, VEHICLE_COUNT, etc.
    final_confidence: float
    severity: str
    vibration_level: str  # NORMAL, MEDIUM, HIGH
    source: str           # "sensor_fusion", "yolo_visual_only", "imu_shock_only", "opencv_heuristic"
    model_confidence: Optional[float] = None
    heuristic_score: Optional[float] = None
    imu_score: Optional[float] = None
    fusion_score: Optional[float] = None
    verification_score: Optional[float] = None
    evidence_frame_bgr: Optional[np.ndarray] = None
    bbox: Optional[List[int]] = None
    visual_candidate: Optional[VisualCandidate] = None
    impact_candidate: Optional[ImpactCandidate] = None
    is_verified_by_fusion: bool = False
    action_required: str = "CREATE_EVENT"  # CREATE_EVENT, UPDATE_EXISTING, REPAIR_VERIFIED, REPAIR_FAILED, SUPPRESS_DUPLICATE
    defect_id: Optional[str] = None
    notes: Optional[str] = None
