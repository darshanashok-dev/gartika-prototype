import logging
import time
import uuid
import cv2
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import Response
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.event import Event
from backend.app.models.bus import Bus
from backend.app.config import settings
from backend.app.websocket import manager
from ai.pothole_detector import PotholeDetector
from ai.detector import VehicleDetector

router = APIRouter(prefix="/stream", tags=["stream"])
logger = logging.getLogger("gartika.stream")

# AI Detectors
pothole_detector = PotholeDetector(conf_threshold=settings.CONFIDENCE_THRESHOLD)
vehicle_detector = VehicleDetector(conf_threshold=0.35)

# Store the latest frame in memory for dashboard live preview
latest_frame_bytes: bytes = b""

@router.post("/frame")
async def upload_frame(
    bus_id: str = Form("BUS-101"),
    frame: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Receive live camera frame from mobile sensing unit,
    run real-time AI inference (pothole & vehicle detection),
    and broadcast detected events to the command center.
    """
    global latest_frame_bytes
    try:
        latest_frame_bytes = await frame.read()
        if not latest_frame_bytes:
            return {"status": "empty_frame"}

        # Decode frame for Computer Vision analysis
        nparr = np.frombuffer(latest_frame_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {"status": "ok", "bus_id": bus_id, "size": len(latest_frame_bytes)}

        # Get latest bus location from DB
        bus = db.query(Bus).filter(Bus.bus_id == bus_id).first()
        lat = bus.latitude if bus and bus.latitude else 12.971598
        lon = bus.longitude if bus and bus.longitude else 77.594562

        # 1. Run Real-Time Pothole Defect Detection
        defects = pothole_detector.detect(img)
        events_created = []

        if defects:
            for defect in defects:
                evt_code = uuid.uuid4().hex[:5].upper()
                evt_id = f"EVT-POTH-{evt_code}"
                
                # Annotate evidence frame with bounding box and timestamp
                annotated = img.copy()
                bx1, by1, bx2, by2 = defect["bbox"]
                cv2.rectangle(annotated, (bx1, by1), (bx2, by2), (0, 0, 255), 2)
                cv2.putText(
                    annotated,
                    f"POTHOLE ({int(defect['confidence']*100)}%)",
                    (bx1, max(15, by1 - 6)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.5,
                    (0, 0, 255),
                    2
                )
                
                # Save evidence file
                filename = f"{evt_id}_{int(time.time())}.jpg"
                save_path = settings.EVIDENCE_DIR / filename
                settings.EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
                cv2.imwrite(str(save_path), annotated)

                # Persist event in database
                db_event = Event(
                    event_id=evt_id,
                    bus_id=bus_id,
                    event_type="POTHOLE",
                    confidence=float(defect["confidence"]),
                    latitude=float(lat),
                    longitude=float(lon),
                    severity=defect["severity"],
                    evidence_path=f"/evidence/{filename}",
                    status="NEW",
                    timestamp=datetime.now(timezone.utc)
                )
                db.add(db_event)
                db.commit()
                db.refresh(db_event)

                # Broadcast live event over WebSocket
                event_dict = {
                    "id": db_event.id,
                    "event_id": db_event.event_id,
                    "bus_id": db_event.bus_id,
                    "event_type": db_event.event_type,
                    "confidence": db_event.confidence,
                    "latitude": db_event.latitude,
                    "longitude": db_event.longitude,
                    "severity": db_event.severity,
                    "evidence_image_url": db_event.evidence_path,
                    "timestamp": db_event.timestamp.isoformat()
                }
                await manager.broadcast({"type": "NEW_EVENT", "data": event_dict})
                events_created.append(evt_id)
                logger.info(f"[AI STREAM] Detected real pothole on {bus_id}: {evt_id}")

        # 2. Run Vehicle Detection
        vehicles = vehicle_detector.detect(img)
        if len(vehicles) >= 2:
            # Create a traffic flow event if multiple vehicles in frame
            v_code = uuid.uuid4().hex[:5].upper()
            v_evt_id = f"EVT-TRAF-{v_code}"
            v_event = Event(
                event_id=v_evt_id,
                bus_id=bus_id,
                event_type="VEHICLE_COUNT",
                count=len(vehicles),
                confidence=0.85,
                latitude=float(lat),
                longitude=float(lon),
                severity="LOW" if len(vehicles) < 5 else "MEDIUM",
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
                    "evidence_image_url": None,
                    "timestamp": v_event.timestamp.isoformat()
                }
            })

        return {
            "status": "ok",
            "bus_id": bus_id,
            "size": len(latest_frame_bytes),
            "defects_detected": len(defects),
            "vehicles_detected": len(vehicles),
            "events_created": events_created
        }
    except Exception as e:
        logger.error(f"Error handling live frame: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/latest-frame")
def get_latest_frame():
    """Retrieve the most recent frame as JPEG for dashboard live viewing."""
    global latest_frame_bytes
    if not latest_frame_bytes:
        raise HTTPException(status_code=404, detail="No active stream frame available")
    return Response(content=latest_frame_bytes, media_type="image/jpeg")
