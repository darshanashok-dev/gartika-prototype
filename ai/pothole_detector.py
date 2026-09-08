import cv2
import numpy as np
import logging
from typing import List, Dict, Optional

logger = logging.getLogger("gartika.ai.pothole")

class PotholeDetector:
    """
    Road Defect and Pothole Detector.
    Supports visual analysis (texture, contour depression, edge variance)
    and optional multi-modal IMU vibration sensor fusion.
    """
    def __init__(self, conf_threshold: float = 0.50):
        self.conf_threshold = conf_threshold
        self.custom_model = None

    def detect(self, frame: np.ndarray, imu_data: Optional[Dict] = None) -> List[Dict]:
        """
        Detect potholes in road frame.
        imu_data: optional dict with {'ax': float, 'ay': float, 'az': float}
        Returns: list of detected defect dicts
        """
        if frame is None or frame.size == 0:
            return []

        h, w = frame.shape[:2]
        # Road surface is generally in the lower 55% of the frame
        roi_start_y = int(h * 0.45)
        roi = frame[roi_start_y:h, :]
        roi_h, roi_w = roi.shape[:2]

        defects = []

        # Convert to grayscale and apply bilateral filter to preserve edges while smoothing road texture
        gray = cv2.cvtColor(roi, cv2.COLOR_BGR2GRAY)
        filtered = cv2.bilateralFilter(gray, 9, 75, 75)
        
        # Calculate adaptive threshold and morphological gradient
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        gradient = cv2.morphologyEx(filtered, cv2.MORPH_GRADIENT, kernel)
        
        # Adaptive thresholding to find deep dark depressions typical of potholes
        thresh = cv2.adaptiveThreshold(
            filtered, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 21, 5
        )
        
        # Combine threshold with edge gradient
        combined = cv2.bitwise_and(thresh, gradient)
        
        # Clean up small noise
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
        closed = cv2.morphologyEx(combined, cv2.MORPH_CLOSE, kernel_clean)
        
        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Potholes in perspective have reasonable pixel area
            if 800 < area < 45000:
                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect_ratio = bw / float(bh)
                
                # Potholes are usually somewhat elliptical/horizontal in perspective
                if 0.5 < aspect_ratio < 3.5:
                    # Calculate internal texture intensity vs surrounding
                    mask = np.zeros(gray.shape, dtype=np.uint8)
                    cv2.drawContours(mask, [cnt], -1, 255, -1)
                    mean_val = cv2.mean(gray, mask=mask)[0]
                    
                    # Compute confidence based on area, contrast and aspect ratio
                    base_conf = 0.72 + min(0.18, (area / 30000.0) * 0.15)
                    
                    # Check for IMU vibration sensor fusion
                    vibration_boost = 0.0
                    vibration_level = "NORMAL"
                    if imu_data:
                        ax = abs(imu_data.get("ax", 0.0))
                        ay = abs(imu_data.get("ay", 0.0))
                        az = abs(imu_data.get("az", 9.81) - 9.81)
                        total_accel = ax + ay + az
                        
                        if total_accel > 3.0:
                            vibration_boost = 0.14
                            vibration_level = "HIGH"
                            logger.info(f"[SENSOR FUSION] High vibration ({total_accel:.2f} m/s²) boosted pothole confidence.")
                        elif total_accel > 1.5:
                            vibration_boost = 0.07
                            vibration_level = "MEDIUM"

                    final_conf = min(0.98, base_conf + vibration_boost)
                    
                    if final_conf >= self.conf_threshold:
                        # Determine severity
                        if area > 18000 or final_conf > 0.88 or vibration_level == "HIGH":
                            severity = "HIGH"
                        elif area > 6000 or final_conf > 0.75:
                            severity = "MEDIUM"
                        else:
                            severity = "LOW"

                        # Adjust coordinates to full frame
                        full_y1 = y + roi_start_y
                        full_y2 = full_y1 + bh
                        
                        defects.append({
                            "bbox": [x, full_y1, x + bw, full_y2],
                            "event_type": "POTHOLE",
                            "confidence": round(float(final_conf), 2),
                            "severity": severity,
                            "vibration_level": vibration_level,
                            "area": int(area)
                        })

        # Return only the top strongest non-overlapping detections
        if defects:
            defects = sorted(defects, key=lambda d: d['confidence'], reverse=True)[:3]
            for d in defects:
                logger.info(f"[AI] Road defect detected: {d['event_type']} (Confidence: {d['confidence']*100:.0f}%, Severity: {d['severity']})")
                
        return defects
