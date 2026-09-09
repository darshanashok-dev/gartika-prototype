# Gartika Architecture & Source Code Technical Documentation

> **AI-Powered Mobile Urban Intelligence Platform**  
> *Smart India Hackathon 2026 | Problem Statement: Buses as Urban Sensors*  
> *Team: Tech Priests*

---

# 1. Project-Wide File Map

```text
gartika/
│
├── ai/                                    # Edge AI Computer Vision & Sensor Fusion Subsystem
│   ├── detector.py                        → Vehicle & Pedestrian detection using YOLOv8 with CV fallback
│   ├── tracker.py                         → Multi-object tracking and persistent vehicle ID tracking via ByteTrack
│   ├── pothole_detector.py                → Multi-modal road defect detector (YOLOv8 + CV contrast + IMU vibration)
│   ├── event_generator.py                 → Transforms visual detections into deduplicated Gartika JSON events
│   ├── video_processor.py                 → Video stream / Dashcam batch processor and simulated patrol runner
│   ├── train.py                           → Fine-tuning YOLOv8 for custom road defect classes
│   └── requirements.txt                   → Python dependencies for computer vision and deep learning
│
├── backend/                               # Central FastAPI Backend, ORM Models & Real-time WebSockets
│   ├── requirements.txt                   → Backend Python dependencies (FastAPI, SQLAlchemy, Uvicorn, etc.)
│   └── app/
│       ├── main.py                        → FastAPI application entry point, lifecycle manager, and static router
│       ├── config.py                      → Central application configuration, environment settings, and IP discovery
│       ├── database.py                    → SQLite database engine, Base declarative class, and session dependencies
│       ├── websocket.py                   → ConnectionManager for non-blocking real-time event broadcasting
│       │
│       ├── models/                        → SQLAlchemy ORM Database Schemas
│       │   ├── __init__.py                → Model package exports
│       │   ├── bus.py                     → Bus entity model (coordinates, speed, route, heartbeat)
│       │   ├── event.py                   → Urban defect AI event model (potholes, cracks, traffic counts)
│       │   ├── telemetry.py               → High-frequency GPS and 3-axis accelerometer observations
│       │   └── work_order.py              → Municipal road maintenance work orders and status tracking
│       │
│       ├── routes/                        → REST API Route Handlers
│       │   ├── buses.py                   → Fleet queries, unit registration, and status endpoints
│       │   ├── events.py                  → Defect retrieval, spatial filtering, and event creation
│       │   ├── stats.py                   → System health checks and high-level KPI aggregations
│       │   ├── stream.py                  → Mobile live camera frame upload, server inference & live preview
│       │   ├── telemetry.py               → High-frequency sensor ingestion and latest location lookup
│       │   └── work_orders.py             → Municipal work order lifecycle management (creation, assignment, resolution)
│       │
│       └── schemas/                       → Pydantic Request Validation & Response Serializers
│           ├── __init__.py                → Schema package exports
│           ├── bus.py                     → Bus validation schemas (BusCreate, BusUpdate, BusResponse)
│           ├── event.py                   → Event validation schemas (EventCreate, EventUpdate, EventResponse)
│           ├── telemetry.py               → Telemetry validation schemas (TelemetryCreate, TelemetryResponse)
│           └── work_order.py              → Work order schemas (WorkOrderCreate, WorkOrderUpdate, WorkOrderResponse)
│
├── training/                              # Deep Learning Model Training & Evaluation Subsystem
│   ├── prepare_dataset.py                 → Validates raw data & performs sequence-grouped 70/20/10 split
│   ├── validate_dataset.py                → Audits bounding-box coordinates, normalizations, and YOLO compliance
│   ├── train.py                           → Executes YOLOv8 transfer learning with road-tailored augmentations
│   ├── evaluate.py                        → Evaluates Precision, Recall, mAP@50, mAP@50:95 & False Positive diagnostics
│   └── export.py                          → Exports trained PyTorch weights (.pt) to dynamic ONNX (.onnx)
│
├── inference/                             # Production & CLI Model Inference Tools
│   ├── detector.py                        → RoadDefectDetector class with temporal deduplication & event formatting
│   ├── predict_image.py                   → CLI tool for running inference and saving bounding-box annotations on photos
│   └── predict_video.py                   → CLI tool for frame-by-frame video stream inference with FPS HUD
│
├── dataset/                               # YOLO Dataset Definition & Raw Image Assets
│   ├── data.yaml                          → YOLO dataset configuration file with class definitions
│   └── generate_raw_data.py               → Generates realistic road scenes with negative samples for test runs
│
├── mobile/                                # Mobile Sensing Edge Web Application (Windshield Smartphone)
│   ├── index.html                         → Mobile UI structure (camera viewport, live HUD, sensor meters)
│   ├── app.js                             → Core mobile logic (getUserMedia, GPS watchPosition, devicemotion IMU)
│   └── styles.css                         → High-contrast responsive dark-mode mobile styling
│
├── dashboard/                             # Central Urban Intelligence GIS Command Dashboard
│   ├── index.html                         → HTML layout (Leaflet GIS map, metric cards, event feed, work orders modal)
│   ├── app.js                             → Dashboard application controller (Leaflet GIS, WebSockets, REST sync)
│   ├── styles.css                         → Dark-mode command center CSS stylesheet
│   ├── package.json                       → Frontend React tooling dependencies
│   └── src/                               # React implementation of Dashboard
│       ├── main.jsx                       → React root mount
│       ├── App.jsx                        → Root layout component with state synchronization
│       ├── components/
│       │   ├── Header.jsx                 → Top navigation header with status indicators
│       │   ├── MetricsBar.jsx             → 4 KPI metrics display cards
│       │   ├── BusCard.jsx                → Active mobile unit GPS, speed, and status profile
│       │   └── WorkOrdersList.jsx         → Civic maintenance dispatch list with status dropdowns
│       └── services/
│           └── api.js                     → Centralized Axios/Fetch API client for backend communication
│
├── scripts/                               # Operational, Automation, and Demonstration Shell Scripts
│   ├── setup.sh                           → Environment setup, dependency installation, and dataset audit
│   ├── start_live.sh                      → Launches Gartika backend in strict LIVE mobile sensing mode
│   ├── start_demo.sh                      → Launcher script (redirected to start_live.sh to avoid fake data)
│   ├── run_demo.sh                        → End-to-end AI demo (validation, evaluation, image & video inference)
│   ├── reset_to_live.py                   → Database purge script, removes mock records and sets DEMO_MODE=false
│   ├── seed_demo_data.py                  → Demo dataset seeder (protected with --force-demo flag)
│   ├── run_webcam_edge.py                 → USB Webcam / Dashcam live streamer to backend
│   └── prepare_dataset.py                 → Roboflow dataset downloader utility
│
├── tests/                                 # Automated Pytest Test Suite
│   ├── test_ai_pipeline.py                → Unit tests for YOLO detection, ByteTrack, Pothole CV & haversine math
│   ├── test_api_endpoints.py              → Integration tests for FastAPI REST routes (buses, events, work orders)
│   └── test_e2e.py                        → End-to-end workflow test (telemetry ingestion, event trigger, work order)
│
├── models/                                # Trained Neural Network Weights
│   ├── gartika_road_defect.pt             → Fine-tuned YOLOv8 PyTorch road defect weights
│   └── gartika_road_defect.onnx           → Exported dynamic ONNX edge model
│
├── results/                               # Generated Metrics, Plots, and Inference Outputs
│   ├── training/                          → Training curve plots (PR_curve.png, confusion_matrix.png)
│   ├── evaluation/                        → Evaluation metrics.json and diagnostic test prediction visual samples
│   └── predictions/                       → Annotated prediction images and processed output videos
│
├── Dockerfile                             → Multi-stage production container for FastAPI backend & dashboard
├── Dockerfile.ai                          → Container definition for AI video ingestion workers
├── Gartika_Prototype_PRD.md               → Official Product Requirements Document
└── README.md                              → Master project documentation, architecture guide, and quick start
```

---

# 2. Detailed File-by-File Documentation

---

## 2.1 `ai/` Subsystem (Edge AI & Sensor Fusion)

### `ai/detector.py`

**Purpose**  
Performs object detection on road video frames to identify urban transport entities (cars, buses, trucks, motorcycles, bicycles, persons) using YOLOv8 with an automatic OpenCV computer-vision fallback.

**Role in Gartika**  
Acts as the visual vehicle and traffic flow detector in the edge perception loop.

**Important Imports / Dependencies**  
- `ultralytics.YOLO`: Deep learning object detection model.
- `cv2`: OpenCV image manipulation and contour detection fallback.
- `numpy`: Multi-dimensional image array processing.

**Important Constants**  
- `TARGET_CLASSES`: Dict mapping COCO class indices to urban vehicle categories (`0: person`, `1: bicycle`, `2: car`, `3: motorcycle`, `5: bus`, `7: truck`).

**Main Classes**  
- `VehicleDetector`: Encapsulates YOLOv8 neural network loading and inference.
  - **Constructor:** `VehicleDetector(model_path="yolov8n.pt", conf_threshold=0.40)`  
    *Parameters:* `model_path` (string path to model checkpoint), `conf_threshold` (minimum float confidence).  
    *Logic:* Attempts to import and initialize `ultralytics.YOLO`. If YOLO fails or weights are unavailable, logs a warning and activates `self.use_fallback = True` to guarantee operational resilience.
  - **Methods:**
    - `detect(frame)`: Runs object detection on a single BGR image.  
      *Input:* Numpy BGR array.  
      *Output:* List of detection dicts `[{"bbox": [x1, y1, x2, y2], "class": str, "confidence": float}]`.  
      *Logic:* If `self.use_fallback` is active, crops the upper horizon and extracts moving vehicle contours using morphological dilation and aspect ratio filtering. Otherwise, executes `self.model(frame, verbose=False)` and filters bounding boxes by `TARGET_CLASSES` and `self.conf_threshold`.

**Used By**  
- `backend/app/routes/stream.py` (during live camera frame stream analysis).
- `ai/video_processor.py` (during batch video road patrol execution).
- `tests/test_ai_pipeline.py`.

**Data Flow**  
```text
Video Frame (BGR) ➔ VehicleDetector.detect() ➔ Filter by TARGET_CLASSES ➔ Vehicle Bounding Boxes
```

---

### `ai/pothole_detector.py`

**Purpose**  
Detects road surface defects (potholes, cracks, depressions) using custom fine-tuned YOLOv8 neural network weights with fallback to advanced OpenCV morphological contrast analysis and multi-modal IMU accelerometer vibration fusion.

**Role in Gartika**  
Performs primary road hazard identification, turning visual depressions and physical bump shocks into verified defect candidates.

**Important Imports / Dependencies**  
- `ultralytics.YOLO`: Custom deep learning model runner.
- `cv2`: Bilateral filtering, morphological gradient, adaptive thresholding, contour extraction.
- `numpy`: Array math, pixel intensity calculations, circularity geometry.

**Main Classes**  
- `PotholeDetector`: Hybrid deep learning + computer-vision + IMU sensor fusion detector.
  - **Constructor:** `PotholeDetector(model_path=None, conf_threshold=0.65)`  
    *Logic:* Checks multiple candidate filepaths for fine-tuned weights (`ai/models/pothole_yolov8.pt`, `models/gartika_road_defect.pt`). If found, loads the custom YOLO model; otherwise operates in pure computer-vision sensor fusion mode.
  - **Methods:**
    - `detect(frame, imu_data=None)`: Evaluates a camera frame for potholes and cracks.  
      *Input:* `frame` (Numpy BGR array), `imu_data` (Optional dict `{"ax": float, "ay": float, "az": float}`).  
      *Output:* List of defect dicts `[{"bbox": [x1,y1,x2,y2], "event_type": str, "confidence": float, "severity": str, "vibration_level": str}]`.  
      *Internal Logic:*  
      1. If custom YOLO model is loaded, runs inference and extracts class bounding boxes.  
      2. If CV mode is active: crops to the lower 55% road region of interest (ROI); applies bilateral filter (smoothing asphalt noise while preserving crater rims); applies morphological gradient with adaptive thresholding; computes contour circularity ($\ge 0.20$) and convex hull solidity ($\ge 0.50$); validates that the interior is darker than the surrounding road ($\Delta \ge 12\%$).  
      3. **Sensor Fusion:** Evaluates vertical acceleration $a_z$. If $|a_z - 9.81| + |a_x| + |a_y| > 3.0\text{ m/s}^2$ (physical bump shock), confidence is boosted by $+0.15$ to $+0.18$ and severity is elevated to `"HIGH"`.

**Used By**  
- `backend/app/routes/stream.py`.
- `ai/video_processor.py`.
- `tests/test_ai_pipeline.py`.

---

### `ai/tracker.py`

**Purpose**  
Provides multi-object tracking and persistent vehicle ID tracking using the ByteTrack association algorithm, preventing duplicate vehicle counts across video frames.

**Role in Gartika**  
Tracks detected vehicles frame-to-frame, counting unique vehicles crossing the sensing line.

**Important Imports / Dependencies**  
- `scipy.optimize.linear_sum_assignment`: Hungarian algorithm for bipartite bounding box matching.
- `numpy`: Matrix arithmetic and Kalman filter state estimation.

**Main Classes**  
- `KalmanBoxTracker`: 7-state Kalman filter estimating bounding box location and velocity $[x, y, s, r, \dot{x}, \dot{y}, \dot{s}]$.
- `ByteTracker`: Multi-object tracker maintaining active tracks, lost tracks, and unique object ID counts.
  - **Methods:**
    - `update(detections)`: Matches new frame detections with existing tracks using a two-stage association cascade (high confidence detections first, then low confidence detections).
    - `get_total_counted()`: Returns the cumulative count of unique vehicles observed.

**Used By**  
- `ai/video_processor.py`.
- `tests/test_ai_pipeline.py`.

---

### `ai/event_generator.py`

**Purpose**  
Converts raw visual detections and IMU telemetry into structured, geotagged Gartika JSON events, and handles spatial/temporal deduplication.

**Main Classes / Functions**  
- `haversine_distance(lat1, lon1, lat2, lon2)`: Computes great-circle distance in meters between two GPS coordinates.
- `EventGenerator`: Deduplicates detections and formats JSON payloads.
  - **Methods:**
    - `create_event(detection, bus_id, lat, lon, imu_data=None)`: Validates confidence thresholds, calculates severity (`LOW`, `MEDIUM`, `HIGH`), formats unique `event_id`, and checks spatial deduplication ($>15\text{ m}$ apart or $>5\text{ s}$ elapsed).

---

### `ai/video_processor.py`

**Purpose**  
Batch video stream ingestion engine. Processes MP4 dashcam recordings or simulated bus patrol routes, running vehicle detection, ByteTrack tracking, pothole detection, and HTTP dispatch to the backend API.

---

## 2.2 `backend/app/` Subsystem (FastAPI Engine & Database)

### `backend/app/main.py`

**Purpose**  
Master application entry point. Configures the FastAPI application, lifespan database migrations, CORS middleware, REST API routers, static file mounts (mobile app, dashboard, evidence snapshots), and the WebSocket streaming gateway.

**Key Endpoints Registered**  
- `/buses` ➔ `buses.router`
- `/events` ➔ `events.router`
- `/work-orders` ➔ `work_orders.router`
- `/telemetry` ➔ `telemetry.router`
- `/stats` ➔ `stats.router`
- `/stream` ➔ `stream.router`
- `WebSocket /ws/events` ➔ Real-time WebSocket broadcasting

---

### `backend/app/config.py`

**Purpose**  
Central runtime configuration manager. Loads environment variables from `.env`, specifies directory paths (`data/evidence/`, `models/`), sets operational modes (`DEMO_MODE=false`), and resolves local network IP (`get_local_ip()`) for mobile pairing.

---

### `backend/app/database.py`

**Purpose**  
Database engine setup and scoped session dependency. Creates the SQLite database connection (`gartika.db`), declarative base model class `Base`, and provides the `get_db()` generator for FastAPI dependency injection with automatic session closure.

---

### `backend/app/websocket.py`

**Purpose**  
Asynchronous real-time WebSocket connection manager. Maintains an active pool of connected client sockets (command dashboards, mobile units) and broadcasts new events (`NEW_EVENT`, `BUS_UPDATE`, `TELEMETRY`) across the network without blocking HTTP requests.

---

### `backend/app/models/` (SQLAlchemy ORM Entities)

- **`bus.py` (`Bus`)**: Stores registered bus units, last seen timestamp, operational status (`ONLINE`, `OFFLINE`), current latitude/longitude, route name, and source mode.
- **`event.py` (`Event`)**: Stores geotagged AI detection events (`POTHOLE`, `ROAD_DEFECT`, `VEHICLE_COUNT`), confidence score, coordinates, severity (`LOW` to `CRITICAL`), evidence image path, and lifecycle status (`NEW`, `ASSIGNED`, `RESOLVED`).
- **`telemetry.py` (`Telemetry`)**: Stores high-frequency GPS positions, speed, and 3-axis accelerometer observations (`ax`, `ay`, `az`).
- **`work_order.py` (`WorkOrder`)**: Stores municipal maintenance dispatch tickets (`work_order_id`, title, priority, assigned contractor, status).

---

### `backend/app/routes/` (REST API Endpoints)

- **`buses.py`**:
  - `GET /buses`: Lists all registered sensing buses.
  - `POST /buses`: Registers or updates a bus sensing unit and broadcasts `BUS_UPDATE`.
- **`events.py`**:
  - `GET /events`: Queries defect events with type, severity, status, and spatial bounding-box filters.
  - `POST /events`: Persists a new defect event, generates evidence paths, and broadcasts `NEW_EVENT`.
  - `PATCH /events/{event_id}`: Updates event status (e.g. `IN_REVIEW` or `RESOLVED`).
- **`stream.py`**:
  - `POST /stream/frame`: Receives live camera frames from mobile smartphones, executes server-side defect detection, saves annotated evidence frames, enforces a 6-second deduplication cooldown, and broadcasts events.
  - `GET /stream/latest-frame`: Returns the latest buffered JPEG frame for the dashboard live preview HUD.
- **`telemetry.py`**:
  - `POST /telemetry`: Ingests GPS and IMU readings from smartphones, updates the bus's last-known coordinates, and broadcasts `TELEMETRY`.
  - `GET /telemetry/latest`: Fetches the most recent sensor observation for a given bus unit.
- **`work_orders.py`**:
  - `GET /work-orders`: Lists maintenance work orders.
  - `POST /work-orders`: Creates a new work order from a verified road defect.
  - `PATCH /work-orders/{wo_id}`: Updates work order status (`OPEN`, `IN PROGRESS`, `RESOLVED`).
- **`stats.py`**:
  - `GET /health`: Health check endpoint reporting service, database, and edge connection status.
  - `GET /stats/summary`: Computes aggregate dashboard KPIs (active buses, total defects, vehicle counts, bandwidth reduction percentage).

---

## 2.3 `training/` & `inference/` Subsystems

### `training/prepare_dataset.py`
Validates raw road images, groups frames by source video sequence (`seqXX_...`), and partitions into **70% Train, 20% Validation, and 10% Test** splits without temporal sequence leakage. Outputs `dataset/dataset_stats.json`.

### `training/validate_dataset.py`
Audits dataset integrity: verifies bounding-box normalization ($[0.0, 1.0]$), boundary compliance, label syntax (5 values per row), valid class IDs, zero-area box detection, and corrupted image detection.

### `training/train.py`
Trains custom YOLOv8 models on the road defect dataset using PyTorch transfer learning with domain-tailored road scene augmentations (bus pitch tilt, HSV daylight variations, scale changes). Automatically exports the best checkpoint to `models/gartika_road_defect.pt`.

### `training/evaluate.py`
Evaluates the trained model on validation and test sets. Computes Precision, Recall, mAP@50, mAP@50:95, and F1-score. Analyzes false positives (shadows, manholes, road markings) and exports `results/evaluation/metrics.json`.

### `training/export.py`
Exports trained PyTorch weights to dynamic ONNX format (`models/gartika_road_defect.onnx`) for execution on edge runtimes (ONNX Runtime, OpenVINO, or Hailo compiler preprocessing).

### `inference/detector.py`
Provides `RoadDefectDetector` with `predict()`, `predict_frame()`, `format_gartika_event()`, and `TemporalDeduplicator` (suppresses duplicate event alerts across consecutive frames of the same road pothole).

### `inference/predict_image.py`
Command-line inference tool for single images. Overlays bounding boxes and confidence banners and writes annotated results to `results/predictions/`.

### `inference/predict_video.py`
Command-line inference tool for dashcam road video streams. Ingests video frame-by-frame, overlays real-time FPS and defect bounding boxes, applies deduplication, and writes the output video to `results/predictions/`.

---

## 2.4 `mobile/` & `dashboard/` Subsystems

### `mobile/app.js` & `mobile/index.html`
The Mobile Edge Sensing web application designed to run on a smartphone mounted on a bus windshield:
- Uses `navigator.mediaDevices.getUserMedia` for hardware camera frame capture.
- Uses `navigator.geolocation.watchPosition` with `enableHighAccuracy: true` for physical GPS tracking.
- Uses `window.addEventListener('devicemotion')` for 3-axis accelerometer readings ($a_x, a_y, a_z$).
- Streams frames to `/stream/frame` and sensor packets to `/telemetry`.

### `dashboard/app.js` & `dashboard/index.html`
The central command center web interface:
- **Leaflet GIS Map**: Renders real-time bus locations, breadcrumb trail polylines, and geotagged defect markers over dark-mode OpenStreetMap tiles.
- **WebSocket Listener**: Listens on `/ws/events` for instant live HUD updates when new defects or telemetry packets arrive.
- **Work Orders Modal**: Allows civic operators to inspect visual evidence snapshots and dispatch repair work orders with 1 click.

---

## 2.5 `scripts/` Automation Utilities

- **`scripts/start_live.sh`**: Launches the Gartika platform in strict LIVE mobile sensing mode with 0 synthetic data.
- **`scripts/reset_to_live.py`**: Completely wipes mock records from `gartika.db`, purges `data/evidence/`, and sets `DEMO_MODE=false`.
- **`scripts/setup.sh`**: Installs dependencies and runs dataset validation.
- **`scripts/run_demo.sh`**: Runs the complete AI validation, evaluation, image prediction, and video ingestion demo.
- **`scripts/run_webcam_edge.py`**: Streams live frames from a laptop USB webcam or dashcam to the backend.

---

# 3. How The Files Work Together (End-to-End Architecture)

```text
               ┌──────────────────────────────────────────────┐
               │    MOBILE SENSING UNIT (Smartphone / Bus)    │
               │  mobile/index.html + mobile/app.js           │
               │  - Hardware Camera (1-5 FPS)                 │
               │  - Native GPS watchPosition (1 Hz)           │
               │  - DeviceMotion IMU Accelerometer (20 Hz)    │
               └───────────────┬──────────────────────────────┘
                               │
                HTTP Frame POST│  HTTP Telemetry POST
                               ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                      CENTRAL FASTAPI BACKEND                           │
 │                                                                        │
 │   /stream/frame                           /telemetry                   │
 │   (backend/app/routes/stream.py)          (backend/app/routes/telemetry)│
 │          │                                        │                    │
 │          ▼                                        ▼                    │
 │   ┌─────────────────────────────┐        ┌─────────────────┐           │
 │   │      EDGE AI PIPELINE       │        │ Update Bus GPS  │           │
 │   │  ai/pothole_detector.py     │        │ & Accelerometer │           │
 │   │  models/gartika_road_defect │        └────────┬────────┘           │
 │   │  + IMU Vibration Fusion     │                 │                    │
 │   └──────────────┬──────────────┘                 │                    │
 │                  │                                │                    │
 │                  ▼ (Defect Detected)              │                    │
 │   ┌─────────────────────────────┐                 │                    │
 │   │  Temporal Deduplicator      │                 │                    │
 │   │  (6s Cooldown & Spatial IoU)│                 │                    │
 │   └──────────────┬──────────────┘                 │                    │
 │                  │                                │                    │
 │                  ▼ (Actionable Event)             │                    │
 │   ┌─────────────────────────────┐                 │                    │
 │   │   Save Annotated Evidence   │                 │                    │
 │   │   to data/evidence/*.jpg    │                 │                    │
 │   └──────────────┬──────────────┘                 │                    │
 │                  │                                │                    │
 │                  ▼                                ▼                    │
 │   ┌────────────────────────────────────────────────────────┐           │
 │   │            SQLITE DATABASE (gartika.db)                │           │
 │   │   buses | events | work_orders | telemetry             │           │
 │   └────────────────────────┬───────────────────────────────┘           │
 │                            │                                           │
 │                            ▼                                           │
 │   ┌────────────────────────────────────────────────────────┐           │
 │   │       WEBSOCKET GATEWAY (backend/app/websocket.py)     │           │
 │   │       Broadcasts NEW_EVENT, TELEMETRY, BUS_UPDATE      │           │
 │   └────────────────────────┬───────────────────────────────┘           │
 └────────────────────────────┼───────────────────────────────────────────┘
                              │ Real-Time WebSocket Frame (/ws/events)
                              ▼
 ┌────────────────────────────────────────────────────────────────────────┐
 │                   COMMAND DASHBOARD (Operator Screen)                  │
 │   dashboard/index.html + dashboard/app.js                              │
 │   - Leaflet GIS Map: Live bus marker & color-coded defect pins         │
 │   - HUD Telemetry: Speed, GPS, and real-time bump vibration meter      │
 │   - Real-Time Detections Feed: Instant defect card with evidence photo │
 │   - Maintenance Work Orders: 1-Click municipal dispatch & status sync  │
 └────────────────────────────────────────────────────────────────────────┘
```

---

# 4. Application Entry Points

### 1. Live Mobile Sensing & GIS Command Platform
```bash
./scripts/start_live.sh
# or: python3 -m backend.app.main
```
- **What Starts:** FastAPI server on `0.0.0.0:8000` via Uvicorn.
- **Modules Loaded:** `backend.app.main`, `database.py`, `config.py`, all route handlers, `PotholeDetector`, `VehicleDetector`, and `ConnectionManager`.
- **Execution Flow:** Initializes database tables, mounts static assets, starts WebSocket hub, prints local Wi-Fi pairing URLs, and waits for incoming mobile camera frames and GPS telemetry.

### 2. Custom AI Model Training & Fine-Tuning
```bash
python3 training/train.py --epochs 30 --batch 8 --imgsz 640
```
- **What Starts:** YOLOv8 transfer learning pipeline.
- **Execution Flow:** Loads base checkpoint (`yolov8n.pt`), prepares data loader using `dataset/data.yaml`, applies road-tailored augmentations, runs mini-batch training, and exports the fine-tuned weights to `models/gartika_road_defect.pt`.

### 3. Road Defect Model Evaluation
```bash
python3 training/evaluate.py
```
- **What Starts:** Diagnostic evaluation suite.
- **Execution Flow:** Tests `models/gartika_road_defect.pt` on held-out validation and test sets, computes mAP@50 and mAP@50:95, audits false positive rates, and outputs `results/evaluation/metrics.json`.

### 4. Dashcam Video Stream Ingestion
```bash
python3 inference/predict_video.py --video data/videos/road_demo.mp4
```
- **What Starts:** Video inference CLI.
- **Execution Flow:** Reads MP4 frame-by-frame, runs `RoadDefectDetector.predict_frame()`, performs temporal deduplication, overlays HUD counters and bounding boxes, and writes the annotated output video.

---

# 5. Special & Configuration Files

- **`dataset/data.yaml`**: Standard YOLO dataset configuration file specifying root paths and defect class indices (`0: pothole`, `1: road_crack`, `2: waterlogging`, `3: damaged_road`).
- **`.env`**: Runtime environment file specifying port numbers, host IP, database connection string, and operational flags (`DEMO_MODE=false`).
- **`backend/requirements.txt`**: Minimal production dependencies for the FastAPI server, SQLite ORM, and WebSocket engine (`fastapi`, `uvicorn`, `sqlalchemy`, `pydantic`, `python-dotenv`).
- **`ai/requirements.txt`**: Machine learning dependencies for edge vision inference (`ultralytics`, `torch`, `torchvision`, `opencv-python`, `numpy`).
- **`Dockerfile`**: Container definition for building and deploying the unified Gartika platform with Python 3.11 and OpenCV dependencies.

---

# 6. Gartika Codebase Summary

1. **Main Entry Point:** [`backend/app/main.py`](file:///home/da/sih/prototype/backend/app/main.py) initializes the server, database schemas, and WebSocket streaming engine.
2. **AI Perception Pipeline:** [`ai/pothole_detector.py`](file:///home/da/sih/prototype/ai/pothole_detector.py) combines YOLOv8 multi-class detection with computer-vision contrast validation and physical IMU accelerometer bump shock fusion.
3. **Tracking Engine:** [`ai/tracker.py`](file:///home/da/sih/prototype/ai/tracker.py) implements ByteTrack for persistent vehicle counting across video frames.
4. **Model Training Pipeline:** [`training/train.py`](file:///home/da/sih/prototype/training/train.py) provides reproducible YOLOv8 fine-tuning with road-specific augmentations.
5. **Deduplication Layer:** [`inference/detector.py`](file:///home/da/sih/prototype/inference/detector.py) (`TemporalDeduplicator`) ensures that consecutive video frames of the same road pothole trigger exactly 1 actionable municipal event.
6. **Backend & ORM:** Scoped SQLAlchemy session dependencies in [`backend/app/database.py`](file:///home/da/sih/prototype/backend/app/database.py) and typed models in [`backend/app/models/`](file:///home/da/sih/prototype/backend/app/models/).
7. **Real-time Gateway:** [`backend/app/websocket.py`](file:///home/da/sih/prototype/backend/app/websocket.py) broadcasts live updates with zero polling overhead.
8. **Mobile Edge Sensing:** [`mobile/app.js`](file:///home/da/sih/prototype/mobile/app.js) captures raw video, GPS, and IMU data directly from smartphone hardware.
9. **GIS Command Center:** [`dashboard/app.js`](file:///home/da/sih/prototype/dashboard/app.js) provides real-time spatial defect visualization on a Leaflet map with 1-click work order dispatch.
10. **Zero-Mock Integrity:** All database tables and schemas operate on genuine hardware telemetry without synthetic fallbacks.

---

# 7. Most Important Files (Recommended Reading Order)

For a developer joining the Gartika project, here is the recommended reading order:

```text
1. backend/app/main.py        ➔ Understand application startup, routes, and WebSocket lifecycle
2. backend/app/config.py      ➔ Understand environment variables, filepaths, and network setup
3. backend/app/database.py    ➔ Understand SQLite connection and session management
4. backend/app/models/        ➔ Understand Bus, Event, Telemetry, and WorkOrder schemas
5. ai/pothole_detector.py     ➔ Understand hybrid YOLOv8 + OpenCV + IMU sensor fusion
6. backend/app/routes/stream.py ➔ Understand live frame ingestion, inference, and event dispatch
7. training/train.py          ➔ Understand YOLOv8 training and road augmentation strategy
8. inference/detector.py      ➔ Understand RoadDefectDetector and temporal deduplication
9. mobile/app.js              ➔ Understand smartphone camera, GPS, and motion sensor capture
10. dashboard/app.js          ➔ Understand GIS Leaflet visualization and real-time WebSocket sync
```
