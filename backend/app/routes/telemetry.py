"""
Telemetry Ingestion & Sensor Fusion Routes for Gartika Urban Intelligence.

Ingests high-frequency GPS and IMU accelerometer data from mobile units,
buffers sensor samples per vehicle, classifies road bump impacts, and broadcasts
live telemetry coordinates to the GIS Command Center.
"""

import logging
import uuid
import time
from datetime import datetime, timezone
from typing import List, Optional
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
from backend.app.fusion.engine import fusion_engine
from backend.app.fusion.buffer import buffer_manager

router = APIRouter(prefix="/telemetry", tags=["telemetry"])
logger = logging.getLogger("gartika.telemetry")

@router.post("", response_model=TelemetryResponse, status_code=status.HTTP_201_CREATED)
async def ingest_telemetry(t_in: TelemetryCreate, db: Session = Depends(get_db)):
    """
    Ingest live GPS and IMU telemetry from a smartphone edge sensing unit.
    
    Processes 3-axis accelerometer readings through the SensorFusionEngine.
    If a significant vertical acceleration shock is observed, it classifies the event
    as a road impact anomaly, searches for a temporally-aligned camera frame from the same bus,
    and broadcasts the corroborated alert.
    """
    bus_id = t_in.bus_id.strip().upper()
    ts = t_in.timestamp or datetime.now(timezone.utc)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)

    # Validate coordinate ranges (-90 to +90, -180 to +180)
    if not (-90.0 <= t_in.latitude <= 90.0 and -180.0 <= t_in.longitude <= 180.0):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid GPS coordinates: lat={t_in.latitude}, lon={t_in.longitude}"
        )

    try:
        # Record raw telemetry
        db_t = Telemetry(
            bus_id=bus_id,
            latitude=t_in.latitude,
            longitude=t_in.longitude,
            accuracy=t_in.accuracy,
            speed=t_in.speed,
            heading=t_in.heading,
            ax=t_in.ax or 0.0,
            ay=t_in.ay or 0.0,
            az=t_in.az if t_in.az is not None else 9.81,
            sequence_number=t_in.sequence_number,
            timestamp=ts
        )
        db.add(db_t)

        # Update bus registry state
        bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
        if bus:
            bus.latitude = t_in.latitude
            bus.longitude = t_in.longitude
            bus.speed = t_in.speed or 0.0
            bus.last_seen = ts
            bus.status = "ONLINE"
        else:
            bus = Bus(
                bus_id=bus_id,
                name=f"Mobile Sensing Unit {bus_id}",
                latitude=t_in.latitude,
                longitude=t_in.longitude,
                speed=t_in.speed or 0.0,
                last_seen=ts,
                status="ONLINE"
            )
            db.add(bus)

        # Pass IMU and GPS reading to Sensor Fusion Engine
        fused_shock_event = fusion_engine.process_imu_telemetry(
            bus_id=bus_id,
            lat=t_in.latitude,
            lon=t_in.longitude,
            ax=t_in.ax or 0.0,
            ay=t_in.ay or 0.0,
            az=t_in.az if t_in.az is not None else 9.81,
            speed=t_in.speed or 0.0,
            heading=t_in.heading,
            sequence_number=t_in.sequence_number,
            timestamp_sec=ts.timestamp(),
            db=db
        )

        db.commit()
        db.refresh(db_t)

        # If a verified shock event was created, broadcast over WebSocket
        if fused_shock_event:
            await manager.broadcast({"type": "NEW_EVENT", "data": fused_shock_event})

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        logger.error(f"[TELEMETRY] Error ingesting telemetry for {bus_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to ingest telemetry: {str(e)}")

    # Broadcast real-time telemetry position update to dashboard
    tel_payload = {
        "bus_id": db_t.bus_id,
        "latitude": db_t.latitude,
        "longitude": db_t.longitude,
        "speed": db_t.speed,
        "accuracy": db_t.accuracy,
        "ax": db_t.ax,
        "ay": db_t.ay,
        "az": db_t.az,
        "heading": db_t.heading,
        "sequence_number": db_t.sequence_number,
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
    """
    records = db.query(Telemetry).filter(Telemetry.bus_id == bus_id.upper()).order_by(desc(Telemetry.timestamp)).offset(offset).limit(limit).all()
    return records

@router.get("/latest", response_model=TelemetryResponse)
def get_latest_telemetry(bus_id: str = Query("BUS-101"), db: Session = Depends(get_db)):
    """
    Retrieve the most recent telemetry observation recorded for a given bus.
    """
    bus_id = (bus_id or "BUS-101").upper()
    record = db.query(Telemetry).filter(Telemetry.bus_id == bus_id).order_by(desc(Telemetry.timestamp)).first()
    if not record:
        record = db.query(Telemetry).order_by(desc(Telemetry.timestamp)).first()
    if not record:
        raise HTTPException(status_code=404, detail="No telemetry available")
    return record
