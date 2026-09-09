"""
Maintenance Work Order Database Model for Gartika Urban Intelligence.

Represents municipal repair orders automatically or manually generated from
detected urban defect events (e.g., road patching, pothole repairs).
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, Text
from datetime import datetime, timezone
from backend.app.database import Base

def utc_now():
    """
    Return current timezone-aware UTC datetime.
    
    Returns:
        datetime: Current UTC timestamp.
    """
    return datetime.now(timezone.utc)

class WorkOrder(Base):
    """
    SQLAlchemy model representing a municipal road maintenance dispatch.
    
    Attributes:
        id: Auto-incrementing primary key.
        work_order_id: Unique order reference (e.g. 'WO-101', 'WO-A5F92').
        event_id: Foreign reference to the originating detection Event.
        title: Short action title (e.g. 'Asphalt Patching & Pothole Repair').
        description: Detailed instructions and sensor metadata summary.
        priority: Dispatch urgency ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL').
        status: Progress state ('OPEN', 'ASSIGNED', 'IN PROGRESS', 'RESOLVED', 'CANCELLED').
        created_at: Creation timestamp in UTC.
        assigned_to: Assigned municipal division or contractor team.
        location_name: Description of repair site.
        latitude: Target repair GPS latitude.
        longitude: Target repair GPS longitude.
        source_bus_id: Identifier of the bus unit that detected the underlying defect.
    """
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
