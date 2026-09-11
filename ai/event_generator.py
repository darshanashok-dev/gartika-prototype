"""
Event Generator Module for Gartika Urban Intelligence.

This module converts raw Computer Vision detections and sensor readings into
structured, geo-tagged urban events (e.g. pothole alerts, traffic density events).
It handles spatiotemporal deduplication, privacy-preserving face blurring, and
annotated evidence image generation.
"""

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
    """
    Calculate the great-circle distance in meters between two GPS coordinates using the Haversine formula.
    
    Args:
        lat1: Latitude of point 1 in decimal degrees.
        lon1: Longitude of point 1 in decimal degrees.
        lat2: Latitude of point 2 in decimal degrees.
        lon2: Longitude of point 2 in decimal degrees.
        
    Returns:
        float: Distance between the two points in meters.
    """
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
    """
    Generates structured, privacy-compliant, deduplicated events from AI detections.
    
    Attributes:
        cooldown_seconds (float): Minimum time delay before a duplicate alert can fire at same spot.
        distance_threshold_meters (float): Distance radius within which events are considered identical.
        recent_events (list): In-memory buffer tracking recently created events for deduplication.
        evidence_dir (Path): Local filesystem directory where annotated evidence frames are stored.
    """
    def __init__(self, cooldown_seconds: float = 5.0, distance_threshold_meters: float = 20.0):
        """
        Initialize the EventGenerator.
        
        Args:
            cooldown_seconds: Cooldown window in seconds to prevent spamming duplicate events.
            distance_threshold_meters: Spatial threshold in meters for deduplication.
        """
        self.cooldown_seconds = cooldown_seconds
        self.distance_threshold_meters = distance_threshold_meters
        self.recent_events: List[Dict] = []
        self.evidence_dir = settings.EVIDENCE_DIR
        self.evidence_dir.mkdir(parents=True, exist_ok=True)

    def is_duplicate(self, event_type: str, lat: float, lon: float, current_time: float) -> bool:
        """
        Check if an identical event occurred within the cooldown time and distance threshold.
        
        Args:
            event_type: Type of event (e.g. 'POTHOLE', 'VEHICLE_COUNT').
            lat: Current GPS latitude.
            lon: Current GPS longitude.
            current_time: Timestamp in seconds.
            
        Returns:
            bool: True if duplicate event should be suppressed, False otherwise.
        """
        # Clean up stale items older than 30 seconds from recent events history
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
        """
        Apply privacy-preserving Gaussian blur over pedestrians to protect personal privacy.
        
        Args:
            frame: Camera image frame.
            detections: List of detected objects with class labels and bounding boxes.
            
        Returns:
            np.ndarray: Anonymized frame copy.
        """
        anon_frame = frame.copy()
        if detections:
            for det in detections:
                if det.get("class_name") in ["person"]:
                    x1, y1, x2, y2 = det["bbox"]
                    # Blur upper portion (head/face area) of pedestrian
                    head_h = int((y2 - y1) * 0.35)
                    head_roi = anon_frame[y1:y1 + head_h, x1:x2]
                    if head_roi.size > 0:
                        blurred = cv2.GaussianBlur(head_roi, (31, 31), 30)
                        anon_frame[y1:y1 + head_h, x1:x2] = blurred
        return anon_frame

    def save_evidence(self, frame: np.ndarray, bbox: Optional[List[int]], event_id: str, label: str, detections: Optional[List[Dict]] = None) -> str:
        """
        Annotate, watermark, and save evidence image to disk.
        
        Draws bounding boxes, defect labels, timestamp watermarks, and applies privacy
        blurring before saving JPEG evidence to the media folder.
        
        Args:
            frame: Raw camera frame.
            bbox: Bounding box [x1, y1, x2, y2] of defect to highlight.
            event_id: Unique event identifier string.
            label: Text label and confidence string to overlay.
            detections: Optional list of all detections for anonymization.
            
        Returns:
            str: Relative URL path (e.g. '/evidence/filename.jpg') for accessing the evidence.
        """
        anon_frame = self.anonymize_frame(frame, detections)
        
        # Draw bounding box and label banner on evidence
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
        """
        Generate a structured road defect event payload if not suppressed by deduplication.
        
        Args:
            defect: Defect dictionary with 'event_type', 'confidence', 'severity', 'bbox'.
            frame: Camera frame at the moment of detection.
            bus_id: Identifier of the reporting bus.
            lat: Current GPS latitude.
            lon: Current GPS longitude.
            detections: Optional list of other objects detected in frame.
            
        Returns:
            dict or None: Event dictionary ready for database insertion/API dispatch, or None if duplicate.
        """
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

        # Record in recent events for deduplication
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
        """
        Generate a periodic traffic density / vehicle count event.
        
        Args:
            tracked_vehicles: List of currently tracked vehicles in the scene.
            bus_id: Identifier of the reporting bus.
            lat: Current GPS latitude.
            lon: Current GPS longitude.
            
        Returns:
            dict or None: Traffic count event payload, or None if duplicate/empty.
        """
        now = time.time()
        if self.is_duplicate("VEHICLE_COUNT", lat, lon, now):
            return None

        count = len(tracked_vehicles)
        if count == 0:
            return None

        event_id = f"EVT-TRF-{uuid.uuid4().hex[:5].upper()}"
        
        # Determine dominant vehicle classification in the visual field
        classes = [v['class_name'] for v in tracked_vehicles]
        # Calculate average confidence of tracked objects
        confs = [v.get('confidence', 0.8) for v in tracked_vehicles if 'confidence' in v]
        avg_conf = round(float(np.mean(confs)), 3) if confs else 0.80
        
        event_data = {
            "event_id": event_id,
            "bus_id": bus_id,
            "event_type": "VEHICLE_COUNT",
            "confidence": avg_conf,
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
