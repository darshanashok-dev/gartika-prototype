import numpy as np
import logging

logger = logging.getLogger("gartika.ai.tracker")

def calculate_iou(boxA, boxB):
    # box format: [x1, y1, x2, y2]
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = (boxA[2] - boxA[0]) * (boxA[3] - boxA[1])
    boxBArea = (boxB[2] - boxB[0]) * (boxB[3] - boxB[1])

    iou = interArea / float(boxAArea + boxBArea - interArea + 1e-6)
    return iou

class TrackedObject:
    def __init__(self, track_id: int, bbox: list, class_name: str, confidence: float):
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
    """
    def __init__(self, max_lost_frames: int = 30, iou_threshold: float = 0.3):
        self.next_track_id = 1
        self.tracks = {}
        self.max_lost_frames = max_lost_frames
        self.iou_threshold = iou_threshold
        self.total_tracked_count = 0

    def update(self, detections: list) -> list:
        """
        Updates tracks with new detections.
        detections: list of {'bbox': [x1, y1, x2, y2], 'class_name': str, 'confidence': float}
        Returns: list of dicts with 'track_id', 'bbox', 'class_name', 'confidence'
        """
        updated_tracks = []
        
        if len(detections) == 0:
            # Increment misses for all active tracks
            dead_tracks = []
            for track_id, track in self.tracks.items():
                track.misses += 1
                if track.misses > self.max_lost_frames:
                    dead_tracks.append(track_id)
            for track_id in dead_tracks:
                del self.tracks[track_id]
            return []

        # Match existing tracks with high confidence detections first (ByteTrack principle)
        matched_tracks = set()
        matched_dets = set()
        
        # Sort detections by confidence descending
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
                # Update existing track
                matched_tracks.add(best_track_id)
                matched_dets.add(det_idx)
                
                track = self.tracks[best_track_id]
                # Smooth bbox
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

        # For unmatched detections, create new tracks
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

        # Clean up lost tracks
        dead_tracks = []
        for track_id, track in self.tracks.items():
            if track_id not in matched_tracks and track.hits > 0:
                track.misses += 1
                if track.misses > self.max_lost_frames:
                    dead_tracks.append(track_id)
        for track_id in dead_tracks:
            del self.tracks[track_id]

        return updated_tracks
