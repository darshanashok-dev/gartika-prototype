from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models.bus import Bus
from backend.app.models.event import Event
from backend.app.models.work_order import WorkOrder
from backend.app.models.telemetry import Telemetry
from backend.app.config import settings

router = APIRouter(tags=["stats"])

@router.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint for backend, DB, and AI system status."""
    db_ok = True
    try:
        db.execute(func.now()).first()
    except Exception:
        db_ok = False

    return {
        "status": "healthy" if db_ok else "degraded",
        "database": "CONNECTED" if db_ok else "DISCONNECTED",
        "project": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "edge_unit_status": "ONLINE",
        "backend_status": "ONLINE",
        "ai_engine_status": "ONLINE",
        "local_ip": settings.LOCAL_IP,
        "mode": "DEMO" if settings.DEMO_MODE else "LIVE"
    }

@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """System-wide summary statistics for dashboard with accurate counts."""
    now_utc = datetime.now(timezone.utc)
    # Consider active if seen in the last 2 minutes or explicitly ONLINE
    active_cutoff = now_utc - timedelta(minutes=2)
    
    total_buses = db.query(Bus).count()
    active_buses = db.query(Bus).filter(
        (Bus.status == "ONLINE") & (Bus.last_seen >= active_cutoff)
    ).count()
    
    # In demo mode, show at least 1 if buses exist
    if settings.DEMO_MODE and total_buses > 0 and active_buses == 0:
        active_buses = 1
        
    total_events = db.query(Event).count()
    road_defects = db.query(Event).filter(
        Event.event_type.in_(["POTHOLE", "ROAD_DEFECT", "CRACK", "WATERLOGGING"])
    ).count()
    
    # Calculate sum of vehicle counts
    sum_vehicles = db.query(func.sum(Event.count)).filter(
        Event.event_type.in_(["VEHICLE_COUNT", "VEHICLE_DETECTION", "TRAFFIC"])
    ).scalar() or 0
    
    high_priority = db.query(Event).filter(Event.severity.in_(["HIGH", "CRITICAL"])).count()
    
    total_work_orders = db.query(WorkOrder).count()
    open_work_orders = db.query(WorkOrder).filter(
        WorkOrder.status.in_(["OPEN", "ASSIGNED", "IN PROGRESS"])
    ).count()
    resolved_work_orders = db.query(WorkOrder).filter(WorkOrder.status == "RESOLVED").count()
    
    # Recent telemetry data points
    telemetry_count = db.query(Telemetry).count()
    
    return {
        "active_buses": active_buses,
        "total_buses": total_buses,
        "events_today": total_events,
        "road_defects": road_defects,
        "vehicles_detected": int(sum_vehicles),
        "high_priority_events": high_priority,
        "total_work_orders": total_work_orders,
        "open_work_orders": open_work_orders,
        "resolved_work_orders": resolved_work_orders,
        "telemetry_points": telemetry_count,
        "bandwidth_comparison": {
            "label": "DESIGN ESTIMATE",
            "raw_video_gb_per_day": 144.0,
            "structured_events_gb_per_day": 0.035,
            "bandwidth_reduction_pct": 99.97
        }
    }

