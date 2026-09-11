"""
Work Order Pydantic Data Schemas for Gartika Urban Intelligence.

Defines validation and serialization models for municipal maintenance orders.
"""

from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class WorkOrderBase(BaseModel):
    """
    Base properties shared across WorkOrder schemas.
    """
    event_id: Optional[str] = None
    defect_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "HIGH"  # LOW, MEDIUM, HIGH, CRITICAL
    status: Optional[str] = "OPEN"    # OPEN, ASSIGNED, IN PROGRESS, REPAIRED, REPAIR_VERIFIED, REPAIR_FAILED, RESOLVED, CLOSED, CANCELLED
    assigned_to: Optional[str] = "BBMP Road Maintenance Cell #4"
    location_name: Optional[str] = "MG Road / Residency Road Junction"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_bus_id: Optional[str] = "BUS-101"

class WorkOrderCreate(WorkOrderBase):
    """
    Schema for creating a new maintenance dispatch order.
    """
    work_order_id: Optional[str] = None

class WorkOrderUpdate(BaseModel):
    """
    Schema for modifying work order status, priority, notes, or assignment.
    """
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None
    notes: Optional[str] = None

class WorkOrderResponse(WorkOrderBase):
    """
    Schema for serializing a WorkOrder database entity to JSON response.
    """
    id: int
    work_order_id: str
    created_at: datetime
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    notes: Optional[str] = None
    model_config = ConfigDict(from_attributes=True)

