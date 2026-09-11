"""
Gartika Sensor Fusion Package.

Exposes the unified SensorFusionEngine, buffer_manager, privacy_filter,
and sensor data models.
"""

from backend.app.fusion.models import (
    ImuReading, GpsReading, FrameReading, VisualCandidate,
    ImpactCandidate, SensorSnapshot, FusionResult
)
from backend.app.fusion.buffer import BusSensorBuffer, SensorBufferManager, buffer_manager
from backend.app.fusion.privacy import PrivacyFilter, privacy_filter
from backend.app.fusion.engine import SensorFusionEngine, fusion_engine, haversine_distance
