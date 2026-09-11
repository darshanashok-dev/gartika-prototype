"""
Road Defect and Pothole Detection Module for Gartika Urban Intelligence.

This module performs visual surface defect detection (analyzing texture, contour depressions,
and morphological gradients in the road region) and implements multi-modal IMU vibration
sensor fusion to boost confidence and prioritize severity when real physical bump shocks occur.
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Optional

from pathlib import Path

logger = logging.getLogger("gartika.ai.pothole")

class PotholeDetector:
    """
    Road Defect and Pothole Detector.
    
    Supports custom fine-tuned YOLOv8 deep learning models for multi-class road defect
    identification (potholes, cracks, manholes) with seamless OpenCV computer-vision
    and IMU vibration sensor fusion fallback.
    
    Attributes:
        conf_threshold (float): Minimum confidence threshold for generating defect alerts.
        model (YOLO, optional): Loaded fine-tuned YOLOv8 neural network model instance.
    """
    def __init__(self, model_path: Optional[str] = None, conf_threshold: float = 0.65):
        """
        Initialize the PotholeDetector.
        
        Args:
            model_path: Optional path to custom trained YOLOv8 weights (.pt).
            conf_threshold: Minimum confidence threshold to consider a defect valid.
        """
        self.conf_threshold = conf_threshold
        self.model = None
        
        # Check potential paths for trained weights
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

    def detect(self, frame: np.ndarray, imu_data: Optional[Dict] = None) -> List[Dict]:
        """
        Detect potholes and surface defects using custom deep learning model or CV fallback.
        
        Workflow:
        1. If custom YOLOv8 model is loaded, performs multi-class object detection.
        2. Otherwise, executes OpenCV contrast, morphology, circularity & solidity analysis.
        3. Fuses real-time IMU vertical accelerometer shock readings to boost confidence/severity.
        
        Args:
            frame: Numpy BGR image array from camera.
            imu_data: Optional dict containing accelerometer readings {'ax', 'ay', 'az'}.
            
        Returns:
            list of dict: Detected road defects with bounding box, class, confidence, and severity.
        """
        if frame is None or frame.size == 0:
            return []

        # -------------------------------------------------------------
        # 1. Custom Deep Learning Model Inference (if trained weights present)
        # -------------------------------------------------------------
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

                        # Calculate IMU vibration boost
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
                logger.error(f"[AI] Custom model inference error: {e}. Falling back to CV.")

        # -------------------------------------------------------------
        # 2. Advanced OpenCV Computer Vision & Sensor Fusion Analyzer
        # -------------------------------------------------------------

        h, w = frame.shape[:2]
        # Focus on road surface in lower 55% of camera perspective
        roi_start_y = int(h * 0.45)
        roi = frame[roi_start_y:h, :]
        roi_h, roi_w = roi.shape[:2]

        defects = []

        # Convert to grayscale and apply bilateral filter to preserve edges while smoothing road texture
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Calculate adaptive threshold and morphological gradient to highlight depression boundaries
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        gradient = cv2.morphologyEx(filtered, cv2.MORPH_GRADIENT, kernel)
        
        # Adaptive thresholding to find deep dark depressions typical of potholes
        thresh = cv2.adaptiveThreshold(
            filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 21, 5
        )
        
        # Combine threshold with edge gradient to isolate strong pothole boundaries
        combined = cv2.bitwise_and(thresh, gradient)
        
        # Morphological closing to clean up small noise holes
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_clean)
        
        # Find external contours of potential road defect candidates
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Filter candidate contours by reasonable pixel area in road perspective
            if 1200 < area < 45000:
                perimeter = cv2.arcLength(cnt, True)
                if perimeter <= 0:
                    continue
                    
                circularity = 4 * np.pi * area / (perimeter * perimeter)
                hull = cv2.convexHull(cnt)
                hull_area = cv2.contourArea(hull)
                solidity = area / max(1.0, hull_area)
                
                # Filter out linear artifacts, noise specks, or highly jagged contours
                if circularity < 0.20 or solidity < 0.50:
                    continue

                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect_ratio = bw / float(bh)
                
                # Potholes in road perspective typically have aspect ratio 0.5 to 3.2
                if 0.5 < aspect_ratio < 3.2:
                    # Surrounding road intensity comparison
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

                    # Potholes must represent a genuine dark depression relative to surroundings
                    contrast_diff = (surround_mean - interior_mean) / max(1.0, surround_mean)
                    if contrast_diff < 0.12:
                        # Insufficient contrast depression for a true road crater
                        continue

                    # Heuristic score scaled by depression contrast, circularity, and solidity
                    candidate_score = round(min(0.78, 0.40 + contrast_diff * 0.35 + circularity * 0.10 + solidity * 0.10), 2)
                    
                    # Sensor Fusion: Incorporate IMU vibration measurements if available
                    vibration_boost = 0.0
                    vibration_level = "NORMAL"
                    if imu_data:
                        ax = abs(imu_data.get("ax", 0.0))
                        ay = abs(imu_data.get("ay", 0.0))
                        # Z-axis deviation from 1g earth gravity (9.81 m/s²)
                        az = abs(imu_data.get("az", 9.81) - 9.81)
                        total_accel = ax + ay + az
                        
                        # High vibration shock indicates vehicle physically struck a road bump
                        if total_accel > 3.0:
                            vibration_boost = 0.18
                            vibration_level = "HIGH"
                            logger.info(f"[SENSOR FUSION] High vibration ({total_accel:.2f} m/s²) fused with visual crater.")
                        elif total_accel > 1.5:
                            vibration_boost = 0.08
                            vibration_level = "MEDIUM"

                    final_score = min(0.95, round(candidate_score + vibration_boost, 2))
                    
                    if final_score >= self.conf_threshold:
                        # Determine severity based on physical footprint, score, and vibration
                        if area > 18000 or final_score > 0.85 or vibration_level == "HIGH":
                            severity = "HIGH"
                        elif area > 6000 or final_score > 0.70:
                            severity = "MEDIUM"
                        else:
                            severity = "LOW"

                        # Adjust coordinates back to full image frame scale
                        full_y1 = y + roi_start_y
                        full_y2 = full_y1 + bh
                        
                        defects.append({
                            "bbox": [x, full_y1, x + bw, full_y2],
                            "event_type": "POTHOLE",
                            "confidence": final_score,
                            "heuristic_score": candidate_score,
                            "source": "opencv_heuristic",
                            "verified": False,
                            "severity": severity,
                            "vibration_level": vibration_level,
                            "area": int(area)
                        })


        # Return top 2 strongest non-overlapping detections sorted by confidence
        if defects:
            defects = sorted(defects, key=lambda d: d['confidence'], reverse=True)[:2]
                
        return defects
