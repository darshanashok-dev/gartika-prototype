"""
Vehicle Detection Module for Gartika Urban Intelligence.

This module provides the VehicleDetector class, which detects urban transport
objects (cars, buses, trucks, motorcycles, bicycles, persons) from video frames
using YOLOv8 with an automatic OpenCV computer-vision contour fallback.
"""

import logging
import numpy as np
import cv2

logger = logging.getLogger("gartika.ai.detector")

# Mapping of COCO dataset class IDs to urban vehicle and pedestrian class names
TARGET_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

class VehicleDetector:
    """
    Detects vehicles and pedestrians in road camera frames.
    
    Attributes:
        conf_threshold (float): Minimum confidence score required to keep a detection.
        model (YOLO, optional): Loaded YOLOv8 neural network model instance.
        use_fallback (bool): Flag indicating whether to use the OpenCV contour fallback.
    """
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.40):
        """
        Initialize the VehicleDetector with model weights and confidence threshold.
        
        Args:
            model_path: Filepath or model name for YOLOv8 weights (default: yolov8n.pt).
            conf_threshold: Minimum confidence score to register a valid detection.
        """
        self.conf_threshold = conf_threshold
        self.model = None
        self.use_fallback = False
        
        try:
            from ultralytics import YOLO
            logger.info(f"[AI] Loading YOLOv8 model from {model_path}...")
            self.model = YOLO(model_path)
            logger.info("[AI] YOLOv8 model loaded successfully.")
        except Exception as e:
            logger.warning(f"[AI] Could not initialize YOLOv8 ({e}). Utilizing robust computer-vision fallback detector.")
            self.use_fallback = True

    def detect(self, frame: np.ndarray):
        """
        Run vehicle and urban object detection on a single image/frame.
        
        Executes YOLOv8 inference if available. If YOLO fails or is not installed,
        falls back to OpenCV edge contour and bounding-box aspect-ratio detection
        focused on the road region of interest (ROI).
        
        Args:
            frame: A BGR numpy array representing the camera image frame.
            
        Returns:
            list of dict: Detected objects with format:
                [
                    {
                        'bbox': [x1, y1, x2, y2],
                        'class_name': str,
                        'confidence': float,
                        'class_id': int
                    },
                    ...
                ]
        """
        if frame is None or frame.size == 0:
            return []

        detections = []
        h, w = frame.shape[:2]

        # Primary detection path: YOLOv8 Deep Neural Network
        if self.model is not None and not self.use_fallback:
            try:
                results = self.model(frame, conf=self.conf_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        
                        # Filter to our target urban transport classes (cars, buses, bikes, people)
                        if cls_id in TARGET_CLASSES:
                            coords = box.xyxy[0].cpu().numpy().astype(int)
                            x1, y1, x2, y2 = coords
                            # Clamp bounding box coordinates within image boundaries
                            x1, y1 = max(0, x1), max(0, y1)
                            x2, y2 = min(w, x2), min(h, y2)
                            
                            detections.append({
                                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                                "class_name": TARGET_CLASSES[cls_id],
                                "confidence": round(conf, 3),
                                "source": "yolo",
                                "verified": True,
                                "class_id": cls_id
                            })
                return detections
            except Exception as e:
                logger.warning(f"[AI] Error during YOLOv8 inference: {e}")

        # Fallback CV-based vehicle contour detection if YOLO is unavailable
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150)
        
        # Search road region (middle 40% to bottom 90% of frame)
        roi = edges[int(h * 0.4):int(h * 0.9), :]
        contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 1500 < area < 40000:
                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect_ratio = bw / float(bh)
                # Filter shapes matching vehicle aspect ratios
                if 0.6 < aspect_ratio < 2.5:
                    y_adj = y + int(h * 0.4)
                    # Compute candidate heuristic score based on geometric solidity & area
                    hull = cv2.convexHull(cnt)
                    solidity = area / max(1.0, cv2.contourArea(hull))
                    heuristic_score = round(min(0.72, 0.40 + solidity * 0.25), 2)
                    
                    detections.append({
                        "bbox": [x, y_adj, x + bw, y_adj + bh],
                        "class_name": "car" if aspect_ratio > 1.1 else "motorcycle",
                        "confidence": heuristic_score,
                        "heuristic_score": heuristic_score,
                        "source": "opencv_heuristic",
                        "verified": False,
                        "class_id": 2
                    })
        return detections

