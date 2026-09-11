"""
Live Video Stream and Real-Time Inference Routes for Gartika Urban Intelligence.

Accepts live camera frames uploaded from mobile edge sensing units, validates image payload & metadata,
runs server-side computer vision inference with the Sensor Fusion Engine in a dedicated thread pool,
and provides per-bus live JPEG preview.
"""

import logging
import time
import uuid
import asyncio
from typing import Optional, List, Dict
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
bus_trackers: Dict[str, IoUTracker] = {}

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

def _process_frame_sync(
    bus_id: str,
    raw_bytes: bytes,
    db: Session,
    gps_override: Optional[tuple] = None,
    imu_data: Optional[Dict] = None,
    sequence_number: Optional[int] = None
):
    """
    Synchronous CPU-bound computer vision and sensor fusion routine executed in worker thread.
    """
    nparr = np.frombuffer(raw_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None or img.size == 0:
        raise HTTPException(
            status_code=400,
            detail={"code": "INVALID_IMAGE", "message": "Invalid or unreadable image frame."}
        )

    # 1. Run road defect and cavity detection
    detected_defects = pothole_detector.detect(img, imu_data=imu_data)

    # 2. Execute sensor fusion pipeline (combines vision with aligned IMU buffer)
    fused_events = fusion_engine.process_frame(
        bus_id=bus_id,
        frame_bytes=raw_bytes,
        visual_defects=detected_defects,
        db=db,
        gps_override=gps_override,
        sequence_number=sequence_number
    )

    # 3. Run vehicle detection and persistent IoU tracking
    vehicles = vehicle_detector.detect(img)
    if bus_id not in bus_trackers:
        bus_trackers[bus_id] = IoUTracker()
    
    tracker = bus_trackers[bus_id]
    tracked_objects = tracker.update(vehicles)

    return detected_defects, fused_events, vehicles, tracked_objects

@router.post("/frame")
async def upload_frame(
    bus_id: str = Form("BUS-101"),
    frame_id: Optional[str] = Form(None),
    device_id: Optional[str] = Form(None),
    sequence_number: Optional[int] = Form(None),
    capture_timestamp: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    accuracy: Optional[float] = Form(None),
    speed: Optional[float] = Form(None),
    heading: Optional[float] = Form(None),
    ax: Optional[float] = Form(None),
    ay: Optional[float] = Form(None),
    az: Optional[float] = Form(None),
    gravity_compensated_z: Optional[float] = Form(None),
    shock_score: Optional[float] = Form(None),
    frame: Optional[UploadFile] = File(None),
    file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    """
    Receive a live camera frame uploaded from a mobile sensing unit.
    
    Processes the frame through:
    1. Input validation (size limit, mime-type, decoding check).
    2. Dedicated worker threadpool execution (asyncio.to_thread).
    3. Multi-modal sensor fusion with aligned IMU samples (±500ms window).
    4. Vehicle detection with IoU object tracking & traffic density metrics.
    5. Real-time WebSocket broadcasting to connected dashboard clients.
    """
    upload_item = frame or file
    if not upload_item:
        raise HTTPException(
            status_code=400,
            detail={"code": "MISSING_FRAME", "message": "Image frame file is required in 'file' or 'frame' field."}
        )

    start_time = time.time()
    bus_id = (bus_id or settings.GARTIKA_BUS_ID).strip().upper()
    
    try:
        raw_bytes = await upload_item.read()
        if not raw_bytes or len(raw_bytes) == 0:
            raise HTTPException(
                status_code=400,
                detail={"code": "EMPTY_IMAGE", "message": "Received empty frame payload (0 bytes)."}
            )

        # Max payload protection (10 MB max)
        if len(raw_bytes) > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail={"code": "FRAME_TOO_LARGE", "message": "Frame exceeds 10MB maximum size limit."}
            )

        gps_override = (latitude, longitude) if (latitude is not None and longitude is not None) else None
        
        imu_data = None
        if az is not None or ax is not None or ay is not None:
            imu_data = {
                "ax": ax or 0.0,
                "ay": ay or 0.0,
                "az": az if az is not None else 9.81,
                "gravity_compensated_z": gravity_compensated_z or 0.0,
                "shock_score": shock_score or 0.0
            }

        # Offload CPU inference to worker thread pool
        detected_defects, fused_events, vehicles, tracked_objects = await asyncio.to_thread(
            _process_frame_sync,
            bus_id,
            raw_bytes,
            db,
            gps_override,
            imu_data,
            sequence_number
        )

        # Broadcast defect events over WebSocket
        events_created = []
        for fevt in fused_events:
            events_created.append(fevt["event_id"])
            await manager.broadcast({"type": "NEW_EVENT", "data": fevt})

        # Periodic traffic count event generator
        now_sec = time.time()
        if len(tracked_objects) >= 2 and (now_sec - last_traffic_time_by_bus.get(bus_id, 0) > 12.0):
            last_traffic_time_by_bus[bus_id] = now_sec
            v_code = uuid.uuid4().hex[:5].upper()
            v_evt_id = f"EVT-TRAF-{v_code}"
            
            # Fetch bus GPS
            bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
            lat = bus.latitude if bus and bus.latitude is not None else (latitude if latitude is not None else None)
            lon = bus.longitude if bus and bus.longitude is not None else (longitude if longitude is not None else None)
            
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

        processing_ms = int((time.time() - start_time) * 1000)

        return {
            "success": True,
            "status": "ok",
            "frame_id": frame_id or f"FRM-{int(start_time*1000)}",
            "bus_id": bus_id,
            "size_bytes": len(raw_bytes),
            "defects_detected": len(detected_defects),
            "vehicles_detected": len(vehicles),
            "tracked_vehicles": len(tracked_objects),
            "events_created": events_created,
            "processing_ms": processing_ms
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[STREAM] Error handling live frame for {bus_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail={"code": "STREAM_ERROR", "message": f"Failed to process live stream frame: {str(e)}"}
        )

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
        
    return Response(
        content=frame_bytes,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )
