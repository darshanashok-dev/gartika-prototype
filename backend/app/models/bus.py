from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Bus(Base):
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

