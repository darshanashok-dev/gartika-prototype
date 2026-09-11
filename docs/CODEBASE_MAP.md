# Gartika Codebase Map & Source Index

This document maps every file in the Gartika repository, explaining its purpose, dependencies, inputs/outputs, and algorithmic responsibilities.

---

## Backend Subsystem (`backend/app/`)

### 1. Core Application & Configuration
- [`backend/app/main.py`](file:///home/da/sih/prototype/backend/app/main.py)
  - **Purpose**: FastAPI application factory, lifespan startup migrations, CORS middleware, versioned `/api/v1` router registration, static asset mounts, and WebSocket gateway.
  - **Inputs**: Incoming HTTP requests, WebSocket client handshakes.
  - **Outputs**: Versioned REST JSON responses, WebSocket event stream.
- [`backend/app/config.py`](file:///home/da/sih/prototype/backend/app/config.py)
  - **Purpose**: Centralized application settings, environment variable parsing, and configurable thresholds (`IMU_VERTICAL_SHOCK_THRESHOLD`, `SPATIAL_DEDUP_METERS`, `REPAIR_VERIFICATION_CLEAN_COUNT`).
- [`backend/app/database.py`](file:///home/da/sih/prototype/backend/app/database.py)
  - **Purpose**: SQLAlchemy ORM engine, connection pooling, and scoped database session dependency (`get_db`).
- [`backend/app/auth.py`](file:///home/da/sih/prototype/backend/app/auth.py)
  - **Purpose**: Lightweight role-based authorization (`ADMIN`, `OPERATOR`, `MOBILE_UNIT`, `VIEWER`), API key verification, and WebSocket handshake validation.
- [`backend/app/websocket.py`](file:///home/da/sih/prototype/backend/app/websocket.py)
  - **Purpose**: Centralized connection manager broadcasting real-time JSON events to all active dashboard clients.

### 2. Multi-Modal Sensor Fusion Engine (`backend/app/fusion/`)
- [`backend/app/fusion/buffer.py`](file:///home/da/sih/prototype/backend/app/fusion/buffer.py)
  - **Purpose**: Thread-safe circular ring buffer isolating telemetry and camera frames per `bus_id`. Implements running average gravity baseline estimation ($ar{g}$).
- [`backend/app/fusion/engine.py`](file:///home/da/sih/prototype/backend/app/fusion/engine.py)
  - **Purpose**: Multi-modal fusion core. Handles temporal window alignment ($\pm 800	ext{ms}$), Haversine spatial deduplication ($15	ext{m}$), privacy blurring, and closed-loop repair verification.
- [`backend/app/fusion/models.py`](file:///home/da/sih/prototype/backend/app/fusion/models.py)
  - **Purpose**: Internal dataclasses (`ImuReading`, `FrameData`, `FusionResult`, `ImpactCandidate`).

### 3. Data Models & Schemas
- [`backend/app/models/defect.py`](file:///home/da/sih/prototype/backend/app/models/defect.py): `RoadDefect`, `Observation`, `Event`, `Bus`, `WorkOrder`.
- [`backend/app/schemas/defect.py`](file:///home/da/sih/prototype/backend/app/schemas/defect.py): Pydantic validation schemas with nullable coordinate support and score breakdown fields.

### 4. REST API Routes (`backend/app/routes/`)
- `routes/telemetry.py`: Ingests GPS + IMU telemetry packets.
- `routes/stream.py`: Ingests camera frames, runs AI detection, and triggers fusion.
- `routes/defects.py`: Defect filtering, spatial search, and lifecycle status updates.
- `routes/buses.py`: Bus fleet registration, heartbeat, and status queries.
- `routes/work_orders.py`: Municipal work order CRUD and dispatch.
- `routes/stats.py`: Aggregate KPI metrics and system health.

---

## AI & Computer Vision (`ai/`)
- [`ai/pothole_detector.py`](file:///home/da/sih/prototype/ai/pothole_detector.py)
  - **Purpose**: Dual-engine defect detector. Executes YOLOv8 when weights exist, falling back to OpenCV contour and texture analysis.
- [`ai/tracker.py`](file:///home/da/sih/prototype/ai/tracker.py)
  - **Purpose**: `IoUTracker` multi-object vehicle tracker. Maintains track IDs and vehicle counts using Intersection-over-Union matching.
- [`ai/vehicle_detector.py`](file:///home/da/sih/prototype/ai/vehicle_detector.py)
  - **Purpose**: Vehicle localization for traffic density estimation.

---

## Web Frontends
- `dashboard/`: Modern enterprise urban intelligence GIS control center (Vite/Vanilla JS + Leaflet + TailwindCSS).
- `mobile/`: Responsive smartphone sensing interface for windshield mounting.
