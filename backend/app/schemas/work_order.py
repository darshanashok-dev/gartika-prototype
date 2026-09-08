from pydantic import BaseModel, ConfigDict
from datetime import datetime, timezone
from typing import Optional

class WorkOrderBase(BaseModel):
    event_id: str
    title: str
    description: Optional[str] = None
    priority: Optional[str] = "HIGH"
    status: Optional[str] = "OPEN" # OPEN, ASSIGNED, IN PROGRESS, RESOLVED
    assigned_to: Optional[str] = "BBMP Road Maintenance Cell #4"
    location_name: Optional[str] = "MG Road / Residency Road Junction"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    source_bus_id: Optional[str] = "BUS-101"

class WorkOrderCreate(WorkOrderBase):
    work_order_id: Optional[str] = None

class WorkOrderUpdate(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assigned_to: Optional[str] = None
    description: Optional[str] = None

class WorkOrderResponse(WorkOrderBase):
    id: int
    work_order_id: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
