import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.event import Event
from backend.app.models.bus import Bus
from backend.app.schemas.event import EventCreate, EventUpdate, EventResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/events", tags=["events"])
logger = logging.getLogger("gartika.events")

@router.post("", response_model=EventResponse, status_code=201)
async def create_event(event_in: EventCreate, db: Session = Depends(get_db)):
    """Create and ingest a new AI detected event."""
    event_id = event_in.event_id or f"EVT-{uuid.uuid4().hex[:6].upper()}"
    ts = event_in.timestamp or datetime.now(timezone.utc)
    
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
        status=event_in.status or "NEW",
        vehicle_class=event_in.vehicle_class,
        count=event_in.count,
        vibration_level=event_in.vibration_level,
        location_name=event_in.location_name or f"Coords: {event_in.latitude:.4f}, {event_in.longitude:.4f}",
        extra_data=event_in.extra_data
    )
    
    db.add(db_event)
    
    # Update bus location and status
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
    
    logger.info(f"[API] Event {db_event.event_id} ({db_event.event_type} - {db_event.severity}) uploaded from {db_event.bus_id}")
    
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
    logger.info(f"[WS] Event {db_event.event_id} broadcast to dashboard")
    
    return db_event

@router.get("", response_model=List[EventResponse])
def get_events(
    limit: int = Query(50, ge=1, le=500),
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    bus_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Retrieve list of detected events."""
    query = db.query(Event)
    if event_type:
        query = query.filter(Event.event_type == event_type.upper())
    if severity:
        query = query.filter(Event.severity == severity.upper())
    if bus_id:
        query = query.filter(Event.bus_id == bus_id)
    return query.order_by(desc(Event.timestamp)).limit(limit).all()

@router.get("/{event_id}", response_model=EventResponse)
def get_event_by_id(event_id: str, db: Session = Depends(get_db)):
    """Retrieve single event by event_id."""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    return event

@router.patch("/{event_id}", response_model=EventResponse)
async def update_event(event_id: str, event_up: EventUpdate, db: Session = Depends(get_db)):
    """Update event status / severity."""
    event = db.query(Event).filter(Event.event_id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    
    if event_up.status is not None:
        event.status = event_up.status
    if event_up.severity is not None:
        event.severity = event_up.severity
    if event_up.location_name is not None:
        event.location_name = event_up.location_name
        
    db.commit()
    db.refresh(event)
    
    await manager.broadcast({
        "type": "UPDATE_EVENT",
        "data": {
            "event_id": event.event_id,
            "status": event.status,
            "severity": event.severity
        }
    })
    return event
