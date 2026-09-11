"""
Telemetry & Sensor Time-Series Database Model for Gartika Urban Intelligence.

Stores high-frequency GPS positioning and IMU accelerometer/gyroscope readings
from transit buses and mobile edge units for real-time tracking and shock detection.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    """
    Return current timezone-aware UTC datetime.
    
    Returns:
        datetime: Current UTC timestamp.
    """
    return datetime.now(timezone.utc)

class Telemetry(Base):
    """
    SQLAlchemy model representing a single GPS & IMU telemetry observation.
    
    Attributes:
        id: Auto-incrementing primary key.
        bus_id: Identifier of the transmitting bus unit.
        latitude: GPS latitude in decimal degrees.
        longitude: GPS longitude in decimal degrees.
        accuracy: GPS horizontal accuracy radius in meters.
        speed: Vehicle velocity in km/h.
        ax: Linear acceleration on X-axis (lateral) in m/s².
        ay: Linear acceleration on Y-axis (longitudinal) in m/s².
        az: Linear acceleration on Z-axis (vertical road shock) in m/s².
        gx: Gyroscope angular velocity around X-axis.
        gy: Gyroscope angular velocity around Y-axis.
        gz: Gyroscope angular velocity around Z-axis.
        timestamp: Time of telemetry sample in UTC.
    """
    __tablename__ = "telemetry"

    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(String(50), index=True, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy = Column(Float, default=5.0)
    speed = Column(Float, default=0.0)
    ax = Column(Float, default=0.0)
    ay = Column(Float, default=0.0)
    az = Column(Float, default=9.81)
    heading = Column(Float, nullable=True)
    sequence_number = Column(Integer, nullable=True, index=True)
    timestamp = Column(DateTime, default=utc_now, index=True)

