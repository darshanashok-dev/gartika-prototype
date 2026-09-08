import logging
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.bus import Bus
from backend.app.schemas.bus import BusCreate, BusUpdate, BusResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/buses", tags=["buses"])
logger = logging.getLogger("gartika.buses")

@router.get("", response_model=List[BusResponse])
def get_buses(db: Session = Depends(get_db)):
    """Retrieve all registered buses."""
    buses = db.query(Bus).all()
    return buses

@router.post("", response_model=BusResponse, status_code=201)
async def create_or_update_bus(bus_in: BusCreate, db: Session = Depends(get_db)):
    """Register or update a bus unit."""
    bus = db.query(Bus).filter(Bus.bus_id == bus_in.bus_id).first()
    if bus:
        bus.name = bus_in.name or bus.name
        bus.status = bus_in.status or bus.status
        bus.latitude = bus_in.latitude if bus_in.latitude is not None else bus.latitude
        bus.longitude = bus_in.longitude if bus_in.longitude is not None else bus.longitude
        bus.speed = bus_in.speed if bus_in.speed is not None else bus.speed
        bus.route_name = bus_in.route_name or bus.route_name
        bus.source_type = bus_in.source_type or bus.source_type
        bus.last_seen = datetime.now(timezone.utc)
    else:
        bus = Bus(
            bus_id=bus_in.bus_id,
            name=bus_in.name,
            status=bus_in.status,
            latitude=bus_in.latitude,
            longitude=bus_in.longitude,
            speed=bus_in.speed,
            route_name=bus_in.route_name,
            source_type=bus_in.source_type,
            last_seen=datetime.now(timezone.utc)
        )
        db.add(bus)
    
    db.commit()
    db.refresh(bus)
    
    await manager.broadcast({
        "type": "BUS_UPDATE",
        "data": {
            "bus_id": bus.bus_id,
            "name": bus.name,
            "status": bus.status,
            "latitude": bus.latitude,
            "longitude": bus.longitude,
            "speed": bus.speed,
            "source_type": bus.source_type,
            "last_seen": bus.last_seen.isoformat()
        }
    })
    return bus

@router.get("/{bus_id}", response_model=BusResponse)
def get_bus(bus_id: str, db: Session = Depends(get_db)):
    bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail=f"Bus {bus_id} not found")
    return bus
