"""
Data Schemas Package Init for Gartika Urban Intelligence.

Exposes Pydantic request and response schemas for all system resources.
"""

from backend.app.schemas.bus import BusBase, BusCreate, BusUpdate, BusResponse
from backend.app.schemas.event import EventBase, EventCreate, EventUpdate, EventResponse
from backend.app.schemas.work_order import WorkOrderBase, WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse
from backend.app.schemas.telemetry import TelemetryCreate, TelemetryResponse
