"""
Persistent Road Defect & Observation API Routes for Gartika Urban Intelligence.

Provides REST endpoints for querying physical road defects, multi-bus observation histories,
spatial defect clusters, and closed-loop repair verification state transitions.
"""

import json
import logging
from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.defect import RoadDefect, Observation
from backend.app.models.work_order import WorkOrder
from backend.app.schemas.defect import (
    RoadDefectResponse, RoadDefectUpdate, ObservationResponse
)
from backend.app.websocket import manager

router = APIRouter(prefix="/defects", tags=["defects"])
logger = logging.getLogger("gartika.defects")

@router.get("", response_model=List[RoadDefectResponse])
def get_defects(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    defect_type: Optional[str] = None,
    min_buses: Optional[int] = Query(None, ge=1),
    db: Session = Depends(get_db)
):
    """
    Retrieve paginated persistent road defects with multi-criteria filtering.
    """
    query = db.query(RoadDefect)
    if status_filter:
        query = query.filter(RoadDefect.status == status_filter.upper())
    if severity:
        query = query.filter(RoadDefect.severity == severity.upper())
    if defect_type:
        query = query.filter(RoadDefect.defect_type == defect_type.upper())
    if min_buses:
        query = query.filter(RoadDefect.unique_bus_count >= min_buses)

    defects = query.order_by(desc(RoadDefect.last_seen)).offset(offset).limit(limit).all()
    
    # Parse verifying_buses JSON strings
    results = []
    for d in defects:
        try:
            buses = json.loads(d.verifying_buses or "[]")
        except Exception:
            buses = []
        d.verifying_buses = buses
        results.append(d)

    return results

@router.get("/{defect_id}", response_model=RoadDefectResponse)
def get_defect(defect_id: str, db: Session = Depends(get_db)):
    """
    Retrieve a specific road defect with all historical sensing observations.
    """
    defect = db.query(RoadDefect).filter(RoadDefect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail=f"Road defect {defect_id} not found")
    
    try:
        defect.verifying_buses = json.loads(defect.verifying_buses or "[]")
    except Exception:
        defect.verifying_buses = []

    # Attach observations
    observations = db.query(Observation).filter(Observation.defect_id == defect_id).order_by(desc(Observation.timestamp)).all()
    defect.observations = observations
    return defect

@router.get("/{defect_id}/observations", response_model=List[ObservationResponse])
def get_defect_observations(defect_id: str, db: Session = Depends(get_db)):
    """
    Retrieve all sensor observations for a specific road defect.
    """
    defect = db.query(RoadDefect).filter(RoadDefect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail=f"Road defect {defect_id} not found")

    return db.query(Observation).filter(Observation.defect_id == defect_id).order_by(desc(Observation.timestamp)).all()

@router.patch("/{defect_id}", response_model=RoadDefectResponse)
async def update_defect(defect_id: str, d_up: RoadDefectUpdate, db: Session = Depends(get_db)):
    """
    Update road defect status, severity, repair state, or linked work order.
    """
    defect = db.query(RoadDefect).filter(RoadDefect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail=f"Road defect {defect_id} not found")

    try:
        if d_up.status is not None:
            defect.status = d_up.status.upper()
        if d_up.severity is not None:
            defect.severity = d_up.severity.upper()
        if d_up.repair_status is not None:
            defect.repair_status = d_up.repair_status.upper()
            if defect.repair_status == "REPAIRED":
                defect.status = "REPAIRED"
        if d_up.work_order_id is not None:
            defect.work_order_id = d_up.work_order_id
            defect.status = "WORK_ORDER_CREATED"
        if d_up.location_name is not None:
            defect.location_name = d_up.location_name

        db.commit()
        db.refresh(defect)
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update defect: {str(e)}")

    try:
        defect.verifying_buses = json.loads(defect.verifying_buses or "[]")
    except Exception:
        defect.verifying_buses = []

    await manager.broadcast({
        "type": "UPDATE_DEFECT",
        "data": {
            "defect_id": defect.defect_id,
            "status": defect.status,
            "severity": defect.severity,
            "repair_status": defect.repair_status,
            "unique_bus_count": defect.unique_bus_count
        }
    })

    return defect

@router.post("/{defect_id}/verify-repair")
async def verify_repair(
    defect_id: str,
    verified_by_bus_id: str = Query("BUS-101"),
    is_repaired: bool = Query(True),
    db: Session = Depends(get_db)
):
    """
    Execute closed-loop repair verification for a defect marked as repaired.
    """
    defect = db.query(RoadDefect).filter(RoadDefect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail=f"Road defect {defect_id} not found")

    now = datetime.now(timezone.utc)
    if is_repaired:
        defect.status = "CLOSED"
        defect.repair_status = "REPAIR_VERIFIED"
        defect.repair_verified_at = now
        defect.repair_verified_by_bus_id = verified_by_bus_id

        # Update linked work order
        if defect.work_order_id:
            wo = db.query(WorkOrder).filter(WorkOrder.work_order_id == defect.work_order_id).first()
            if wo:
                wo.status = "RESOLVED"
                wo.completed_at = now

        obs = Observation(
            observation_id=f"OBS-REP-{defect.id}-{int(now.timestamp())}",
            defect_id=defect.defect_id,
            bus_id=verified_by_bus_id,
            timestamp=now,
            latitude=defect.latitude,
            longitude=defect.longitude,
            source="closed_loop_repair_verification",
            is_repair_check=True,
            repair_check_result="CONFIRMED_REPAIRED"
        )
        db.add(obs)
    else:
        defect.status = "REPAIR_FAILED"
        defect.repair_status = "REPAIR_FAILED"
        obs = Observation(
            observation_id=f"OBS-REP-{defect.id}-{int(now.timestamp())}",
            defect_id=defect.defect_id,
            bus_id=verified_by_bus_id,
            timestamp=now,
            latitude=defect.latitude,
            longitude=defect.longitude,
            source="closed_loop_repair_verification",
            is_repair_check=True,
            repair_check_result="DEFECT_PERSISTS"
        )
        db.add(obs)

    db.commit()
    db.refresh(defect)

    await manager.broadcast({
        "type": "REPAIR_VERIFICATION",
        "data": {
            "defect_id": defect.defect_id,
            "status": defect.status,
            "repair_status": defect.repair_status,
            "verified_by": verified_by_bus_id,
            "is_repaired": is_repaired
        }
    })

    return {
        "status": "success",
        "defect_id": defect.defect_id,
        "defect_status": defect.status,
        "repair_status": defect.repair_status,
        "verified_by_bus_id": verified_by_bus_id,
        "verified_at": now.isoformat()
    }

@router.delete("/{defect_id}", status_code=status.HTTP_200_OK)
async def delete_defect(defect_id: str, db: Session = Depends(get_db)):
    """
    Delete a road defect and its associated observation records.
    """
    defect = db.query(RoadDefect).filter(RoadDefect.defect_id == defect_id).first()
    if not defect:
        raise HTTPException(status_code=404, detail=f"Road defect {defect_id} not found")

    try:
        db.query(Observation).filter(Observation.defect_id == defect_id).delete()
        db.delete(defect)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete defect: {str(e)}")

    await manager.broadcast({
        "type": "DELETE_DEFECT",
        "data": {"defect_id": defect_id}
    })
    return {"status": "success", "message": f"Defect {defect_id} deleted"}
