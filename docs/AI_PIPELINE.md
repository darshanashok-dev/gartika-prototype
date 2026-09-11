# Gartika — AI Detection, Tracking & Sensor Fusion Pipeline

## 1. Pipeline Overview

The Gartika AI pipeline extracts high-fidelity road-defect candidates from vehicle-mounted camera feeds, maintains temporal consistency across frames using visual tracking, and correlates visual candidates with high-frequency IMU telemetry to eliminate false positives.

```
┌─────────────────┐
│ Bus Dash Camera │ ──► 1280x720 RGB Video Stream (15 FPS)
└────────┬────────┘
         │
         ▼
┌───────────────────────────┐
│ Edge AI Detection Engine  │ ──► YOLOv8 / OpenCV Heuristic Fallback
└────────┬──────────────────┘     (Bounding boxes, class IDs, confidences)
         │
         ▼
┌───────────────────────────┐
│ IoU-Based Object Tracker  │ ──► Tracks defect instances across consecutive frames
└────────┬──────────────────┘     (Prevents duplicate counting of the same defect in 1 video pass)
         │
         ▼
┌───────────────────────────┐
│ Visual Candidate Event    │ ──► (bbox, confidence, timestamp, bus_id)
└────────┬──────────────────┘
         │
         ▼
┌───────────────────────────┐
│ IMU & GPS Ring Buffer     │ ──► Isolates 50Hz (ax, ay, az) readings & GPS telemetry per bus
└────────┬──────────────────┘
         │
         ▼
┌───────────────────────────┐
│ Spatio-Temporal Fusion    │ ──► Correlates visual candidate with IMU vertical shock (|az| > 13.8 m/s²)
└────────┬──────────────────┘     Temporal window: ±1.5 seconds
         │
         ▼
┌───────────────────────────┐
│ Spatial Deduplication     │ ──► Haversine clustering with 25.0m radius
└────────┬──────────────────┘     Merges multiple observations into a single canonical `RoadDefect`
         │
         ▼
┌───────────────────────────┐
│ Multi-Bus Verification    │ ──► Elevates candidate to `VERIFIED` when reported by ≥ 2 unique buses
└────────┬──────────────────┘
         │
         ▼
┌───────────────────────────┐
│ Closed-Loop Repair System │ ──► Verifies municipal road repairs upon re-transit
└───────────────────────────┘
```

---

## 2. Core Modules & Responsibilities

### 2.1 Pothole & Defect Detector (`ai/pothole_detector.py`, `inference/detector.py`)
- **Primary Engine:** YOLOv8/YOLOv11 PyTorch model fine-tuned on road-surface defect datasets (`pothole`, `speed_breaker`, `road_crack`).
- **Resilience Strategy:** If YOLO weights are missing or inference encounters a corrupted frame, the system automatically falls back to an OpenCV adaptive thresholding and contour analysis heuristic without crashing.
- **Output:** Normalized bounding boxes `[x1, y1, x2, y2]`, class names, and raw visual confidence `model_confidence ∈ [0.0, 1.0]`.

### 2.2 Visual Object Tracker (`ai/tracker.py`)
- **Method:** Intersection-over-Union (IoU) spatial matching with configurable assignment threshold (`min_iou=0.3`) and persistence memory (`max_lost_frames=5`).
- **Purpose:** Prevents a single pothole seen in 10 consecutive video frames from creating 10 duplicate database records. It assigns a persistent `track_id` to the physical defect while in the camera's field of view.

### 2.3 Per-Bus Ring Buffer Manager (`backend/app/fusion/buffer.py`)
- **Isolation:** Each transit bus (`bus_id`) maintains an independent in-memory circular ring buffer of telemetry (GPS coordinates, speed, heading) and high-frequency IMU readings (ax, ay, az).
- **Temporal Alignment:** Matches visual detections with physical shock events occurring within `±1.5` seconds of frame capture to account for camera-to-axle distance and processing latency.

### 2.4 Sensor Fusion Engine (`backend/app/fusion/engine.py`)
- **Scoring Function:**
  $$\text{FusionScore} = 0.60 \times \text{VisualConfidence} + 0.40 \times \text{IMUSeverity}$$
  - Where $\text{IMUSeverity} = \min\left(1.0, \frac{|a_z - 9.81| - \text{threshold}}{15.0}\right)$.
- **Candidate Classification:**
  - `VISUAL_ONLY`: Visual detection with no corresponding IMU shock.
  - `IMU_SHOCK`: Accelerometer shock without visual confirmation (e.g., night, puddle obscuring hole).
  - `FUSED_HAZARD`: Both camera and accelerometer confirm the defect.

### 2.5 Spatial Deduplication & Aggregation
- **Method:** Spatial radius matching using the Haversine formula on WGS84 coordinates.
- **Clustering Radius:** $R = 25.0 \text{ meters}$.
- **Behavior:**
  - If a detection occurs within 25.0m of an existing active defect, an `Observation` record is attached to the existing `RoadDefect`, updating its observation count, last observed timestamp, and weighted severity.
  - If the reporting bus is distinct from previously recording buses, `unique_bus_count` is incremented.

---

## 3. Safe Fallback Behavior

1. **Missing PyTorch / ONNX Runtime:** Falls back to OpenCV morphological contour analysis.
2. **Corrupted Image Frames:** Returns empty detection list `[]` and logs structured warning; never throws HTTP 500.
3. **Loss of GPS Lock:** Records observation with `latitude=null, longitude=null` (`UNKNOWN_LOCATION`) and buffers for post-tunnel correlation.
4. **IMU Sensor Failure:** System operates in visual-only degraded mode with lower initial defect confidence.
