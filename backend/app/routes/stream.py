"""
Live Video Stream and Real-Time Inference Routes for Gartika Urban Intelligence.

Accepts live camera frames uploaded from mobile edge sensing units, runs server-side
computer vision inference with the Sensor Fusion Engine, and provides per-bus live JPEG preview.
"""

import logging
import time
import uuid
from typing import Optional
import cv2
import numpy as np
from datetime import datetime, timezone
from fastapi import APIRouter, UploadFile, File, Form, Query, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.event import Event
from backend.app.models.bus import Bus
from backend.app.config import settings
from backend.app.websocket import manager
from backend.app.fusion.buffer import buffer_manager
from backend.app.fusion.engine import fusion_engine
from ai.pothole_detector import PotholeDetector
from ai.detector import VehicleDetector
from ai.tracker import IoUTracker

router = APIRouter(prefix="/stream", tags=["stream"])
logger = logging.getLogger("gartika.stream")

# AI Detectors
pothole_detector = PotholeDetector(conf_threshold=settings.CONFIDENCE_THRESHOLD)
vehicle_detector = VehicleDetector(conf_threshold=0.35)

# Per-bus vehicle trackers to maintain persistent vehicle IDs and unique traffic metrics
bus_trackers = {}

# Legacy backward-compatibility getter for latest frame bytes
def get_global_latest_frame():
    for bus_id in buffer_manager.list_active_buses():
        b = buffer_manager.get_latest_frame(bus_id)
        if b:
            return b
    return b""

class _LegacyFrameProxy:
    def __bool__(self):
        return bool(get_global_latest_frame())
    def __bytes__(self):
        return get_global_latest_frame()
    def __len__(self):
        return len(get_global_latest_frame())

latest_frame_bytes = _LegacyFrameProxy()

# Traffic event deduplication timers per bus
last_traffic_time_by_bus = {}

@router.post("/frame")
async def upload_frame(
    bus_id: str = Form("BUS-101"),
    frame: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Receive a live camera frame uploaded from a mobile sensing unit.
    
    Processes the frame through:
    1. Per-bus isolated frame buffering (prevents multi-vehicle state collisions).
    2. Computer vision road defect detection.
    3. Multi-modal sensor fusion with temporally-aligned IMU readings (±500ms window).
    4. Vehicle detection with IoU object tracking & traffic density metrics.
    5. Real-time WebSocket broadcasting.
    """
    bus_id = (bus_id or settings.GARTIKA_BUS_ID).strip().upper()
    try:
        raw_bytes = await frame.read()
        if not raw_bytes:
            return {"status": "empty_frame"}

        # Decode frame for CV inference
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"status": "ok", "bus_id": bus_id, "size": len(raw_bytes)}

        # 1. Run road defect detection
        detected_defects = pothole_detector.detect(img)

        # 2. Execute sensor fusion pipeline (combines vision with aligned IMU buffer)
        fused_events = fusion_engine.process_frame(
            bus_id=bus_id,
            frame_bytes=raw_bytes,
            visual_defects=detected_defects,
            db=db
        )

        # Broadcast any new/updated defect events over WebSocket
        events_created = []
        for fevt in fused_events:
            events_created.append(fevt["event_id"])
            await manager.broadcast({"type": "NEW_EVENT", "data": fevt})

        # 3. Run vehicle detection and persistent tracking
        vehicles = vehicle_detector.detect(img)
        if bus_id not in bus_trackers:
            bus_trackers[bus_id] = IoUTracker()
        
        tracker = bus_trackers[bus_id]
        tracked_objects = tracker.update(vehicles)

        now_sec = time.time()
        # Create periodic traffic density event if vehicles are tracked (minimum 12s cooldown)
        if len(tracked_objects) >= 2 and (now_sec - last_traffic_time_by_bus.get(bus_id, 0) > 12.0):
            last_traffic_time_by_bus[bus_id] = now_sec
            v_code = uuid.uuid4().hex[:5].upper()
            v_evt_id = f"EVT-TRAF-{v_code}"
            
            # Fetch bus GPS
            bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
            lat = bus.latitude if bus and bus.latitude is not None else None
            lon = bus.longitude if bus and bus.longitude is not None else None
            
            confs = [v.get("confidence", 0.75) for v in tracked_objects if "confidence" in v]
            avg_conf = round(float(np.mean(confs)), 3) if confs else 0.75

            v_event = Event(
                event_id=v_evt_id,
                bus_id=bus_id,
                event_type="VEHICLE_COUNT",
                count=len(tracked_objects),
                confidence=avg_conf,
                latitude=lat,
                longitude=lon,
                severity="LOW" if len(tracked_objects) < 5 else "MEDIUM",
                status="NEW",
                timestamp=datetime.now(timezone.utc)
            )
            db.add(v_event)
            db.commit()
            db.refresh(v_event)

            await manager.broadcast({
                "type": "NEW_EVENT",
                "data": {
                    "id": v_event.id,
                    "event_id": v_event.event_id,
                    "bus_id": v_event.bus_id,
                    "event_type": v_event.event_type,
                    "confidence": v_event.confidence,
                    "latitude": v_event.latitude,
                    "longitude": v_event.longitude,
                    "severity": v_event.severity,
                    "count": v_event.count,
                    "evidence_image_url": None,
                    "timestamp": v_event.timestamp.isoformat()
                }
            })

        return {
            "status": "ok",
            "bus_id": bus_id,
            "size": len(raw_bytes),
            "defects_detected": len(detected_defects),
            "vehicles_detected": len(vehicles),
            "tracked_vehicles": len(tracked_objects),
            "events_created": events_created
        }
    except Exception as e:
        logger.error(f"[STREAM] Error handling live frame for {bus_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest-frame")
def get_latest_frame(bus_id: Optional[str] = Query(None)):
    """
    Retrieve the most recent camera frame as raw image/jpeg for live dashboard preview.
    Supports specific bus querying or falls back to any active vehicle.
    """
    frame_bytes = None
    if bus_id:
        frame_bytes = buffer_manager.get_latest_frame(bus_id)
    
    if not frame_bytes:
        # Fallback to any active bus
        for bid in buffer_manager.list_active_buses():
            fb = buffer_manager.get_latest_frame(bid)
            if fb:
                frame_bytes = fb
                break

    if not frame_bytes:
        return Response(status_code=204)
        
    return Response(content=frame_bytes, media_type="image/jpeg")
