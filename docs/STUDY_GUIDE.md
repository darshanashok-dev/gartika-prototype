# Gartika Master Study Guide: AI-Powered Mobile Urban Intelligence

Welcome to the **Gartika Study Guide**. This guide is designed as an architectural and algorithmic textbook for developers, students, and Smart India Hackathon evaluators studying how public transit buses can be transformed into continuous, privacy-preserving mobile urban sensing units.

---

## 1. Master Learning Path

```
                    ┌───────────────────────────────┐
                    │       1. START HERE           │
                    │  README.md → architecture.md  │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │      2. DATA INGESTION        │
                    │  telemetry.py → stream.py     │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │      3. AI & VISION           │
                    │  pothole_detector → tracker   │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │     4. SENSOR FUSION          │
                    │  buffer.py → engine.py        │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │     5. DATA PERSISTENCE       │
                    │  models/defect.py → SQLite/GIS│
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │  6. REAL-TIME OPERATIONS      │
                    │  websocket.py → dashboard     │
                    └──────────────┬────────────────┘
                                   │
                    ┌──────────────▼────────────────┐
                    │  7. CLOSED-LOOP REPAIR AUDIT  │
                    │  work_orders.py → engine.py   │
                    └───────────────────────────────┘
```

### Stage 1: Beginner (Foundations)
1. **FastAPI & REST APIs**: Study `backend/app/main.py` and `backend/app/routes/`. Understand dependency injection (`get_db`), Pydantic request validation (`backend/app/schemas/`), and API prefix routing (`/api/v1`).
2. **SQLAlchemy ORM & Relationships**: Study `backend/app/models/defect.py` to see how `RoadDefect` (persistent physical hazard) is distinguished from `Observation` (individual vehicle transit evidence).
3. **WebSockets Gateway**: Study `backend/app/websocket.py` to understand how connected dashboards receive instantaneous JSON alerts without HTTP polling.

### Stage 2: Intermediate (AI & Computer Vision)
1. **Edge Pothole Detection**: Study `ai/pothole_detector.py`. Learn how YOLO neural inference operates on road imagery, and how OpenCV morphological contours serve as an edge fallback.
2. **Multi-Object Vehicle Tracking**: Study `ai/tracker.py`. Understand Intersection-over-Union (IoU) bounding box association and track persistence.
3. **Privacy Preservation**: Study `backend/app/fusion/engine.py` (`PrivacyFilter`). Understand automated localized Gaussian blurring ($k=31$) for vehicle license plates and pedestrian faces before evidence storage.

### Stage 3: Advanced (Multi-Modal Sensor Fusion & Systems)
1. **Temporal Ring Buffering**: Study `backend/app/fusion/buffer.py`. Learn how asynchronous camera frames (15–30 FPS) and IMU readings (10–50 Hz) are aligned within a temporal window ($\pm 800	ext{ms}$).
2. **Dynamic Gravity Calibration**: Understand running baseline estimation ($ar{g}_k = ar{g}_{k-1} + lpha(a_{z,k} - ar{g}_{k-1})$) to isolate road surface shock from vehicle suspension loading.
3. **Spatial Deduplication**: Study Haversine spherical distance calculations in `backend/app/fusion/engine.py` to cluster raw observations within 15 meters.
4. **Closed-Loop Multi-Bus Repair Auditing**: Understand how fleet traversals confirm whether municipal asphalt repairs were successfully completed.

---

## 2. Complete Event Trace: "A Bus Hits a Pothole"

Follow the complete lifecycle of a single road distress incident from the physical roadway to final repair verification:

```text
[1. Roadway Event]
    Bus BUS-101 traverses over a 6cm deep pothole at 35 km/h.
         │
[2. Hardware Sensing]
    Smartphone mounted on the windshield detects:
    - Front camera captures video frame showing dark crater in lane.
    - 6-axis IMU accelerometer registers sudden vertical shock: a_z = 17.2 m/s² (|a_z - 9.81| = 7.39 m/s²).
    - GNSS receiver logs latitude: 12.97210, longitude: 77.59480.
         │
[3. Ingestion & Edge Privacy]
    - Telemetry is streamed to POST /api/v1/telemetry.
    - Camera frame is uploaded to POST /api/v1/stream/frame.
    - PrivacyFilter detects potential license plates and applies Gaussian blur.
         │
[4. Temporal Buffer Alignment]
    SensorBufferManager searches the ring buffer for BUS-101:
    |t_imu - t_frame| = 42ms <= 800ms window -> MATCH FOUND!
         │
[5. Multi-Modal Fusion Scoring]
    SensorFusionEngine calculates confidence breakdown:
    - model_confidence: 0.88 (YOLOv8 pothole detection)
    - imu_score: 0.92 (Calibrated vertical impact)
    - fusion_score: 0.94 (Weighted multi-modal composite)
         │
[6. Spatial Deduplication]
    Haversine distance check against existing RoadDefect records within 15 meters.
    - If new: creates RoadDefect DEF-2026-A101 (status: SENSOR_FUSED).
    - Creates Observation OBS-2026-B1 linked to BUS-101.
         │
[7. Multi-Bus Corroboration]
    45 minutes later, BUS-104 passes the exact coordinates.
    - IMU shock and visual contour detected.
    - SensorFusionEngine notes unique_bus_count increases to 2 (BUS-101, BUS-104).
    - Status transitions from SENSOR_FUSED to MULTI_BUS_VERIFIED!
         │
[8. Real-Time WebSocket Broadcast]
    Backend broadcasts JSON event to /ws/events -> Dashboard updates in real time.
         │
[9. Municipal Work Order Dispatch]
    Operator clicks "Dispatch Work Order" -> creates WO-1042 (Status: ASSIGNED).
    Road maintenance crew patches the pothole with hot asphalt.
    Contractor marks work order status: PENDING_VERIFICATION.
         │
[10. Closed-Loop Repair Verification]
    - Pass 1: BUS-102 passes coordinates. No visual crater detected, smooth IMU (a_z = 9.80 m/s²).
      Observation recorded: clean_pass = 1/2 (Status: PENDING_VERIFICATION).
    - Pass 2: BUS-105 passes coordinates. Smooth IMU verified.
      clean_pass = 2/2 -> Defect status transitions to CLOSED (REPAIR_VERIFIED)!
      Work order WO-1042 automatically transitions to RESOLVED.
```

---

## 3. Core Questions Every Developer Should Be Able to Answer

### Architecture & System Design
- **Q: Why are sensor buffers isolated per `bus_id`?**
  - *A: Buses operate asynchronously across different city sectors. Buffers must never allow an IMU shock from BUS-101 to accidentally match a camera frame uploaded by BUS-202.*
- **Q: What happens if a smartphone loses GPS signal (e.g. inside an underpass or tunnel)?**
  - *A: Gartika strictly records `latitude: null`, `longitude: null`, and `location_status: "UNKNOWN_LOCATION"`. It never fabricates fake coordinates.*

### AI & Computer Vision
- **Q: Why does Gartika use both YOLO and OpenCV heuristic fallbacks?**
  - *A: In resource-constrained or edge environments where PyTorch/ONNX models are unavailable, OpenCV dark-contour analysis provides lightweight, real-time candidate extraction.*
- **Q: What is the difference between `model_confidence` and `fusion_score`?**
  - *A: `model_confidence` represents only the visual neural network's raw probability. `fusion_score` combines visual evidence with physical IMU acceleration shocks.*

### Sensor Fusion & Operations
- **Q: Can an IMU accelerometer spike alone prove a pothole?**
  - *A: No. Accelerometer spikes can be caused by speed breakers, bridge expansion joints, or sudden braking. IMU serves as physical corroboration; visual imagery provides semantic context.*
- **Q: Why is multi-bus corroboration superior to repeated passes by the same bus?**
  - *A: A single bus might have a damaged shock absorber or miscalibrated sensor causing repeated false alarms. Independent corroboration by distinct vehicles eliminates single-point hardware bias.*
