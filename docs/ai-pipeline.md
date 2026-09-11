# Gartika AI Detection & Computer Vision Pipeline

## 1. Dual-Engine Architecture
Gartika implements a robust, dual-engine computer vision architecture:

1. **YOLOv8 Deep Neural Network**:
   - When trained weights (`yolov8n.pt` / `pothole.pt`) are present, inference generates bounding boxes with class probabilities (`model_confidence`).
2. **OpenCV Morphological Heuristic Fallback**:
   - For edge devices without GPU/NPU acceleration, Gartika runs an adaptive contour analysis pipeline:
     - Grayscale conversion & Gaussian smoothing ($5 	imes 5$).
     - Adaptive thresholding & Otsu binary segmentation.
     - Morphological closing to fill minor voids.
     - Contour area, aspect ratio, and dark-pixel density evaluation to compute `heuristic_score`.

---

## 2. Vehicle Tracking (`IoUTracker`)
Vehicle tracking uses an Intersection-over-Union (IoU) association algorithm:
- Detections in frame $N$ are matched against active tracks from frame $N-1$.
- Cost matrix is constructed using pairwise IoU:
  $$	ext{IoU}(A, B) = rac{	ext{Area}(A \cap B)}{	ext{Area}(A \cup B)}$$
- Matches with $	ext{IoU} \ge 0.30$ update existing tracks; unmatched detections spawn new tracks.
- Stale tracks not seen for 30 consecutive frames are pruned from memory.
