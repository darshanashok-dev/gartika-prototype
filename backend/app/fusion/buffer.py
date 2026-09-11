"""
Per-Bus Sensor Buffer & Temporal Alignment Manager.

Maintains isolated, per-bus ring buffers for IMU telemetry samples, GPS coordinates,
and camera frames. Prevents cross-vehicle evidence contamination and performs
precise timestamp-aware sensor association within configurable temporal windows.
"""

import time
import logging
from collections import deque
from typing import Dict, Optional, List
from backend.app.fusion.models import ImuReading, GpsReading, FrameReading, SensorSnapshot

logger = logging.getLogger("gartika.fusion.buffer")

class BusSensorBuffer:
    """
    Isolated circular sensor buffer dedicated to a single vehicle sensing unit.
    """
    def __init__(self, bus_id: str, max_imu_samples: int = 200, max_frames: int = 15):
        self.bus_id = bus_id
        self.imu_buffer: deque[ImuReading] = deque(maxlen=max_imu_samples)
        self.frame_buffer: deque[FrameReading] = deque(maxlen=max_frames)
        self.latest_gps: Optional[GpsReading] = None
        self.latest_frame: Optional[FrameReading] = None
        self.latest_imu: Optional[ImuReading] = None
        self.last_sequence_number: Optional[int] = None
        self.last_activity_time: float = time.time()

    def add_imu(self, reading: ImuReading, sequence_number: Optional[int] = None):
        """Append an IMU reading to vehicle ring buffer."""
        self.imu_buffer.append(reading)
        self.latest_imu = reading
        self.last_activity_time = time.time()
        if sequence_number is not None:
            self._track_sequence(sequence_number)

    def add_gps(self, reading: GpsReading, sequence_number: Optional[int] = None):
        """Update vehicle GPS position."""
        if reading.is_valid:
            self.latest_gps = reading
            self.last_activity_time = time.time()
        if sequence_number is not None:
            self._track_sequence(sequence_number)

    def add_frame(self, frame: FrameReading):
        """Append a camera frame to vehicle frame buffer."""
        self.frame_buffer.append(frame)
        self.latest_frame = frame
        self.last_activity_time = time.time()

    def _track_sequence(self, seq: int):
        """Monitor sequence monotonicity for edge packet reliability."""
        if self.last_sequence_number is not None and seq > self.last_sequence_number + 1:
            dropped = seq - self.last_sequence_number - 1
            logger.warning(f"[BUFFER:{self.bus_id}] Sequence gap detected: {dropped} packet(s) dropped between {self.last_sequence_number} and {seq}")
        self.last_sequence_number = seq

    def get_aligned_imu(self, target_timestamp: float, window_ms: int = 500) -> Optional[ImuReading]:
        """
        Find the most significant IMU reading (peak vertical shock) within the temporal window.
        
        Args:
            target_timestamp: Unix timestamp of the camera frame.
            window_ms: Search window in milliseconds (default: ±500ms).
            
        Returns:
            ImuReading or None: Peak shock IMU reading within window, or closest reading.
        """
        window_sec = window_ms / 1000.0
        min_ts = target_timestamp - window_sec
        max_ts = target_timestamp + window_sec

        candidates = [imu for imu in self.imu_buffer if min_ts <= imu.timestamp <= max_ts]
        if not candidates:
            # Fallback to latest IMU if within 2x window
            if self.latest_imu and abs(self.latest_imu.timestamp - target_timestamp) <= (window_sec * 2.0):
                return self.latest_imu
            return None

        # Return candidate with maximum vertical shock deviation
        return max(candidates, key=lambda imu: imu.vertical_shock)

    def get_aligned_frame(self, target_timestamp: float, window_ms: int = 800) -> Optional[FrameReading]:
        """
        Find the camera frame closest in time to an IMU event.
        
        Args:
            target_timestamp: Unix timestamp of the IMU event.
            window_ms: Search window in milliseconds (default: ±800ms).
            
        Returns:
            FrameReading or None: Closest frame within window.
        """
        window_sec = window_ms / 1000.0
        min_ts = target_timestamp - window_sec
        max_ts = target_timestamp + window_sec

        candidates = [f for f in self.frame_buffer if min_ts <= f.timestamp <= max_ts]
        if not candidates:
            if self.latest_frame and abs(self.latest_frame.timestamp - target_timestamp) <= (window_sec * 1.5):
                return self.latest_frame
            return None

        # Return frame with minimal absolute time delta
        return min(candidates, key=lambda f: abs(f.timestamp - target_timestamp))

    def get_latest_frame_bytes(self) -> Optional[bytes]:
        """Retrieve most recent frame raw JPEG bytes for this bus."""
        return self.latest_frame.frame_bytes if self.latest_frame else None


class SensorBufferManager:
    """
    Thread-safe registry of per-bus sensor buffers.
    Ensures multi-bus independence.
    """
    def __init__(self):
        self._buffers: Dict[str, BusSensorBuffer] = {}

    def get_buffer(self, bus_id: str) -> BusSensorBuffer:
        """Get or create the sensor buffer for a specific bus."""
        bus_id = (bus_id or "BUS-101").strip().upper()
        if bus_id not in self._buffers:
            self._buffers[bus_id] = BusSensorBuffer(bus_id=bus_id)
        return self._buffers[bus_id]

    def list_active_buses(self, max_idle_seconds: float = 300.0) -> List[str]:
        """List identifiers of buses active within the idle threshold."""
        now = time.time()
        return [
            bid for bid, buf in self._buffers.items()
            if (now - buf.last_activity_time) <= max_idle_seconds
        ]

    def get_latest_frame(self, bus_id: str) -> Optional[bytes]:
        """Retrieve latest camera frame specifically for the given bus ID."""
        buf = self._buffers.get(bus_id.upper()) if bus_id else None
        if buf and buf.latest_frame:
            return buf.latest_frame.frame_bytes
        return None

# Global buffer manager singleton
buffer_manager = SensorBufferManager()
