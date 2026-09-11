# Gartika Mobile Edge Sensing Architecture

## 1. Overview

Gartika transforms standard municipal transit buses into intelligent, mobile road-sensing probes. Smart devices mounted behind vehicle windshields continuously gather multimodal telemetry:
- **Optical Stream:** Forward roadway imagery captured via camera sensors.
- **Geospatial Positioning:** High-accuracy GPS/GNSS coordinates, speed, heading, and dilution of precision.
- **Inertial Measurement Unit (IMU):** High-frequency 3-axis accelerometer and gyroscope samples detecting mechanical road impacts, vibrations, and vertical displacements.
- **Edge Diagnostics:** Device battery, network state, buffer queue depth, and frame processing metrics.

---

## 2. End-to-End System Architecture

```text
               SMARTPHONE / EDGE UNIT (Bus Mounted)
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
  Camera Sensor            GPS / GNSS                IMU Sensors
  (15 FPS Preview,         (1 Hz Watcher,          (50 Hz Accelerometer,
   1 FPS AI Capture)        ±5m Accuracy)           Gravity Compensated)
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                    Mobile Sensor Controller
                  (Lifecycle & Sensor States)
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
          Online Fast-Path             Offline Queue Path
                 │                     (IndexedDB Store,
                 │                      Persistent Sequences,
                 │                      Exponential Backoff)
                 │                             │
                 └──────────────┬──────────────┘
                                │
                     HTTPS / WSS Transport
                                │
                   GARTIKA FASTAPI BACKEND
                                │
       ┌────────────────────────┼────────────────────────┐
       │                        │                        │
  /api/v1/telemetry      /api/v1/stream/frame       /ws/events
  (GPS + IMU Ingest,     (Frame Ingest, CV AI,     (Real-Time Hub,
   Deduplication)         Object Tracking)          Bi-Directional)
       │                        │                        │
       └────────────────────────┼────────────────────────┘
                                │
                   MULTIMODAL FUSION ENGINE
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
         Road Defect Fusion           Telemetry & Fleet State
         - Visual AI Candidate        - Vehicle Registry
         - Temporal IMU Alignment     - Breadcrumb Trails
         - Spatial Deduplication      - Stale Node Detection
         - Multi-Bus Verification     - Speed & Heading
         - Closed-Loop Repair Check
                 │                             │
                 └──────────────┬──────────────┘
                                │
                   RELATIONAL PERSISTENCE
               (RoadDefects, Observations, Events)
                                │
                     OPERATIONS GIS DASHBOARD
             (Map, Fleet Health, Live Telemetry, Traceability)
```

---

## 3. Sensing Lifecycle & State Machine

The mobile sensor controller governs all hardware sensor streams and adheres to explicit finite state machines:

### Sensor State Taxonomy

| Subsystem | States | Description |
|---|---|---|
| **Camera** | `INITIALIZING`, `READY`, `RUNNING`, `PAUSED`, `ERROR`, `UNAVAILABLE` | Manages WebRTC media streams, resolution negotiation, and fallback canvas extraction. |
| **GPS** | `SEARCHING`, `FIXED`, `STALE`, `UNAVAILABLE`, `ERROR` | Tracks GNSS fix state, horizontal accuracy radius, and reading age (stale if > 5s). |
| **IMU** | `INITIALIZING`, `ACTIVE`, `PAUSED`, `UNAVAILABLE`, `ERROR` | Computes dynamic baseline gravity, filters high-frequency noise, and detects vertical shocks ($|a_z - g| > 3.5\text{ m/s}^2$). |
| **Network** | `ONLINE`, `OFFLINE`, `CONNECTING`, `RECONNECTING`, `ERROR` | Distinctly evaluates internet connectivity, backend HTTP `/health`, and WebSocket socket readiness. |
| **Queue** | `EMPTY`, `PENDING`, `FLUSHING`, `ERROR` | Monitors IndexedDB persistence buffer and dead-letter count. |
| **Edge AI** | `READY`, `PROCESSING`, `STANDBY`, `ERROR` | Tracks server-side and client-assisted inference pipeline. |

---

## 4. Sensor Data Flow & Temporal Alignment

1. **Telemetry Stream (1.0 Hz):**
   - Packets contain monotonic sequence numbers, ISO UTC timestamps, calibrated 3-axis acceleration ($a_x, a_y, a_z$), GPS coordinates, accuracy, speed, and heading.
   - Ingested via `POST /api/v1/telemetry`.
   - Buffered in per-bus rolling time-series buffers ($N = 500$ samples).

2. **Visual Capture Stream (0.5 – 1.0 Hz or shock-triggered):**
   - Forward camera frames are compressed to JPEG ($640 \times 480$ or $1280 \times 720$, 80% quality).
   - Ingested via `POST /api/v1/stream/frame`.
   - The backend runs YOLO road-defect detection and vehicle tracking.

3. **Temporal Alignment:**
   - When a frame arrives at $T_{\text{frame}}$, the fusion engine searches the IMU buffer for samples within $T_{\text{frame}} \pm 500\text{ ms}$.
   - Mechanical shock signals elevate visual confidence into verified road defect observations without double-counting scores.

4. **Offline Resilience:**
   - Cellular dead zones automatically route telemetry and manual photos into browser IndexedDB.
   - On network reconnection, the queue acquires a flush lock and transmits backlog items in FIFO order with exponential backoff retry.

---

## 5. Security & Privacy Guarantees

- **Anonymization at Ingestion:** All stored optical evidence frames pass through an automated Gaussian blurring privacy filter covering pedestrian faces and vehicle license plates.
- **Secure Contexts:** Sensor APIs (`getUserMedia`, `DeviceMotionEvent`, `Geolocation`) run under HTTPS or localhost origins.
- **No Secret Leakage:** Client applications communicate with backend public ingestion endpoints without embedded administrative secrets.
