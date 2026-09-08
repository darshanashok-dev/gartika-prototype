import logging
import numpy as np
import cv2

logger = logging.getLogger("gartika.ai.detector")

TARGET_CLASSES = {
    0: "person",
    1: "bicycle",
    2: "car",
    3: "motorcycle",
    5: "bus",
    7: "truck"
}

class VehicleDetector:
    def __init__(self, model_path: str = "yolov8n.pt", conf_threshold: float = 0.40):
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
        Run vehicle and urban object detection on frame.
        Returns list of dicts: [{'bbox': [x1, y1, x2, y2], 'class_name': str, 'confidence': float, 'class_id': int}]
        """
        if frame is None or frame.size == 0:
            return []

        detections = []
        h, w = frame.shape[:2]

        if self.model is not None and not self.use_fallback:
            try:
                results = self.model(frame, conf=self.conf_threshold, verbose=False)
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        cls_id = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        
                        # Filter to our target urban transport classes
                        if cls_id in TARGET_CLASSES:
                            coords = box.xyxy[0].cpu().numpy().astype(int)
                            x1, y1, x2, y2 = coords
                            # Clamp to image bounds
                            x1, y1 = max(0, x1), max(0, y1)
                            x2, y2 = min(w, x2), min(h, y2)
                            
                            detections.append({
                                "bbox": [int(x1), int(y1), int(x2), int(y2)],
                                "class_name": TARGET_CLASSES[cls_id],
                                "confidence": round(conf, 3),
                                "class_id": cls_id
                            })
                return detections
            except Exception as e:
                logger.warning(f"[AI] Error during YOLOv8 inference: {e}")

        # Fallback CV-based vehicle contour detection if YOLO isn't available
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        blur = cv2.GaussianBlur(gray, (5, 5), 0)
        edges = cv2.Canny(blur, 50, 150)
        
        # Search road region (middle to bottom)
        roi = edges[int(h * 0.4):int(h * 0.9), :]
        contours, _ = cv2.findContours(roi, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 1500 < area < 40000:
                x, y, bw, bh = cv2.boundingRect(cnt)
                aspect_ratio = bw / float(bh)
                if 0.6 < aspect_ratio < 2.5:
                    y_adj = y + int(h * 0.4)
                    detections.append({
                        "bbox": [x, y_adj, x + bw, y_adj + bh],
                        "class_name": "car" if aspect_ratio > 1.1 else "motorcycle",
                        "confidence": 0.82,
                        "class_id": 2
                    })
        return detections
