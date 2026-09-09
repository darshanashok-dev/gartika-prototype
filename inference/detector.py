"""
Gartika Road Defect Inference Engine & Event Integration Layer.

Provides the RoadDefectDetector class for running inference on images and videos,
converting detections into standardized Gartika urban defect events, and performing
spatial/temporal deduplication so that a single pothole seen across dozens of video
frames produces a single actionable municipal event.
"""

import time
import math
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Dict, Union, Optional
import cv2
import numpy as np

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_MODEL_PATH = BASE_DIR / "models" / "gartika_road_defect.pt"

class TemporalDeduplicator:
    """
    Tracks detected road defects across consecutive video frames to prevent duplicate event spam.
    Uses spatial bounding-box overlap (IoU) and temporal cooldown windows.
    """
    def __init__(self, cooldown_seconds: float = 5.0, iou_threshold: float = 0.35):
        self.cooldown_seconds = cooldown_seconds
        self.iou_threshold = iou_threshold
        # Key: defect_track_id -> {"bbox": [x1,y1,x2,y2], "last_seen": timestamp, "event_id": str}
        self.active_tracks: Dict[str, Dict] = {}

    def compute_iou(self, boxA, boxB) -> float:
        xA = max(boxA[0], boxB[0])
        yA = max(boxA[1], boxB[1])
        xB = min(boxA[2], boxB[2])
        yB = min(boxA[3], boxB[3])

        interArea = max(0, xB - xA) * max(0, yB - yA)
        boxAArea = max(1, (boxA[2] - boxA[0]) * (boxA[3] - boxA[1]))
        boxBArea = max(1, (boxB[2] - boxB[0]) * (boxB[3] - boxB[1]))

        iou = interArea / float(boxAArea + boxBArea - interArea + 1e-5)
        return iou

    def should_create_event(self, bbox: List[int], event_type: str, now_ts: float) -> Optional[str]:
        """
        Check if detection corresponds to an existing defect track within the cooldown window.
        Returns newly generated event_id if unique, or None if duplicate.
        """
        # Purge stale tracks
        expired = [tid for tid, data in self.active_tracks.items() if (now_ts - data["last_seen"]) > self.cooldown_seconds]
        for tid in expired:
            del self.active_tracks[tid]

        # Match with active tracks
        for tid, data in self.active_tracks.items():
            if data["event_type"] == event_type and self.compute_iou(bbox, data["bbox"]) >= self.iou_threshold:
                # Update track position and timestamp (suppress event creation)
                data["bbox"] = bbox
                data["last_seen"] = now_ts
                return None

        # New unique defect identified
        new_event_id = f"EVT-{event_type[:4]}-{uuid.uuid4().hex[:5].upper()}"
        self.active_tracks[new_event_id] = {
            "bbox": bbox,
            "event_type": event_type,
            "last_seen": now_ts,
            "event_id": new_event_id
        }
        return new_event_id

class RoadDefectDetector:
    """
    High-performance Road Defect Detector with YOLOv8 inference and Gartika event formatting.
    """
    def __init__(self, model_path: Union[str, Path] = DEFAULT_MODEL_PATH, conf_threshold: float = 0.50):
        self.model_path = Path(model_path)
        self.conf_threshold = conf_threshold
        self.model = None
        self.deduplicator = TemporalDeduplicator(cooldown_seconds=5.0)
        self.load_model(self.model_path)

    def load_model(self, path: Path):
        """Load YOLO model weights (.pt or .onnx)."""
        from ultralytics import YOLO
        if not path.exists():
            raise FileNotFoundError(f"Model file not found at: {path}")
        self.model = YOLO(str(path))

    def predict(self, image_input: Union[str, Path, np.ndarray]) -> List[Dict]:
        """
        Run inference on an image file path or numpy BGR array.
        
        Returns:
            list of dict: [
                {
                    "class": "pothole",
                    "confidence": 0.91,
                    "bbox": [x1, y1, x2, y2],
                    "area": 4200
                }
            ]
        """
        if isinstance(image_input, (str, Path)):
            img = cv2.imread(str(image_input))
            if img is None:
                raise ValueError(f"Could not read image: {image_input}")
        else:
            img = image_input

        results = self.model.predict(img, conf=self.conf_threshold, verbose=False)
        detections = []

        for r in results:
            for box in r.boxes:
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                conf = round(float(box.conf[0]), 3)
                cls_id = int(box.cls[0])
                cls_name = self.model.names.get(cls_id, "pothole").lower()

                detections.append({
                    "class": cls_name,
                    "confidence": conf,
                    "bbox": [x1, y1, x2, y2],
                    "area": int((x2 - x1) * (y2 - y1))
                })

        return detections

    def predict_frame(self, frame: np.ndarray) -> List[Dict]:
        """Convenience alias for video stream frame prediction."""
        return self.predict(frame)

    def format_gartika_event(
        self,
        detection: Dict,
        bus_id: str = "BUS-101",
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        timestamp: Optional[datetime] = None,
        evidence_path: Optional[str] = None
    ) -> Dict:
        """
        Convert detection dictionary into standard Gartika urban defect JSON payload.
        Separates visual perception from GPS, bus ID, and timestamp metadata layers.
        """
        if timestamp is None:
            timestamp = datetime.now(timezone.utc)

        conf = detection.get("confidence", 0.85)
        area = detection.get("area", 5000)

        # Calculate severity based on footprint and confidence
        if area > 18000 or conf > 0.90:
            severity = "HIGH"
        elif area > 6000 or conf > 0.75:
            severity = "MEDIUM"
        else:
            severity = "LOW"

        evt_code = uuid.uuid4().hex[:5].upper()
        cls_prefix = detection["class"].upper()[:4]

        return {
            "event_id": f"EVT-{cls_prefix}-{evt_code}",
            "bus_id": bus_id,
            "event_type": detection["class"].upper(),
            "confidence": conf,
            "bounding_box": detection["bbox"],
            "latitude": latitude,
            "longitude": longitude,
            "severity": severity,
            "evidence_path": evidence_path,
            "timestamp": timestamp.isoformat()
        }
