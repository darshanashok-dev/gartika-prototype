from sqlalchemy import Column, Integer, String, Float, DateTime
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Telemetry(Base):
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
    gx = Column(Float, default=0.0)
    gy = Column(Float, default=0.0)
    gz = Column(Float, default=0.0)
    timestamp = Column(DateTime, default=utc_now, index=True)

