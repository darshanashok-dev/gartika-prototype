# GARTIKA — AI-Powered Mobile Urban Intelligence Platform

> **Sense. Analyze. Fuse. Verify. Act.**  
> *Smart India Hackathon 2026 | Problem Statement ID: 26124 — Buses as Urban Sensors*  
> *Team: Tech Priests*

---

## 1. Executive Summary & Problem Statement

Urban road networks suffer from delayed hazard identification, inefficient manual road audits, and severe bandwidth bottlenecks when attempting to stream raw high-definition video from municipal fleet cameras to central cloud servers.

**Gartika** transforms moving public-transit buses and municipal vehicles into intelligent mobile urban sensing units. Using vehicle-mounted smartphone cameras, high-frequency IMU telemetry (50–100 Hz), and GPS receivers, buses continuously survey road surface health (potholes, speed breakers, structural cracks) and traffic density along their scheduled transit corridors.

Edge AI vision detection and spatio-temporal sensor fusion process video frames directly on the edge, transmitting lightweight JSON defect records and privacy-anonymized visual crops instead of raw video. This achieves a **99.71% reduction in cellular bandwidth** (a **344.9× efficiency multiplier**), cutting monthly data costs from over ₹1,00,000 to approximately ₹300 per 10-bus fleet.

---

## 2. The 6-Stage Intelligence Lifecycle

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. SENSE (Edge Mobile Sensing Unit)                                     │
│    - 1280x720 @ 15fps Dashcam Video Stream                              │
│    - 50 Hz 3-Axis IMU Accelerometer / Gyroscope (ax, ay, az)            │
│    - 1-5 Hz GPS Positioning & Velocity Telemetry                        │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. DETECT & TRACK (Edge AI Pipeline)                                    │
│    - YOLOv8 Defect Object Detection (`pothole`, `speed_breaker`, etc.)  │
│    - IoU Temporal Object Tracker (prevents multi-frame duplicate counts)│
│    - OpenCV Heuristic Fallback (zero-crash resilience on corrupt frames)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. SENSOR FUSION (Spatio-Temporal Fusion Engine)                        │
│    - Ring buffer temporal alignment (±1.5s Optical + IMU shock matching)│
│    - Spatial clustering deduplication (25.0m Haversine radius)          │
│    - Privacy filter anonymization (Gaussian blurring for plates & faces)│
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. MULTI-BUS VERIFICATION (Bayesian Corroboration)                      │
│    - Single observation: Defect created in `CANDIDATE` status           │
│    - Multi-bus sighting (≥ 2 distinct buses): Elevated to `VERIFIED`    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. VISUALIZE & ACT (GIS Operations Center & Work Orders)                │
│    - Utilitarian dark GIS command console with Leaflet map              │
│    - Work order lifecycle: `OPEN` → `ASSIGNED` → `IN_PROGRESS`          │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. CLOSED-LOOP REPAIR VERIFICATION                                     │
│    - Physical repair marked completed by contractor                     │
│    - Next bus transit evaluates road vibration at defect GPS location   │
│    - Smooth transit (|az| < 12 m/s²) ➔ Marked `REPAIR_VERIFIED`         │
│    - Shock re-detected ➔ Re-opened as `REPAIR_FAILED`                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Repository Architecture

```text
prototype/
├── ai/                      # YOLO & OpenCV detection models, IoU visual tracker
├── backend/app/
│   ├── fusion/              # Multi-bus ring buffer manager & spatio-temporal fusion
│   ├── models/              # SQLAlchemy database models (Defect, Bus, Telemetry, WorkOrder)
│   ├── routes/              # FastAPI REST endpoints & WebSocket broadcasters
│   └── schemas/             # Pydantic validation schemas
├── dashboard/               # Municipal GIS operations dashboard (HTML5 / Vanilla JS)
├── mobile/                  # Mobile sensing PWA client for bus-mounted smartphones
├── dataset/                 # YOLO dataset splits (train, val, test) and data.yaml
├── docs/                    # Complete engineering & architectural documentation suite
│   ├── ARCHITECTURE.md      # Comprehensive end-to-end architecture & dataflow
│   ├── AI_PIPELINE.md       # AI detection, IoU tracking, and fusion specs
│   ├── AI_CLASSES.md        # Supported defect taxonomy and annotation rules
│   ├── HARD_NEGATIVES.md    # Hard negative mining and false positive mitigation
│   ├── PROJECT_COMPLETION_AUDIT.md # Subsystem audit and TODO completion matrix
│   ├── FINAL_TEST_MATRIX.md # Automated test matrix and status results
│   ├── RELIABILITY_AUDIT.md # Failure-mode hardening and safe degradation rules
│   ├── DEMO_RUNBOOK.md      # Step-by-step SIH demonstration guide
│   └── STUDY_GUIDE.md       # In-depth technical study guide & system rationale
├── models/                  # Fine-tuned PyTorch (.pt) and ONNX runtime models
├── scripts/
│   ├── health_check.py      # Standalone system health & readiness verification
│   ├── demo.sh              # Single-command end-to-end demo launcher
│   ├── reset_demo.py        # Safe, deterministic demo state reset
│   ├── evaluate_metrics.py  # Precision, recall, F1, and throughput benchmarks
│   └── calculate_bandwidth.py # Raw video vs. Gartika edge bandwidth auditor
└── tests/                   # 33 passing automated test suites (Pytest)
```

---

## 4. Quick Start & Setup

### Prerequisites
- **Python:** 3.10+
- **Browser:** Google Chrome, Firefox, Chromium, or Safari

### Step 1: Install Dependencies
```bash
pip install -r backend/requirements.txt
```

### Step 2: Verify System Readiness
Run the comprehensive health check script:
```bash
python3 scripts/health_check.py
```

### Step 3: Launch the Demonstration System
```bash
./scripts/demo.sh
```
Or start the backend service directly:
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **Municipal GIS Dashboard:** `http://localhost:8000/`
- **Mobile Sensing Client:** `http://localhost:8000/mobile`
- **Interactive API Documentation:** `http://localhost:8000/docs`

---

## 5. Automated Test Suite

Gartika contains 33 comprehensive automated tests covering unit math, AI inference, API schemas, sensor fusion isolation, privacy filters, and failure-injection scenarios:

```bash
pytest -v
```

```text
============================== 33 passed in 3.60s ==============================
```

---

## 6. Failure Proofing & Reliability Principles

1. **Honest GPS Handling:** When satellite lock is unavailable (e.g., in transit tunnels or urban canyons), the system stores `latitude: null, longitude: null` with `location_status: "UNKNOWN_LOCATION"`. No synthetic coordinates are ever fabricated.
2. **Safe Fallback AI Inference:** If deep-learning weights are missing or a corrupted image frame is uploaded, the AI detector safely returns an empty detection list `[]` or invokes OpenCV contour heuristics without throwing unhandled HTTP 500 exceptions.
3. **Sensor Buffer Isolation:** Each vehicle unit maintains an independent circular ring buffer to prevent telemetry crosstalk between concurrent buses.
4. **Resilient WebSockets:** The municipal GIS dashboard gracefully reconnects on network interruptions without freezing or degrading operator controls.

---

## 7. Performance Benchmarks

| Metric | Measured Score / Value |
| :--- | :--- |
| **Precision (Visual + IMU Fusion)** | **93.88%** |
| **Recall (Defect Coverage)** | **92.00%** |
| **F1 Score** | **0.9293** |
| **Multi-Bus Corroboration Rate** | **89.80%** |
| **Edge Inference Latency (YOLOv8)** | **24.5 ms** |
| **Sensor Fusion Processing Latency** | **1.8 ms** |
| **Bandwidth Transmission Reduction** | **99.71% (344.9× efficiency)** |

---

## 8. Team Tech Priests — SIH 2026
Built for Smart India Hackathon 2026 — Problem Statement 26124 (*Buses as Urban Sensors*).
