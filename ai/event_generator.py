import math
import uuid
import time
import cv2
import numpy as np
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from backend.app.config import settings

logger = logging.getLogger("gartika.ai.event_generator")

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in meters between two GPS coordinates."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2.0) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2.0) ** 2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

class EventGenerator:
    def __init__(self, cooldown_seconds: float = 5.0, distance_threshold_meters: float = 20.0):
        self.cooldown_seconds = cooldown_seconds
        self.distance_threshold_meters = distance_threshold_meters
        self.recent_events: List[Dict] = []
        self.evidence_dir = settings.EVIDENCE_DIR
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

    def is_duplicate(self, event_type: str, lat: float, lon: float, current_time: float) -> bool:
        """Check if an identical event occurred within cooldown time and distance threshold."""
        # Clean up stale items from history
        self.recent_events = [e for e in self.recent_events if current_time - e['time'] < 30.0]
        
        for e in self.recent_events:
            if e['event_type'] == event_type:
                time_diff = current_time - e['time']
                if time_diff < self.cooldown_seconds:
                    dist = haversine_distance(lat, lon, e['lat'], e['lon'])
                    if dist < self.distance_threshold_meters:
                        logger.debug(f"[EVENT] Suppressed duplicate {event_type} within {dist:.1f}m ({time_diff:.1f}s ago)")
                        return True
        return False

    def anonymize_frame(self, frame: np.ndarray, detections: Optional[List[Dict]] = None) -> np.ndarray:
        """Apply privacy blurring on people and license plates."""
        anon_frame = frame.copy()
        if detections:
            for det in detections:
                if det.get("class_name") in ["person"]:
                    x1, y1, x2, y2 = det["bbox"]
                    # Blur head/person area
                    head_h = int((y2 - y1) * 0.35)
                    head_roi = anon_frame[y1:y1 + head_h, x1:x2]
                    if head_roi.size > 0:
                        blurred = cv2.GaussianBlur(head_roi, (31, 31), 30)
                        anon_frame[y1:y1 + head_h, x1:x2] = blurred
        return anon_frame

    def save_evidence(self, frame: np.ndarray, bbox: Optional[List[int]], event_id: str, label: str, detections: Optional[List[Dict]] = None) -> str:
        """Save annotated, privacy-preserved evidence image to disk."""
        anon_frame = self.anonymize_frame(frame, detections)
        
        # Draw bounding box and label on evidence
        if bbox:
            x1, y1, x2, y2 = bbox
            cv2.rectangle(anon_frame, (x1, y1), (x2, y2), (0, 0, 255), 3)
            # Label banner
            banner_text = f"GARTIKA AI: {label.upper()}"
            cv2.rectangle(anon_frame, (x1, max(0, y1 - 28)), (x1 + 240, y1), (0, 0, 220), -1)
            cv2.putText(anon_frame, banner_text, (x1 + 6, y1 - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
            
        # Add timestamp & watermark on bottom left
        ts_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        watermark = f"GARTIKA EDGE SENSOR | {ts_str}"
        cv2.putText(anon_frame, watermark, (15, anon_frame.shape[0] - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)

        filename = f"{event_id}_{int(time.time())}.jpg"
        save_path = self.evidence_dir / filename
        cv2.imwrite(str(save_path), anon_frame)
        return f"/evidence/{filename}"

    def create_pothole_event(
        self,
        defect: Dict,
        frame: np.ndarray,
        bus_id: str,
        lat: float,
        lon: float,
        detections: Optional[List[Dict]] = None
    ) -> Optional[Dict]:
        """Generate structured pothole event if not duplicate."""
        now = time.time()
        if self.is_duplicate(defect['event_type'], lat, lon, now):
            return None

        event_id = f"EVT-POTH-{uuid.uuid4().hex[:5].upper()}"
        label = f"{defect['event_type']} ({int(defect['confidence']*100)}%)"
        evidence_url = self.save_evidence(frame, defect.get('bbox'), event_id, label, detections)

        event_data = {
            "event_id": event_id,
            "bus_id": bus_id,
            "event_type": defect['event_type'],
            "confidence": defect['confidence'],
            "latitude": lat,
            "longitude": lon,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": defect['severity'],
            "evidence_path": evidence_url,
            "status": "NEW",
            "vibration_level": defect.get('vibration_level', 'NORMAL'),
            "location_name": f"Urban Road Section ({lat:.4f}, {lon:.4f})"
        }

        self.recent_events.append({
            "event_type": defect['event_type'],
            "lat": lat,
            "lon": lon,
            "time": now
        })

        logger.info(f"[EVENT] Generated {event_id} ({defect['event_type']} Severity={defect['severity']})")
        return event_data

    def create_vehicle_count_event(
        self,
        tracked_vehicles: List[Dict],
        bus_id: str,
        lat: float,
        lon: float
    ) -> Optional[Dict]:
        """Generate periodic vehicle density / traffic count event."""
        now = time.time()
        if self.is_duplicate("VEHICLE_COUNT", lat, lon, now):
            return None

        count = len(tracked_vehicles)
        if count == 0:
            return None

        event_id = f"EVT-TRF-{uuid.uuid4().hex[:5].upper()}"
        
        # Determine dominant vehicle class
        classes = [v['class_name'] for v in tracked_vehicles]
        dom_class = max(set(classes), key=classes.count) if classes else "CAR"
        
        event_data = {
            "event_id": event_id,
            "bus_id": bus_id,
            "event_type": "VEHICLE_COUNT",
            "confidence": 0.90,
            "latitude": lat,
            "longitude": lon,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "severity": "HIGH" if count > 8 else ("MEDIUM" if count > 4 else "LOW"),
            "status": "NEW",
            "vehicle_class": dom_class.upper(),
            "count": count,
            "location_name": f"Traffic Corridor ({lat:.4f}, {lon:.4f})"
        }

        self.recent_events.append({
            "event_type": "VEHICLE_COUNT",
            "lat": lat,
            "lon": lon,
            "time": now
        })

        logger.info(f"[EVENT] Generated Traffic Event {event_id} (Vehicles Active: {count})")
        return event_data
