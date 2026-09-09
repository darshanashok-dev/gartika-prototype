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
from backend.app.schemas.work_order import WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/work-orders", tags=["work-orders"])
logger = logging.getLogger("gartika.work_orders")

@router.post("", response_model=WorkOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_work_order(wo_in: WorkOrderCreate, db: Session = Depends(get_db)):
    """Create a maintenance work order from an AI detection event with transactional safety."""
    wo_id = wo_in.work_order_id or f"WO-{uuid.uuid4().hex[:5].upper()}"
    
    # Check if event exists to copy coordinates and update event status
    event = db.query(Event).filter(Event.event_id == wo_in.event_id).first()
    lat = wo_in.latitude
    lon = wo_in.longitude
    loc_name = wo_in.location_name
    
    if event:
        lat = lat if lat is not None else event.latitude
        lon = lon if lon is not None else event.longitude
        loc_name = loc_name or event.location_name
        event.status = "WORK_ORDER_CREATED"
        
    try:
        db_wo = WorkOrder(
            work_order_id=wo_id,
            event_id=wo_in.event_id,
            title=wo_in.title,
            description=wo_in.description or f"Automated maintenance order generated from {wo_in.event_id}",
            priority=wo_in.priority.upper() if wo_in.priority else "HIGH",
            status=wo_in.status.upper() if wo_in.status else "OPEN",
            created_at=datetime.now(timezone.utc),
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
    
    logger.info(f"[WORK ORDER] Created {db_wo.work_order_id} for Event {db_wo.event_id} (Priority: {db_wo.priority})")
    
    # Broadcast to dashboard
    await manager.broadcast({
        "type": "NEW_WORK_ORDER",
        "data": {
            "id": db_wo.id,
            "work_order_id": db_wo.work_order_id,
            "event_id": db_wo.event_id,
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
    
    # Also notify dashboard that event status changed
    if event:
        await manager.broadcast({
            "type": "UPDATE_EVENT",
            "data": {
                "event_id": event.event_id,
                "status": event.status,
                "severity": event.severity
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
    query = db.query(WorkOrder)
    if status_filter:
        query = query.filter(WorkOrder.status == status_filter.upper())
    if priority:
        query = query.filter(WorkOrder.priority == priority.upper())
    return query.order_by(desc(WorkOrder.created_at)).offset(offset).limit(limit).all()

@router.get("/{work_order_id}", response_model=WorkOrderResponse)
def get_work_order(work_order_id: str, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail=f"Work Order {work_order_id} not found")
    return wo

@router.patch("/{work_order_id}", response_model=WorkOrderResponse)
async def update_work_order(work_order_id: str, wo_up: WorkOrderUpdate, db: Session = Depends(get_db)):
    wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == work_order_id).first()
    if not wo:
        raise HTTPException(status_code=404, detail=f"Work Order {work_order_id} not found")
    
    try:
        if wo_up.status is not None:
            wo.status = wo_up.status.upper()
            # If resolved, update corresponding event status as well
            if wo.status == "RESOLVED":
                event = db.query(Event).filter(Event.event_id == wo.event_id).first()
                if event:
                    event.status = "RESOLVED"
            elif wo.status in ("OPEN", "ASSIGNED", "IN PROGRESS"):
                event = db.query(Event).filter(Event.event_id == wo.event_id).first()
                if event and event.status == "RESOLVED":
                    event.status = "WORK_ORDER_CREATED"
                    
        if wo_up.priority is not None:
            wo.priority = wo_up.priority.upper()
        if wo_up.assigned_to is not None:
            wo.assigned_to = wo_up.assigned_to
        if wo_up.description is not None:
            wo.description = wo_up.description
            
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
            "description": wo.description
        }
    })
    return wo

@router.delete("/{work_order_id}", status_code=status.HTTP_200_OK)
async def delete_work_order(work_order_id: str, db: Session = Depends(get_db)):
    """Delete work order by work_order_id."""
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

