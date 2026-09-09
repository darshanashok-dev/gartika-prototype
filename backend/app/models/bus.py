"""
Bus Sensing Unit Database Model for Gartika Urban Intelligence.

Defines the SQLAlchemy schema for municipal buses and mobile sensing units,
tracking their real-time location, operational status, route, and last heartbeat.
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

class Bus(Base):
    """
    SQLAlchemy model representing a registered sensing vehicle / bus.
    
    Attributes:
        id: Auto-incrementing primary key.
        bus_id: Unique string identifier (e.g., 'BUS-101').
        name: Human-friendly vehicle name (e.g. 'BMTC Urban Sense').
        status: Operational state ('ONLINE', 'OFFLINE', 'INACTIVE').
        latitude: Latest reported GPS latitude.
        longitude: Latest reported GPS longitude.
        speed: Latest reported velocity in km/h.
        route_name: Assigned transit corridor/route.
        source_type: Ingestion stream mode ('DEMO_VIDEO', 'LIVE_PHONE').
        last_seen: Timestamp of the most recent telemetry or event ping.
    """
    __tablename__ = "buses"

    id = Column(Integer, primary_key=True, index=True)
    bus_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), default="BMTC Urban Sense")
    status = Column(String(20), default="ONLINE", index=True) # ONLINE, OFFLINE, INACTIVE
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    speed = Column(Float, default=0.0)
    route_name = Column(String(100), default="Route 335E (Majestic - Whitefield)")
    source_type = Column(String(50), default="DEMO_VIDEO") # LIVE_PHONE, DEMO_VIDEO
    last_seen = Column(DateTime, default=utc_now, onupdate=utc_now, index=True)
