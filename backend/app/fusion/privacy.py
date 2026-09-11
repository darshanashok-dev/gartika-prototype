"""
Privacy-Preserving Image Filtering for Gartika Urban Intelligence.

Applies automatic privacy protection (Gaussian face blurring and license plate blurring)
on raw camera frames before saving evidence snapshots to persistent storage.
"""

import cv2
import numpy as np
from typing import Optional, List, Dict

class PrivacyFilter:
    """
    Applies privacy-preserving obfuscation to detected persons and vehicle license plates.
    """
    def __init__(self, blur_kernel_size: int = 31, sigma: int = 30):
        self.ksize = blur_kernel_size if blur_kernel_size % 2 == 1 else blur_kernel_size + 1
        self.sigma = sigma

    def blur_roi(self, image: np.ndarray, x1: int, y1: int, x2: int, y2: int) -> np.ndarray:
        """Apply Gaussian blur to a bounding rectangle region."""
        h, w = image.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        if x2 <= x1 or y2 <= y1:
            return image

        roi = image[y1:y2, x1:x2]
        if roi.size > 0:
            blurred = cv2.GaussianBlur(roi, (self.ksize, self.ksize), self.sigma)
            image[y1:y2, x1:x2] = blurred
        return image

    def anonymize_frame(
        self,
        frame: np.ndarray,
        detections: Optional[List[Dict]] = None
    ) -> np.ndarray:
        """
        Anonymize a camera frame by blurring pedestrians' faces and vehicle plate regions.
        
        Args:
            frame: Numpy BGR image array.
            detections: Optional list of object detections with 'class_name' and 'bbox'.
            
        Returns:
            np.ndarray: Anonymized copy of the image.
        """
        if frame is None or frame.size == 0:
            return frame

        anon = frame.copy()
        if not detections:
            return anon

        for det in detections:
            cls_name = det.get("class_name", "").lower()
            bbox = det.get("bbox", [])
            if len(bbox) != 4:
                continue

            x1, y1, x2, y2 = bbox
            box_w = x2 - x1
            box_h = y2 - y1

            if cls_name == "person":
                # Blur upper 35% of person bounding box (head/face)
                face_h = int(box_h * 0.35)
                anon = self.blur_roi(anon, x1, y1, x2, y1 + face_h)

            elif cls_name in ["car", "bus", "truck"]:
                # Blur lower 30% of vehicle bounding box where license plates typically sit
                plate_y1 = y1 + int(box_h * 0.70)
                plate_x1 = x1 + int(box_w * 0.20)
                plate_x2 = x2 - int(box_w * 0.20)
                anon = self.blur_roi(anon, plate_x1, plate_y1, plate_x2, y2)

        return anon

# Global privacy filter instance
privacy_filter = PrivacyFilter()
