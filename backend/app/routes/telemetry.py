"""
Telemetry Ingestion & Sensor Shock Detection Routes for Gartika Urban Intelligence.

Ingests high-frequency GPS and IMU accelerometer data from mobile units,
detects road bump shocks in real-time, pairs with recent camera frames, and broadcasts
live telemetry coordinates to the GIS Command Center.
"""

import logging
import uuid
import time
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.telemetry import Telemetry
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.schemas.telemetry import TelemetryCreate, TelemetryResponse
from backend.app.websocket import manager
from backend.app.config import settings

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
logger = logging.getLogger("gartika.telemetry")

@router.post("", response_model=TelemetryResponse, status_code=status.HTTP_201_CREATED)
async def ingest_telemetry(t_in: TelemetryCreate, db: Session = Depends(get_db)):
    """
    Ingest live GPS and IMU telemetry from a smartphone edge unit.
    
    Processes accelerometer vertical axis (az) to detect severe road bump impacts.
    If a vertical spike exceeding threshold is detected, it automatically creates a
    Pothole event paired with the latest camera frame and triggers real-time alerts.
    
    Args:
        t_in: Validated TelemetryCreate payload.
        db: Scoped database session.
        
    Returns:
        Telemetry: Stored telemetry record.
    """
    ts = t_in.timestamp or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    
    try:
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
        
        # Update or register bus status and position
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
                name=f"Mobile Unit {t_in.bus_id}",
                latitude=t_in.latitude,
                longitude=t_in.longitude,
                speed=t_in.speed,
                last_seen=ts,
                status="ONLINE"
            )
            db.add(bus)
            
        # Check for Real Accelerometer Road Bump Shock Spike (Sensor Fusion)
        az_val = t_in.az if t_in.az is not None else 9.81
        if az_val > 13.5 or abs(az_val - 9.81) > 4.0:
            evt_code = uuid.uuid4().hex[:8].upper()
            evt_id = f"EVT-POTH-{evt_code}"
            
            # Check if there is a recent frame in stream module to save as evidence
            from backend.app.routes.stream import latest_frame_bytes
            evidence_path = None
            if latest_frame_bytes:
                filename = f"{evt_id}_{int(time.time())}.jpg"
                save_path = settings.EVIDENCE_DIR / filename
                settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(latest_frame_bytes)
                evidence_path = f"/evidence/{filename}"

            bump_event = Event(
                event_id=evt_id,
                bus_id=t_in.bus_id,
                event_type="POTHOLE",
                confidence=0.92,
                latitude=float(t_in.latitude),
                longitude=float(t_in.longitude),
                severity="HIGH" if az_val > 15.0 else "MEDIUM",
                vibration_level="HIGH",
                evidence_path=evidence_path,
                status="NEW",
                timestamp=ts
            )
            db.add(bump_event)
            db.commit()
            db.refresh(bump_event)

            # Broadcast new defect event immediately over WebSocket
            await manager.broadcast({
                "type": "NEW_EVENT",
                "data": {
                    "id": bump_event.id,
                    "event_id": bump_event.event_id,
                    "bus_id": bump_event.bus_id,
                    "event_type": bump_event.event_type,
                    "confidence": bump_event.confidence,
                    "latitude": bump_event.latitude,
                    "longitude": bump_event.longitude,
                    "severity": bump_event.severity,
                    "evidence_image_url": bump_event.evidence_path,
                    "timestamp": bump_event.timestamp.isoformat()
                }
            })
            logger.info(f"[SENSOR FUSION] Real IMU road shock detected at {t_in.latitude}, {t_in.longitude} (az={az_val:.2f} m/s²)")
        else:
            db.commit()

        db.refresh(db_t)
    except Exception as e:
        db.rollback()
        logger.error(f"[TELEMETRY] Error ingesting telemetry: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest telemetry: {str(e)}")
    
    # Broadcast telemetry update to dashboard
    tel_payload = {
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
    await manager.broadcast({"type": "TELEMETRY", "data": tel_payload})
    await manager.broadcast({"type": "TELEMETRY_UPDATE", "data": tel_payload})
    
    return db_t

@router.get("/buses/{bus_id}/telemetry", response_model=List[TelemetryResponse])
def get_bus_telemetry(
    bus_id: str,
    limit: int = Query(30, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """
    Retrieve historical telemetry breadcrumbs for a specific bus.
    
    Args:
        bus_id: Unique bus identifier.
        limit: Max records.
        offset: Skip records.
        db: Scoped database session.
        
    Returns:
        list of Telemetry: Historical telemetry entries ordered newest first.
    """
    records = db.query(Telemetry).filter(Telemetry.bus_id == bus_id).order_by(desc(Telemetry.timestamp)).offset(offset).limit(limit).all()
    return records

@router.get("/latest", response_model=TelemetryResponse)
def get_latest_telemetry(bus_id: str = Query("BUS-101"), db: Session = Depends(get_db)):
    """
    Retrieve the most recent telemetry observation recorded for a given bus.
    
    Args:
        bus_id: Bus identifier (default: 'BUS-101').
        db: Scoped database session.
        
    Returns:
        Telemetry: Most recent telemetry data point.
    """
    record = db.query(Telemetry).filter(Telemetry.bus_id == bus_id).order_by(desc(Telemetry.timestamp)).first()
    if not record:
        record = db.query(Telemetry).order_by(desc(Telemetry.timestamp)).first()
    if not record:
        raise HTTPException(status_code=404, detail="No telemetry available")
    return record
