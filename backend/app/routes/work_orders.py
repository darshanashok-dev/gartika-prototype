"""
Maintenance Work Orders API Routes for Gartika Urban Intelligence.

Manages the end-to-end municipal dispatch workflow: converting AI defect events
into actionable repair work orders, updating assignment/status, and keeping
dashboards and persistent road defect entities in sync via real-time WebSocket notifications.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.work_order import WorkOrder
from backend.app.models.event import Event
from backend.app.models.defect import RoadDefect
from backend.app.schemas.work_order import WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/work-orders", tags=["work-orders"])
logger = logging.getLogger("gartika.work_orders")

@router.post("", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order(wo_in: WorkOrderCreate, db: Session = Depends(get_db)):
    """
    Create and dispatch a new municipal maintenance work order from a detected defect event.
    """
    wo_id = wo_in.work_order_id or f"WO-{uuid.uuid4().hex[:5].upper()}"
    now_utc = datetime.now(timezone.utc)
    
    # Check if event or defect exists to copy coordinates and update lifecycle status
    event = None
    if wo_in.event_id:
        event = db.query(Event).filter(Event.event_id == wo_in.event_id).first()
    
    defect = None
    defect_id = wo_in.defect_id
    if not defect_id and event and event.defect_id:
        defect_id = event.defect_id
    if defect_id:
        defect = db.query(RoadDefect).filter(RoadDefect.defect_id == defect_id).first()

    lat = wo_in.latitude
    lon = wo_in.longitude
    loc_name = wo_in.location_name
    
    if defect:
        lat = lat if lat is not None else defect.latitude
        lon = lon if lon is not None else defect.longitude
        loc_name = loc_name or defect.location_name
        defect.status = "WORK_ORDER_CREATED"
        defect.work_order_id = wo_id

    if event:
        lat = lat if lat is not None else event.latitude
        lon = lon if lon is not None else event.longitude
        loc_name = loc_name or event.location_name
        event.status = "WORK_ORDER_CREATED"
        
    try:
        db_wo = WorkOrder(
            work_order_id=wo_id,
            event_id=wo_in.event_id,
            defect_id=defect_id,
            title=wo_in.title,
            description=wo_in.description or f"Automated maintenance order for {defect_id or wo_in.event_id}",
            priority=wo_in.priority.upper() if wo_in.priority else "HIGH",
            status=wo_in.status.upper() if wo_in.status else "OPEN",
            created_at=now_utc,
            assigned_at=now_utc if wo_in.status == "ASSIGNED" else None,
            assigned_to=wo_in.assigned_to or "BBMP Road Infrastructure Cell",
            location_name=loc_name or "Bangalore Metropolitan Area",
            latitude=lat,
            longitude=lon,
            source_bus_id=wo_in.source_bus_id or (event.bus_id if event else "BUS-101")
        )
        
        db.add(db_wo)
        db.commit()
        db.refresh(db_wo)
    except Exception as e:
        db.rollback()
        logger.error(f"[WORK ORDER] Failed to create work order: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create work order: {str(e)}")
    
    logger.info(f"[WORK ORDER] Created {db_wo.work_order_id} (Priority: {db_wo.priority})")
    
    # Broadcast to dashboard
    await manager.broadcast({
        "type": "NEW_WORK_ORDER",
        "data": {
            "id": db_wo.id,
            "work_order_id": db_wo.work_order_id,
            "event_id": db_wo.event_id,
            "defect_id": db_wo.defect_id,
            "title": db_wo.title,
            "description": db_wo.description,
            "priority": db_wo.priority,
            "status": db_wo.status,
            "assigned_to": db_wo.assigned_to,
            "location_name": db_wo.location_name,
            "latitude": db_wo.latitude,
            "longitude": db_wo.longitude,
            "source_bus_id": db_wo.source_bus_id,
            "created_at": db_wo.created_at.isoformat()
        }
    })
    
    return db_wo

@router.get("", response_model=List[WorkOrderResponse])
def get_work_orders(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Retrieve a paginated list of maintenance work orders with optional filtering.
    """
    query = db.query(WorkOrder)
    if status_filter:
        query = query.filter(WorkOrder.status == status_filter.upper())
    if priority:
        query = query.filter(WorkOrder.priority == priority.upper())
    return query.order_by(desc(WorkOrder.created_at)).offset(offset).limit(limit).all()

@router.get("/{work_order_id}", response_model=WorkOrderResponse)
def get_work_order(work_order_id: str, db: Session = Depends(get_db)):
    """
    Retrieve a specific work order by its unique work_order_id.
    """
    wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail=f"Work Order {work_order_id} not found")
    return wo

@router.patch("/{work_order_id}", response_model=WorkOrderResponse)
async def update_work_order(work_order_id: str, wo_up: WorkOrderUpdate, db: Session = Depends(get_db)):
    """
    Update work order status, priority, contractor assignment, or notes.
    Synchronizes lifecycle state with corresponding RoadDefect and Event entities.
    """
    wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail=f"Work Order {work_order_id} not found")
    
    now_utc = datetime.now(timezone.utc)
    try:
        if wo_up.status is not None:
            new_status = wo_up.status.upper()
            wo.status = new_status
            
            if new_status == "ASSIGNED":
                wo.assigned_at = now_utc
            elif new_status == "IN PROGRESS":
                wo.started_at = now_utc
            elif new_status in ("REPAIRED", "RESOLVED", "CLOSED"):
                wo.completed_at = now_utc

            # Update associated RoadDefect entity
            if wo.defect_id:
                defect = db.query(RoadDefect).filter(RoadDefect.defect_id == wo.defect_id).first()
                if defect:
                    if new_status == "REPAIRED":
                        defect.status = "REPAIRED"
                        defect.repair_status = "REPAIRED"
                    elif new_status in ("RESOLVED", "CLOSED"):
                        defect.status = "CLOSED"
                        defect.repair_status = "REPAIR_VERIFIED"
                    elif new_status in ("OPEN", "ASSIGNED", "IN PROGRESS"):
                        defect.status = new_status

            # Update associated Event entity for backward-compatibility
            if wo.event_id:
                event = db.query(Event).filter(Event.event_id == wo.event_id).first()
                if event:
                    if new_status in ("RESOLVED", "CLOSED", "REPAIRED"):
                        event.status = new_status
                    elif new_status in ("OPEN", "ASSIGNED", "IN PROGRESS"):
                        event.status = "WORK_ORDER_CREATED"
                    
        if wo_up.priority is not None:
            wo.priority = wo_up.priority.upper()
        if wo_up.assigned_to is not None:
            wo.assigned_to = wo_up.assigned_to
        if wo_up.description is not None:
            wo.description = wo_up.description
        if wo_up.notes is not None:
            wo.notes = wo_up.notes
            
        db.commit()
        db.refresh(wo)
    except Exception as e:
        db.rollback()
        logger.error(f"[WORK ORDER] Error updating work order {work_order_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update work order: {str(e)}")
    
    await manager.broadcast({
        "type": "UPDATE_WORK_ORDER",
        "data": {
            "work_order_id": wo.work_order_id,
            "status": wo.status,
            "priority": wo.priority,
            "assigned_to": wo.assigned_to,
            "description": wo.description,
            "completed_at": wo.completed_at.isoformat() if wo.completed_at else None
        }
    })
    return wo

@router.delete("/{work_order_id}", status_code=status.HTTP_200_OK)
async def delete_work_order(work_order_id: str, db: Session = Depends(get_db)):
    """
    Delete a work order by work_order_id.
    """
    wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail=f"Work Order {work_order_id} not found")
    
    try:
        db.delete(wo)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[WORK ORDER] Error deleting work order {work_order_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete work order: {str(e)}")
        
    await manager.broadcast({
        "type": "DELETE_WORK_ORDER",
        "data": {"work_order_id": work_order_id}
    })
    return {"status": "success", "message": f"Work order {work_order_id} deleted"}
