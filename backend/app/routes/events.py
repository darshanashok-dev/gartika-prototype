import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.event import Event
from backend.app.models.bus import Bus
from backend.app.schemas.event import EventCreate, EventUpdate, EventResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/events", tags=["events"])
logger = logging.getLogger("gartika.events")

@router.post("", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(event_in: EventCreate, db: Session = Depends(get_db)):
    """Create and ingest a new AI detected event with transactional safety."""
    event_id = event_in.event_id or f"EVT-{uuid.uuid4().hex[:6].upper()}"
    ts = event_in.timestamp or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    
    try:
        db_event = Event(
            event_id=event_id,
            bus_id=event_in.bus_id,
            event_type=event_in.event_type.upper(),
            confidence=round(event_in.confidence, 4),
            latitude=event_in.latitude,
            longitude=event_in.longitude,
            timestamp=ts,
            severity=event_in.severity.upper() if event_in.severity else "MEDIUM",
            evidence_path=event_in.evidence_path,
            status=event_in.status.upper() if event_in.status else "NEW",
            vehicle_class=event_in.vehicle_class,
            count=event_in.count,
            vibration_level=event_in.vibration_level,
            location_name=event_in.location_name or f"Coords: {event_in.latitude:.4f}, {event_in.longitude:.4f}",
            extra_data=event_in.extra_data
        )
        db.add(db_event)
        
        # Update or register the associated bus
        bus = db.query(Bus).filter(Bus.bus_id == event_in.bus_id).first()
        if bus:
            bus.latitude = event_in.latitude
            bus.longitude = event_in.longitude
            bus.last_seen = ts
            bus.status = "ONLINE"
        else:
            new_bus = Bus(
                bus_id=event_in.bus_id,
                name=f"Bus Sensing Unit {event_in.bus_id}",
                latitude=event_in.latitude,
                longitude=event_in.longitude,
                last_seen=ts,
                status="ONLINE"
            )
            db.add(new_bus)
            
        db.commit()
        db.refresh(db_event)
    except Exception as e:
        db.rollback()
        logger.error(f"[API] Error saving event: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to persist event: {str(e)}")
    
    logger.info(f"[API] Event {db_event.event_id} ({db_event.event_type} - {db_event.severity}) saved from {db_event.bus_id}")
    
    # Real-time WebSocket Broadcast
    event_dict = {
        "type": "NEW_EVENT",
        "data": {
            "id": db_event.id,
            "event_id": db_event.event_id,
            "bus_id": db_event.bus_id,
            "event_type": db_event.event_type,
            "confidence": db_event.confidence,
            "latitude": db_event.latitude,
            "longitude": db_event.longitude,
            "timestamp": db_event.timestamp.isoformat(),
            "severity": db_event.severity,
            "evidence_path": db_event.evidence_path,
            "status": db_event.status,
            "vehicle_class": db_event.vehicle_class,
            "count": db_event.count,
            "location_name": db_event.location_name
        }
    }
    await manager.broadcast(event_dict)
    
    return db_event

@router.get("", response_model=List[EventResponse])
def get_events(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    bus_id: Optional[str] = None,
    min_confidence: Optional[float] = Query(None, ge=0.0, le=1.0),
    db: Session = Depends(get_db)
):
    """Retrieve list of detected events with extensive filtering and pagination."""
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type.upper())
    if severity:
        query = query.filter(Event.severity == severity.upper())
    if status_filter:
        query = query.filter(Event.status == status_filter.upper())
    if bus_id:
        query = query.filter(Event.bus_id == bus_id)
    if min_confidence is not None:
        query = query.filter(Event.confidence >= min_confidence)

    return query.order_by(desc(Event.timestamp)).offset(offset).limit(limit).all()

@router.get("/{event_id}", response_model=EventResponse)
def get_event_by_id(event_id: str, db: Session = Depends(get_db)):
    """Retrieve single event by event_id."""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event

@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(event_id: str, event_up: EventUpdate, db: Session = Depends(get_db)):
    """Update event status / severity with transactional safety and WS sync."""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    
    try:
        if event_up.status is not None:
            event.status = event_up.status.upper()
        if event_up.severity is not None:
            event.severity = event_up.severity.upper()
        if event_up.location_name is not None:
            event.location_name = event_up.location_name
            
        db.commit()
        db.refresh(event)
    except Exception as e:
        db.rollback()
        logger.error(f"[API] Error updating event {event_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update event: {str(e)}")
    
    await manager.broadcast({
        "type": "UPDATE_EVENT",
        "data": {
            "event_id": event.event_id,
            "status": event.status,
            "severity": event.severity,
            "location_name": event.location_name
        }
    })
    return event

@router.delete("/{event_id}", status_code=status.HTTP_200_OK)
async def delete_event(event_id: str, db: Session = Depends(get_db)):
    """Delete an event by event_id."""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    
    try:
        db.delete(event)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[API] Error deleting event {event_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete event: {str(e)}")
        
    await manager.broadcast({
        "type": "DELETE_EVENT",
        "data": {"event_id": event_id}
    })
    return {"status": "success", "message": f"Event {event_id} deleted"}

