"""
Multi-Object Vehicle Tracker Module for Gartika Urban Intelligence.

This module provides object tracking capabilities using Intersection-over-Union (IoU)
and a ByteTrack-inspired hierarchical matching algorithm to maintain persistent IDs
for moving vehicles across video frames.
"""

import time
import logging
from typing import Optional, Dict, Any, List
import numpy as np

logger = logging.getLogger("gartika.ai.tracker")


def calculate_iou(boxA, boxB):
    """
    Calculate Intersection-over-Union (IoU) between two bounding boxes.
    
    IoU is computed as the area of overlap divided by the area of union.
    A score of 1.0 means perfect overlap, while 0.0 indicates no overlap.
    
    Args:
        boxA: Bounding box coordinates [x1, y1, x2, y2].
        boxB: Bounding box coordinates [x1, y1, x2, y2].
        
    Returns:
        float: IoU overlap value between 0.0 and 1.0.
    """
    # Determine the coordinates of the intersection rectangle
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    # Compute the area of intersection
    interArea = max(0, xB - xA) * max(0, yB - yA)
    
    # Compute the individual areas of both bounding boxes
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    # Compute IoU (with small epsilon to avoid division by zero)
    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou

import time

class TrackedObject:
    """
    Data container representing an active tracked vehicle.
    
    Attributes:
        track_id (int): Unique persistent identifier assigned to this object track.
        bbox (list): Current bounding box coordinates [x1, y1, x2, y2].
        class_name (str): Classification label (e.g., 'car', 'bus', 'truck', 'motorcycle').
        confidence (float): Detection confidence score.
        misses (int): Number of consecutive frames this track was not detected.
        hits (int): Number of total frames this track was successfully matched.
        history (list): Historical sequence of bounding box positions.
        trajectory (list): Sequence of center-point coordinates [(cx, cy), ...].
        first_seen (float): Timestamp when vehicle first entered scene.
        last_seen (float): Timestamp of most recent detection.
        counted (bool): Whether this vehicle has crossed virtual counting line.
    """
    def __init__(self, track_id: int, bbox: list, class_name: str, confidence: float):
        self.track_id = track_id
        self.bbox = bbox
        self.class_name = class_name
        self.confidence = confidence
        self.misses = 0
        self.hits = 1
        self.history = [bbox]
        cx = (bbox[0] + bbox[2]) // 2
        cy = (bbox[1] + bbox[3]) // 2
        self.trajectory = [(cx, cy)]
        self.first_seen = time.time()
        self.last_seen = self.first_seen
        self.counted = False

class IoUTracker:
    """
    Multi-Object Vehicle Tracker using spatial overlap (IoU) and trajectory smoothing.
    
    Maintains persistent IDs for moving vehicles across video frames, tracks trajectories,
    supports virtual-line traffic counting to prevent double counting, and computes
    calibrated traffic flow rates (vehicles/min, cars/min, buses/min, trucks/min).
    """
    def __init__(
        self,
        max_lost_frames: int = 30,
        iou_threshold: float = 0.3,
        count_line_y: Optional[int] = None
    ):
        """
        Initialize the IoUTracker.
        
        Args:
            max_lost_frames: Maximum frames a lost track is retained before deletion.
            iou_threshold: Minimum IoU overlap required to match a detection to an existing track.
            count_line_y: Optional vertical pixel coordinate for virtual counting line.
        """
        self.next_track_id = 1
        self.tracks: Dict[int, TrackedObject] = {}
        self.max_lost_frames = max_lost_frames
        self.iou_threshold = iou_threshold
        self.count_line_y = count_line_y
        self.total_tracked_count = 0
        self.counted_vehicles_total = 0
        self.counted_by_class = {"car": 0, "bus": 0, "truck": 0, "motorcycle": 0, "person": 0}
        self.start_time = time.time()

    def update(self, detections: list) -> list:
        """
        Update tracking state with new detections from the current frame.
        """
        updated_tracks = []
        now_ts = time.time()
        
        # If no detections in current frame, age all existing tracks
        if len(detections) == 0:
            dead_tracks = []
            for track_id, track in self.tracks.items():
                track.misses += 1
                if track.misses > self.max_lost_frames:
                    dead_tracks.append(track_id)
            for track_id in dead_tracks:
                del self.tracks[track_id]
            return []

        # Step 1: Match existing tracks with highest confidence detections first
        matched_tracks = set()
        matched_dets = set()
        
        sorted_det_indices = sorted(range(len(detections)), key=lambda i: detections[i].get('confidence', 0.5), reverse=True)
        
        for det_idx in sorted_det_indices:
            det = detections[det_idx]
            best_iou = 0.0
            best_track_id = None
            
            for track_id, track in self.tracks.items():
                if track_id in matched_tracks:
                    continue
                iou = calculate_iou(det['bbox'], track.bbox)
                if iou > best_iou and iou >= self.iou_threshold:
                    best_iou = iou
                    best_track_id = track_id
                    
            if best_track_id is not None:
                matched_tracks.add(best_track_id)
                matched_dets.add(det_idx)
                
                track = self.tracks[best_track_id]
                # Smooth bounding box with Exponential Moving Average (70% new, 30% historical)
                track.bbox = [
                    int(0.7 * det['bbox'][0] + 0.3 * track.bbox[0]),
                    int(0.7 * det['bbox'][1] + 0.3 * track.bbox[1]),
                    int(0.7 * det['bbox'][2] + 0.3 * track.bbox[2]),
                    int(0.7 * det['bbox'][3] + 0.3 * track.bbox[3])
                ]
                track.confidence = det.get('confidence', track.confidence)
                track.class_name = det.get('class_name', track.class_name)
                track.misses = 0
                track.hits += 1
                track.last_seen = now_ts
                track.history.append(track.bbox)
                
                cx = (track.bbox[0] + track.bbox[2]) // 2
                cy = (track.bbox[1] + track.bbox[3]) // 2
                
                # Check virtual line crossing
                if self.count_line_y is not None and not track.counted and len(track.trajectory) > 1:
                    prev_cy = track.trajectory[-1][1]
                    if (prev_cy < self.count_line_y <= cy) or (prev_cy > self.count_line_y >= cy):
                        track.counted = True
                        self.counted_vehicles_total += 1
                        cls_key = track.class_name.lower()
                        self.counted_by_class[cls_key] = self.counted_by_class.get(cls_key, 0) + 1
                        logger.info(f"[TRAFFIC COUNT] Vehicle #{track.track_id} ({track.class_name}) crossed virtual line. Total: {self.counted_vehicles_total}")

                track.trajectory.append((cx, cy))
                
                updated_tracks.append({
                    "track_id": track.track_id,
                    "bbox": track.bbox,
                    "class_name": track.class_name,
                    "confidence": track.confidence,
                    "hits": track.hits,
                    "trajectory": track.trajectory,
                    "counted": track.counted
                })

        # Step 2: For unmatched detections, create new tracks with fresh IDs
        for det_idx, det in enumerate(detections):
            if det_idx not in matched_dets:
                track_id = self.next_track_id
                self.next_track_id += 1
                self.total_tracked_count += 1
                
                new_track = TrackedObject(
                    track_id=track_id,
                    bbox=det['bbox'],
                    class_name=det.get('class_name', 'car'),
                    confidence=det.get('confidence', 0.7)
                )
                self.tracks[track_id] = new_track
                
                updated_tracks.append({
                    "track_id": track_id,
                    "bbox": det['bbox'],
                    "class_name": new_track.class_name,
                    "confidence": new_track.confidence,
                    "hits": 1,
                    "trajectory": new_track.trajectory,
                    "counted": False
                })

        # Step 3: Clean up lost tracks
        dead_tracks = []
        for track_id, track in self.tracks.items():
            if track_id not in matched_tracks and track.hits > 0:
                track.misses += 1
                if track.misses > self.max_lost_frames:
                    dead_tracks.append(track_id)
        for track_id in dead_tracks:
            del self.tracks[track_id]

        return updated_tracks

    def get_traffic_metrics(self) -> Dict[str, Any]:
        """
        Calculate vehicle flow rates and classification distributions.
        """
        elapsed_min = max(0.1, (time.time() - self.start_time) / 60.0)
        unique_tracked = self.total_tracked_count
        active_now = len(self.tracks)
        
        vehicles_per_min = round(unique_tracked / elapsed_min, 1)
        cars_per_min = round(self.counted_by_class.get("car", 0) / elapsed_min, 1)
        buses_per_min = round(self.counted_by_class.get("bus", 0) / elapsed_min, 1)
        trucks_per_min = round(self.counted_by_class.get("truck", 0) / elapsed_min, 1)
        bikes_per_min = round(self.counted_by_class.get("motorcycle", 0) / elapsed_min, 1)

        return {
            "active_vehicles_in_frame": active_now,
            "total_unique_vehicles_tracked": unique_tracked,
            "virtual_line_counted_total": self.counted_vehicles_total,
            "vehicles_per_minute": vehicles_per_min,
            "cars_per_minute": cars_per_min,
            "buses_per_minute": buses_per_min,
            "trucks_per_minute": trucks_per_min,
            "motorcycles_per_minute": bikes_per_min,
            "counts_by_class": self.counted_by_class
        }

# Alias for backwards compatibility with earlier code references
ByteTracker = IoUTracker

