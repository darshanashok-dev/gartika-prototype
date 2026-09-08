# GARTIKA — AI-Powered Mobile Urban Intelligence Platform

> **Sense. Analyze. Predict. Act.**  
> *Smart India Hackathon 2026 | Problem Statement ID: 26124 — Buses as Urban Sensors*

---

## 1. Overview

**Gartika** turns moving public-transport vehicles (buses, trams, municipal shuttles) into intelligent, mobile urban sensing units. Instead of relying on expensive static CCTV cameras or delayed manual citizen complaints, buses continuously survey the city's road infrastructure during their routine daily transit routes.

This working prototype validates the complete end-to-end intelligence loop:

```text
SMARTPHONE (Mobile Bus Sensor)
    ↓ (Camera + GPS + Accelerometer/IMU)
AI ENGINE (Laptop)
    ↓ (YOLOv8 Vehicle Detection + ByteTrack + Pothole Defect Detector)
STRUCTURED GEOTAGGED EVENT
    ↓ (Event ID, Lat/Lon, Timestamp, Severity, Anonymized Evidence)
FASTAPI BACKEND & SQLITE DATABASE
    ↓ (Real-time WebSockets & REST APIs)
GIS COMMAND DASHBOARD
    ↓ (Live Bus Tracking, Defect Markers, Traffic Heatmaps)
ACTION: MAINTENANCE WORK ORDER
```

---

## 2. System Architecture

```text
┌─────────────────────────────────┐
│     SMARTPHONE (BUS-101)        │
│  - Road Camera Preview          │
│  - Geolocation (Lat/Lon)        │
│  - IMU Vibration (ax, ay, az)   │
│  - Web Interface (/mobile)      │
└───────────────┬─────────────────┘
                │ Wi-Fi / Hotspot (HTTP & Telemetry)
                ▼
┌─────────────────────────────────────────────────────────────┐
│              LAPTOP URBAN INTELLIGENCE CENTER               │
│                                                             │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │   AI INFERENCE CORE   │       │    FASTAPI BACKEND    │  │
│  │ - YOLOv8 Vehicle Det. │       │ - REST APIs (/events) │  │
│  │ - ByteTrack Tracking  │──────▶│ - WebSockets (/ws)    │  │
│  │ - Pothole Detector    │       │ - Bus Registry        │  │
│  │ - IMU Sensor Fusion   │       │ - Work Orders Engine  │  │
│  │ - Deduplication (5s)  │       └───────────┬───────────┘  │
│  └───────────────────────┘                   │              │
│                                              ▼              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  SQLITE DATABASE                      │  │
│  │     (buses, events, work_orders, telemetry)          │  │
│  └───────────────────────────┬───────────────────────────┘  │
│                              │                              │
│                              ▼                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                GIS COMMAND DASHBOARD                  │  │
│  │ - Real-time Leaflet Map with Bus Follow Mode          │  │
│  │ - Road Defect Inspection Drawer & Evidence Viewer     │  │
│  │ - Instant Work Order Creation (WO-001)                │  │
│  │ - Bandwidth Savings Display (~0.035 vs 144 GB/day)    │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Quick Start (One-Command Launch)

### Prerequisites
- **Python:** 3.10+
- **Browser:** Chrome, Firefox, Safari, or Edge

### 1-Step Startup
Run the unified demo script from the project root:

```bash
./scripts/start_demo.sh
```

This single command automatically:
1. Initializes and seeds the SQLite database with realistic events and route waypoints.
2. Synthesizes a demo road video if not already present.
3. Launches the **FastAPI Backend Server** on `http://0.0.0.0:8000`.
4. Serves the **GIS Command Center** on `http://localhost:8000`.
5. Launches the **AI Ingestion Engine** processing the road video and detecting vehicles/potholes.
6. Prints your laptop's Wi-Fi IP for connecting your phone.

---

## 4. Connecting Your Smartphone (Live Sensing Mode)

1. Connect your smartphone to the **same Wi-Fi network** or to your laptop's **mobile hotspot**.
2. Open your smartphone browser and navigate to:
   ```text
   http://<YOUR-LAPTOP-IP>:8000/mobile
   ```
   *(The exact IP is printed on the terminal when starting the demo, e.g., `http://192.168.1.15:8000/mobile`)*
3. On the **Gartika Edge Unit** mobile page:
   - Verify device ID is set to `BUS-101`.
   - Tap **START SENSING**.
   - Grant Camera and GPS permissions (or tap **SIMULATE ROUTE GPS** for indoor testing).
   - Tap **TRIGGER ROAD BUMP** to test physical vibration sensor fusion!

---

## 5. End-to-End Demo Script & Presentation Story

| Step | Action | What You See on Screen |
|---|---|---|
| **1** | Open `http://localhost:8000` | **Gartika Command Center** opens with live metrics, dark GIS map, and Bus card. |
| **2** | Start Sensing on Phone / AI Video | `BUS-101` status switches to **ACTIVE (ONLINE)** and moves smoothly along the corridor. |
| **3** | AI Vehicle Detection & Tracking | AI identifies cars, buses, and bikes, assigning persistent **ByteTrack IDs** (`CAR #1`, `BUS #2`). |
| **4** | Road Defect Detection | AI identifies a pothole, calculates confidence (**91.4%**), and combines IMU vibration. |
| **5** | Event Geotagging & Transmission | Structured event is emitted to backend. Red marker 🔴 appears in real-time on GIS Map. |
| **6** | Event Inspection | Click the pothole marker or feed card to open the **Evidence Modal** with privacy-blurred snapshot. |
| **7** | Create Work Order | Click **`[ CREATE WORK ORDER ]`**. Maintenance ticket `WO-101` is instantly dispatched to BBMP road cells. |

---

## 6. Key Features & Innovation Highlights

### A. Dual Sensing Pipeline
- **Pipeline A (Traffic & Vehicles):** YOLOv8 detects urban transport classes (`car`, `bus`, `truck`, `motorcycle`, `bicycle`, `person`). ByteTrack prevents duplicate counting.
- **Pipeline B (Road Defects):** Pothole and surface crack detector with multi-modal IMU vibration fusion (Z-axis acceleration bump boosts confidence from 0.82 to 0.94).

### B. Intelligent Event Deduplication
- Prevents generating hundreds of duplicate alerts for the same defect across consecutive frames using a **5-second temporal cooldown** and **20-meter spatial Haversine radius**.

### C. Bandwidth Reduction (Edge vs Cloud)
- **Continuous Raw Video:** `~144 GB / bus / day`
- **Gartika Structured Events:** `~0.035 GB / bus / day`
- **Bandwidth Reduction:** **99.97%** *(Design Estimate)*

### D. Privacy-by-Design
- Local frame anonymization: Automatic Gaussian blurring of detected persons and license plates before evidence crops are stored.

---

## 7. Individual Service Commands (Manual Run)

If you wish to run services individually in separate terminals:

### Terminal 1: Backend & Dashboard
```bash
# Activate your python environment
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Terminal 2: AI Video Processor
```bash
# Run AI engine on demo video
python3 ai/video_processor.py --source demo --bus-id BUS-101

# Or run with visual OpenCV GUI display
python3 ai/video_processor.py --source demo --display

# Or run on connected webcam
python3 ai/video_processor.py --source 0
```

### Seed Demo Data Anytime
```bash
python3 scripts/seed_demo_data.py
```

---

## 8. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | System status, edge connectivity, local IP |
| `GET` | `/stats` | Fleet summary, defect count, bandwidth metrics |
| `POST` | `/events` | Ingest AI detected event |
| `GET` | `/events` | Retrieve list of events (filter by type/severity) |
| `GET` | `/events/{event_id}` | Retrieve specific event details |
| `POST` | `/telemetry` | Ingest GPS & IMU vibration telemetry from phone |
| `GET` | `/buses` | Retrieve active buses and coordinates |
| `POST` | `/work-orders` | Dispatch maintenance work order from event |
| `GET` | `/work-orders` | Retrieve list of open/assigned work orders |
| `WS` | `/ws/events` | Real-time WebSocket event stream |

---

## 9. Future Production Architecture

While this prototype uses a smartphone and laptop for agile demonstration, the production hardware roadmap scales to:

```text
Raspberry Pi 5 (8GB RAM)
       +
Hailo-8 M.2 AI Accelerator (26 TOPS)
       +
4x Sony IMX HDR Cameras (Front, Left, Right, Road-Facing)
       +
Industrial Multi-constellation GNSS (GPS/NavIC) + 6-Axis IMU
       +
Automotive DC-DC Power & Supercapacitor UPS
       +
Industrial 4G/5G Cellular Gateway (MQTT over TLS)
```

The core architecture remains identical:
**Edge AI Detection ➔ Structured Telemetry ➔ Central Municipal Intelligence ➔ Immediate Corrective Action.**

---

## 10. Troubleshooting

- **Mobile Camera Not Opening in Browser:**
  Modern mobile browsers require HTTPS for camera permissions on external IPs. If testing over plain HTTP on Wi-Fi, the app automatically enables the **Synthetic Stream Fallback** and **Simulate Route GPS**, allowing 100% of the demo features to work smoothly.
- **Port 8000 Already in Use:**
  Set `BACKEND_PORT=8080` in `.env` or run `uvicorn backend.app.main:app --port 8080`.
- **Resetting Demo Data:**
  Simply execute `python3 scripts/seed_demo_data.py`.

---

*Developed for Smart India Hackathon 2026 by Team Tech Priests.*
