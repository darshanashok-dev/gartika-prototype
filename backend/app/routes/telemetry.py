import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.telemetry import Telemetry
from backend.app.models.bus import Bus
from backend.app.schemas.telemetry import TelemetryCreate, TelemetryResponse
from backend.app.websocket import manager

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
logger = logging.getLogger("gartika.telemetry")

@router.post("", response_model=TelemetryResponse, status_code=201)
async def ingest_telemetry(t_in: TelemetryCreate, db: Session = Depends(get_db)):
    """Ingest GPS and IMU telemetry from smartphone edge unit."""
    ts = t_in.timestamp or datetime.now(timezone.utc)
    
    db_t = Telemetry(
        bus_id=t_in.bus_id,
        latitude=t_in.latitude,
        longitude=t_in.longitude,
        accuracy=t_in.accuracy,
        speed=t_in.speed,
        ax=t_in.ax,
        ay=t_in.ay,
        az=t_in.az,
        gx=t_in.gx,
        gy=t_in.gy,
        gz=t_in.gz,
        timestamp=ts
    )
    db.add(db_t)
    
    # Update bus status and position
    bus = db.query(Bus).filter(Bus.bus_id == t_in.bus_id).first()
    if bus:
        bus.latitude = t_in.latitude
        bus.longitude = t_in.longitude
        bus.speed = t_in.speed
        bus.last_seen = ts
        bus.status = "ONLINE"
    else:
        bus = Bus(
            bus_id=t_in.bus_id,
            name=f"Bus Sensing Unit {t_in.bus_id}",
            latitude=t_in.latitude,
            longitude=t_in.longitude,
            speed=t_in.speed,
            last_seen=ts,
            status="ONLINE"
        )
        db.add(bus)
        
    db.commit()
    db.refresh(db_t)
    
    # Broadcast telemetry update to dashboard
    await manager.broadcast({
        "type": "TELEMETRY",
        "data": {
            "bus_id": db_t.bus_id,
            "latitude": db_t.latitude,
            "longitude": db_t.longitude,
            "speed": db_t.speed,
            "accuracy": db_t.accuracy,
            "ax": db_t.ax,
            "ay": db_t.ay,
            "az": db_t.az,
            "timestamp": db_t.timestamp.isoformat()
        }
    })
    
    return db_t

@router.get("/buses/{bus_id}/telemetry", response_model=List[TelemetryResponse])
def get_bus_telemetry(bus_id: str, limit: int = Query(30, ge=1, le=200), db: Session = Depends(get_db)):
    """Get recent telemetry for a given bus."""
    records = db.query(Telemetry).filter(Telemetry.bus_id == bus_id).order_by(desc(Telemetry.timestamp)).limit(limit).all()
    return records
