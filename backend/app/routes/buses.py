import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.bus import Bus
from backend.app.schemas.bus import BusCreate, BusUpdate, BusResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/buses", tags=["buses"])
logger = logging.getLogger("gartika.buses")

@router.get("", response_model=List[BusResponse])
def get_buses(
    limit: int = Query(50, ge=1, le=200),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: Session = Depends(get_db)
):
    """Retrieve all registered buses with optional status filter."""
    query = db.query(Bus)
    if status_filter:
        query = query.filter(Bus.status == status_filter.upper())
    return query.limit(limit).all()

@router.post("", response_model=BusResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_bus(bus_in: BusCreate, db: Session = Depends(get_db)):
    """Register or update a bus unit with transactional safety."""
    now_utc = datetime.now(timezone.utc)
    try:
        bus = db.query(Bus).filter(Bus.bus_id == bus_in.bus_id).first()
        if bus:
            bus.name = bus_in.name or bus.name
            bus.status = bus_in.status.upper() if bus_in.status else bus.status
            bus.latitude = bus_in.latitude if bus_in.latitude is not None else bus.latitude
            bus.longitude = bus_in.longitude if bus_in.longitude is not None else bus.longitude
            bus.speed = bus_in.speed if bus_in.speed is not None else bus.speed
            bus.route_name = bus_in.route_name or bus.route_name
            bus.source_type = bus_in.source_type or bus.source_type
            bus.last_seen = now_utc
        else:
            bus = Bus(
                bus_id=bus_in.bus_id,
                name=bus_in.name,
                status=bus_in.status.upper() if bus_in.status else "ONLINE",
                latitude=bus_in.latitude,
                longitude=bus_in.longitude,
                speed=bus_in.speed or 0.0,
                route_name=bus_in.route_name,
                source_type=bus_in.source_type,
                last_seen=now_utc
            )
            db.add(bus)
        
        db.commit()
        db.refresh(bus)
    except Exception as e:
        db.rollback()
        logger.error(f"[BUS] Failed to create/update bus {bus_in.bus_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save bus: {str(e)}")
    
    await manager.broadcast({
        "type": "BUS_UPDATE",
        "data": {
            "bus_id": bus.bus_id,
            "name": bus.name,
            "status": bus.status,
            "latitude": bus.latitude,
            "longitude": bus.longitude,
            "speed": bus.speed,
            "route_name": bus.route_name,
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

@router.delete("/{bus_id}", status_code=status.HTTP_200_OK)
async def delete_bus(bus_id: str, db: Session = Depends(get_db)):
    """Delete a bus unit."""
    bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
    if not bus:
        raise HTTPException(status_code=404, detail=f"Bus {bus_id} not found")
    
    try:
        db.delete(bus)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"[BUS] Failed to delete bus {bus_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to delete bus: {str(e)}")
        
    await manager.broadcast({
        "type": "DELETE_BUS",
        "data": {"bus_id": bus_id}
    })
    return {"status": "success", "message": f"Bus {bus_id} deleted"}

