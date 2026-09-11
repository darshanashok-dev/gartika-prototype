"""
Gartika Road Defect and Pothole Detection Module.
=================================================

Purpose
-------
Visual road distress detection combining custom YOLOv8 deep learning models
with an OpenCV morphological contour heuristic fallback. Integrates real-time
IMU vertical accelerometer shock readings to prioritize severity and boost confidence.

Architecture Position
---------------------
Camera Frame Ingestion
        ↓
PotholeDetector (this module)
        ↓
SensorFusionEngine
        ↓
RoadDefect / Observation

Inputs
------
- Camera frame (np.ndarray BGR image)
- Optional IMU data dict ({'ax', 'ay', 'az'})

Outputs
-------
- List of defect candidate dictionaries containing bounding box, confidence,
  heuristic score, severity, and vibration level.
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Optional
from pathlib import Path

logger = logging.getLogger("gartika.ai.pothole")


class PotholeDetector:
    """
    Dual-Engine Road Defect and Pothole Detector.
    
    Supports fine-tuned YOLOv8 neural network inference with seamless
    OpenCV computer vision fallback and IMU shock corroboration.
    """
    def __init__(self, model_path: Optional[str] = None, conf_threshold: float = 0.65):
        """
        Initialize PotholeDetector.
        
        Args:
            model_path: Optional filesystem path to YOLOv8 weights (.pt).
            conf_threshold: Minimum confidence threshold for valid detections.
        """
        self.conf_threshold = conf_threshold
        self.model = None
        
        candidates = []
        if model_path:
            candidates.append(Path(model_path))
        candidates.extend([
            Path(__file__).resolve().parent / "models" / "pothole_yolov8.pt",
            Path(__file__).resolve().parent / "models" / "best.pt",
            Path("ai/models/pothole_yolov8.pt")
        ])

        for p in candidates:
            if p.exists():
                try:
                    from ultralytics import YOLO
                    logger.info(f"[AI] Loading custom trained road defect model from {p}...")
                    self.model = YOLO(str(p))
                    logger.info(f"[AI] Custom road defect model loaded with classes: {self.model.names}")
                    break
                except Exception as e:
                    logger.warning(f"[AI] Could not load custom weights from {p}: {e}")

    def detect(self, frame: Optional[np.ndarray], imu_data: Optional[Dict] = None) -> List[Dict]:
        """
        Detect potholes and surface defects using YOLO or OpenCV fallback.
        
        Args:
            frame: Numpy BGR image array from front windshield camera.
            imu_data: Optional dict containing accelerometer readings {'ax', 'ay', 'az'}.
            
        Returns:
            list of dict: Detected road defects.
        """
        if frame is None or not isinstance(frame, np.ndarray) or frame.size == 0:
            return []

        # 1. Custom Deep Learning Model Inference (if weights loaded)
        if self.model is not None:
            try:
                results = self.model(frame, conf=self.conf_threshold, verbose=False)
                defects = []
                for r in results:
                    for box in r.boxes:
                        x1, y1, x2, y2 = box.xyxy[0].tolist()
                        conf = float(box.conf[0])
                        cls_id = int(box.cls[0])
                        cls_name = self.model.names.get(cls_id, "POTHOLE").upper()

                        # IMU vibration boost
                        vibration_boost = 0.0
                        vibration_level = "NORMAL"
                        if imu_data:
                            az = abs(imu_data.get("az", 9.81) - 9.81)
                            total_accel = abs(imu_data.get("ax", 0.0)) + abs(imu_data.get("ay", 0.0)) + az
                            if total_accel > 3.0:
                                vibration_boost = 0.15
                                vibration_level = "HIGH"
                            elif total_accel > 1.5:
                                vibration_boost = 0.07
                                vibration_level = "MEDIUM"

                        final_conf = min(0.99, conf + vibration_boost)
                        severity = "HIGH" if (final_conf > 0.85 or vibration_level == "HIGH") else ("MEDIUM" if final_conf > 0.70 else "LOW")

                        defects.append({
                            "bbox": [int(x1), int(y1), int(x2), int(y2)],
                            "event_type": cls_name,
                            "confidence": round(float(final_conf), 2),
                            "model_confidence": round(float(conf), 2),
                            "heuristic_score": None,
                            "source": "yolo",
                            "verified": False,
                            "severity": severity,
                            "vibration_level": vibration_level,
                            "area": int((x2 - x1) * (y2 - y1))
                        })
                return defects
            except Exception as e:
                logger.warning(f"[AI] YOLO inference error: {e}. Falling back to OpenCV analysis.")

        # 2. Advanced OpenCV Computer Vision & Morphological Analyzer
        try:
            h, w = frame.shape[:2]
            if h < 20 or w < 20:
                return []

            # Focus on road surface in lower 55% of camera perspective
            roi_start_y = int(h * 0.45)
            roi = frame[roi_start_y:h, :]
            roi_h, roi_w = roi.shape[:2]

            defects = []

            # Grayscale & bilateral smoothing
            gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
            filtered = cv2.bilateralFilter(gray, 9, 75, 75)
            
            # Morphological gradient to isolate depression boundaries
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
            gradient = cv2.morphologyEx(filtered, cv2.MORPH_GRADIENT, kernel)
            
            # Adaptive thresholding for dark crater extraction
            thresh = cv2.adaptiveThreshold(
                filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY_INV, 21, 5
            )
            
            combined = cv2.bitwise_and(thresh, gradient)
            kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
            closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_clean)
            
            contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for cnt in contours:
                area = cv2.contourArea(cnt)
                if 1200 < area < 45000:
                    perimeter = cv2.arcLength(cnt, True)
                    if perimeter <= 0:
                        continue
                        
                    circularity = 4 * np.pi * area / (perimeter * perimeter)
                    hull = cv2.convexHull(cnt)
                    hull_area = cv2.contourArea(hull)
                    solidity = area / max(1.0, hull_area)
                    
                    if circularity < 0.20 or solidity < 0.50:
                        continue

                    x, y, bw, bh = cv2.boundingRect(cnt)
                    aspect_ratio = bw / float(bh)
                    
                    if 0.5 < aspect_ratio < 3.2:
                        pad = 20
                        sy1, sy2 = max(0, y - pad), min(roi_h, y + bh + pad)
                        sx1, sx2 = max(0, x - pad), min(roi_w, x + bw + pad)
                        surround_roi = gray[sy1:sy2, sx1:sx2]
                        surround_mean = float(np.mean(surround_roi)) if surround_roi.size > 0 else 128.0

                        mask = np.zeros((bh, bw), dtype=np.uint8)
                        cnt_local = cnt - [x, y]
                        cv2.drawContours(mask, [cnt_local], -1, 255, -1)
                        cnt_roi = gray[y:y+bh, x:x+bw]
                        interior_mean = float(cv2.mean(cnt_roi, mask=mask)[0]) if mask.size > 0 else surround_mean

                        contrast_diff = (surround_mean - interior_mean) / max(1.0, surround_mean)
                        if contrast_diff < 0.12:
                            continue

                        candidate_score = round(min(0.78, 0.40 + contrast_diff * 0.35 + circularity * 0.10 + solidity * 0.10), 2)
                        
                        vibration_boost = 0.0
                        vibration_level = "NORMAL"
                        if imu_data:
                            ax = abs(imu_data.get("ax", 0.0))
                            ay = abs(imu_data.get("ay", 0.0))
                            az = abs(imu_data.get("az", 9.81) - 9.81)
                            total_accel = ax + ay + az
                            
                            if total_accel > 3.0:
                                vibration_boost = 0.18
                                vibration_level = "HIGH"
                            elif total_accel > 1.5:
                                vibration_boost = 0.08
                                vibration_level = "MEDIUM"

                        final_score = min(0.95, round(candidate_score + vibration_boost, 2))
                        
                        if final_score >= self.conf_threshold:
                            if area > 18000 or final_score > 0.85 or vibration_level == "HIGH":
                                severity = "HIGH"
                            elif area > 6000 or final_score > 0.70:
                                severity = "MEDIUM"
                            else:
                                severity = "LOW"

                            full_y1 = y + roi_start_y
                            full_y2 = full_y1 + bh
                            
                            defects.append({
                                "bbox": [x, full_y1, x + bw, full_y2],
                                "event_type": "POTHOLE",
                                "confidence": final_score,
                                "heuristic_score": candidate_score,
                                "model_confidence": None,
                                "source": "opencv_heuristic",
                                "verified": False,
                                "severity": severity,
                                "vibration_level": vibration_level,
                                "area": int(area)
                            })

            if defects:
                defects = sorted(defects, key=lambda d: d['confidence'], reverse=True)[:2]
                    
            return defects
        except Exception as e:
            logger.warning(f"[AI] OpenCV heuristic detection error on frame: {e}")
            return []
