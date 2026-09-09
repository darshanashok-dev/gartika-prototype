from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(String(50), unique=True, index=True, nullable=False)
    event_id = Column(String(50), index=True, nullable=False)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(20), default="HIGH", index=True) # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String(30), default="OPEN", index=True) # OPEN, ASSIGNED, IN PROGRESS, RESOLVED, CANCELLED
    created_at = Column(DateTime, default=utc_now, index=True)
    assigned_to = Column(String(100), default="BBMP Road Maintenance Cell #4")
    location_name = Column(String(150), default="MG Road / Residency Road Junction")
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    source_bus_id = Column(String(50), default="BUS-101", index=True)

