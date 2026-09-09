"""
Multi-Object Vehicle Tracker Module for Gartika Urban Intelligence.

This module provides object tracking capabilities using Intersection-over-Union (IoU)
and a ByteTrack-inspired hierarchical matching algorithm to maintain persistent IDs
for moving vehicles across video frames.
"""

import numpy as np
import logging

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

class TrackedObject:
    """
    Data container representing an active tracked vehicle.
    
    Attributes:
        track_id (int): Unique identifier assigned to this object track.
        bbox (list): Current bounding box coordinates [x1, y1, x2, y2].
        class_name (str): Classification label (e.g., 'car', 'bus', 'truck').
        confidence (float): Detection confidence score.
        misses (int): Number of consecutive frames this track was not detected.
        hits (int): Number of total frames this track was successfully matched.
        history (list): Historical sequence of bounding box positions.
    """
    def __init__(self, track_id: int, bbox: list, class_name: str, confidence: float):
        """
        Initialize a new tracked object state.
        """
        self.track_id = track_id
        self.bbox = bbox
        self.class_name = class_name
        self.confidence = confidence
        self.misses = 0
        self.hits = 1
        self.history = [bbox]

class ByteTracker:
    """
    ByteTrack-inspired multi-object tracker for persistent vehicle ID tracking across video frames.
    
    Maintains a pool of active tracks, matches them against incoming frame detections
    using spatial overlap (IoU), smooths trajectories with exponential moving averages,
    and purges stale tracks that disappear from view.
    """
    def __init__(self, max_lost_frames: int = 30, iou_threshold: float = 0.3):
        """
        Initialize the ByteTracker.
        
        Args:
            max_lost_frames: Maximum number of frames a lost track is kept alive before deletion.
            iou_threshold: Minimum IoU overlap required to match a detection to an existing track.
        """
        self.next_track_id = 1
        self.tracks = {}
        self.max_lost_frames = max_lost_frames
        self.iou_threshold = iou_threshold
        self.total_tracked_count = 0

    def update(self, detections: list) -> list:
        """
        Update tracking state with new detections from the current frame.
        
        Performs 3 steps:
        1. Matches existing tracks with high-confidence detections via IoU.
        2. Spawns new unique track IDs for unmatched detections.
        3. Increments misses for lost tracks and purges those exceeding max_lost_frames.
        
        Args:
            detections: List of detection dicts with keys 'bbox', 'class_name', 'confidence'.
            
        Returns:
            list of dict: Active tracked objects with updated positions and persistent 'track_id'.
        """
        updated_tracks = []
        
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
        
        # Sort detection indices by confidence descending
        sorted_det_indices = sorted(range(len(detections)), key=lambda i: detections[i]['confidence'], reverse=True)
        
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
                # Update existing matched track
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
                track.confidence = det['confidence']
                track.class_name = det['class_name']
                track.misses = 0
                track.hits += 1
                track.history.append(track.bbox)
                
                updated_tracks.append({
                    "track_id": track.track_id,
                    "bbox": track.bbox,
                    "class_name": track.class_name,
                    "confidence": track.confidence,
                    "hits": track.hits
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
                    class_name=det['class_name'],
                    confidence=det['confidence']
                )
                self.tracks[track_id] = new_track
                
                updated_tracks.append({
                    "track_id": track_id,
                    "bbox": det['bbox'],
                    "class_name": det['class_name'],
                    "confidence": det['confidence'],
                    "hits": 1
                })
                logger.debug(f"[TRACK] ID #{track_id} created for {det['class_name']}")

        # Step 3: Clean up lost tracks that have not been observed recently
        dead_tracks = []
        for track_id, track in self.tracks.items():
            if track_id not in matched_tracks and track.hits > 0:
                track.misses += 1
                if track.misses > self.max_lost_frames:
                    dead_tracks.append(track_id)
        for track_id in dead_tracks:
            del self.tracks[track_id]

        return updated_tracks
