# GARTIKA — AI-Powered Mobile Urban Intelligence Platform

> **Sense. Analyze. Predict. Act.**  
> *Smart India Hackathon 2026 | Problem Statement ID: 26124 — Buses as Urban Sensors*  
> *Team: Tech Priests*

---

## 1. Overview & Problem Statement

Urban road networks suffer from delayed hazard identification, inefficient manual road audits, and severe bandwidth bottlenecks when transmitting raw video streams from fleet cameras. 

**Gartika** transforms moving public-transport buses and municipal fleets into real-time mobile urban intelligence platforms. Instead of relying on static CCTV cameras with limited field-of-view or delayed citizen complaints, transit buses continuously survey road surface conditions, traffic flows, and hazards along their regular routes using edge AI and sensor fusion.

### The 5-Stage Intelligence Loop

```text
┌────────────────────────┐
│ 1. SENSE (Smartphone)  │ ➔ Front camera, GPS coordinates & 3-axis accelerometer (IMU)
└───────────┬────────────┘
            │ Real-time Telemetry & Frames
            ▼
┌────────────────────────┐
│ 2. ANALYZE (AI Engine) │ ➔ YOLOv8 object detection + ByteTrack vehicle counter + Pothole detector
└───────────┬────────────┘
            │ Sensor Fusion (Z-shock vibration + vision bounding box)
            ▼
┌────────────────────────┐
│ 3. STRUCTURE (Backend) │ ➔ Geotagged JSON event with anonymized visual evidence (99.97% bandwidth reduction)
└───────────┬────────────┘
            │ Non-blocking WebSocket Broadcast & SQLite Storage
            ▼
┌────────────────────────┐
│ 4. PREDICT & VISUALIZE │ ➔ Enterprise GIS Command Center with real-time bus tracking and defect markers
└───────────┬────────────┘
            │ Operator Inspection
            ▼
┌────────────────────────┐
│ 5. ACT (Work Orders)   │ ➔ Instant municipal work order creation and bi-directional status synchronization
└────────────────────────┘
```

---

## 2. End-to-End System Architecture

```text
┌────────────────────────────────────────────────────────┐
│             MOBILE SENSING UNIT (BUS-101)              │
│  - Smartphone mounted on bus windshield                │
│  - Web App at http://<laptop-ip>:8000/mobile           │
│  - Features: Live Camera, GPS Telemetry, IMU Shock     │
└───────────────────────────┬────────────────────────────┘
                            │ Wi-Fi / Hotspot (HTTP & Telemetry)
                            ▼
┌────────────────────────────────────────────────────────┐
│            CENTRAL URBAN INTELLIGENCE HUB              │
│                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │      AI ENGINE       │    │   FASTAPI BACKEND    │  │
│  │ - YOLOv8 Traffic Det │    │ - REST & WebSocket   │  │
│  │ - ByteTrack Tracker  │───▶│ - Real-time Ingestion│  │
│  │ - Pothole Detector   │    │ - Bus Registry       │  │
│  │ - IMU Sensor Fusion  │    │ - Work Orders Engine │  │
│  │ - Deduplication (5s) │    └──────────┬───────────┘  │
│  └──────────────────────┘               │              │
│                                         ▼              │
│  ┌──────────────────────────────────────────────────┐  │
│  │                 SQLITE DATABASE                  │  │
│  │    (buses, events, work_orders, telemetry)       │  │
│  └──────────────────────┬───────────────────────────┘  │
│                         │                              │
│                         ▼                              │
│  ┌──────────────────────────────────────────────────┐  │
│  │            GIS COMMAND DASHBOARD                 │  │
│  │ - Live dark-mode Leaflet map with Bus follow     │  │
│  │ - Real-time AI event stream & category filters   │  │
│  │ - Edge Camera preview window (1 FPS sync)        │  │
│  │ - Evidence inspection modal with 1-click WO      │  │
│  │ - Bandwidth savings comparison (99.97% reduction)│  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Quick Start & Setup

### Prerequisites
- **Python:** 3.10+
- **Browser:** Google Chrome, Firefox, Safari, or Microsoft Edge

### Step 1: Install Dependencies
```bash
pip install -r backend/requirements.txt
pip install -r ai/requirements.txt
```

### Step 2: Start the Central Platform in Live Mode
Run the live startup script (strict live mode, 0 fake data):
```bash
./scripts/start_live.sh
```
Or run directly via Python:
```bash
python3 -m backend.app.main
```
The terminal will display your local network access URLs (e.g. `https://192.168.0.110:8000`).

---

### Optional: Demonstration Mode (For Offline Simulation)
If you wish to run with pre-generated simulation data for offline testing:
```bash
./scripts/start_demo.sh
```

---

## 4. Platform Interfaces

| Interface | URL | Description |
|---|---|---|
| **GIS Command Center** | `http://localhost:8000/` or `/dashboard/` | Full dark-mode urban intelligence GIS map & metrics |
| **Mobile Sensing Unit** | `http://<laptop-ip>:8000/mobile` | Smartphone camera & sensor ingestion terminal |
| **Interactive API Docs** | `http://localhost:8000/docs` | Swagger / OpenAPI backend testbed |
| **Health Check** | `http://localhost:8000/health` | Backend and subsystem status JSON |

---

## 5. Ingestion Modes: Real-Time vs Demo

### Mode A: Real-Time Mobile Sensing (Smartphone)
1. Connect your phone to the same Wi-Fi network or mobile hotspot as your laptop.
2. Open `http://<YOUR-LAPTOP-IP>:8000/mobile` in your mobile browser.
3. Tap **`[ START SENSING ]`**:
   - The phone streams live GPS coordinates and 3-axis accelerometer readings to the backend.
   - Tap **`[ Take Snapshot Frame ]`** or allow camera access to upload live visuals.
   - Tap **`[ TRIGGER ROAD BUMP ]`** to simulate an immediate accelerometer spike ($a_z = 16.8\text{ m/s}^2$). The backend fuses this with the latest camera frame and triggers a verified `POTHOLE` event on the GIS map.

### Mode B: Real-Time USB Webcam / Dashcam Streamer
Stream from a connected webcam, USB dashcam, or pre-recorded MP4 video file through the AI pipeline into the backend:
```bash
# Stream from primary webcam
python3 scripts/run_webcam_edge.py --camera 0

# Stream from MP4 video file
python3 scripts/run_webcam_edge.py --video path/to/dashcam.mp4
```

### Mode C: Clean Live State vs Synthetic Demo
- **Reset to 100% Clean Real-Time State (No Fake Data):**
  ```bash
  python3 scripts/reset_to_live.py
  ```
  *(Ensures `DEMO_MODE=false`, clears mock records, and listens only for live data)*
- **Seed Synthetic Demo Dataset (Optional Presentation Mode):**
  ```bash
  python3 scripts/seed_demo_data.py
  ```

---

## 6. Key Innovations & Technical Highlights

### 1. Dual AI Sensing Pipeline
- **Traffic & Vehicle Counting:** YOLOv8 detects urban transport classes (`car`, `bus`, `truck`, `motorcycle`, `bicycle`). Integrated **ByteTrack** ensures persistent ID tracking across frames to avoid duplicate counts.
- **Road Defect Detection:** Vision-based pothole and crack classification boosted by multi-modal IMU accelerometer fusion.

### 2. Multi-Modal Sensor Fusion
- Accelerometer vertical shock spikes ($a_z > 13.5\text{ m/s}^2$ or $\Delta a_z > 4.0\text{ m/s}^2$) automatically match the spatial timestamp with the active camera feed, annotating and confirming severe road distress.

### 3. Spatial & Temporal Deduplication
- Prevents redundant alerts when a vehicle slows down or stops over a defect using a **5-second temporal cooldown** and a **20-meter spatial Haversine threshold**.

### 4. Privacy-by-Design
- Local frame anonymization: Automatic blurring of human faces and vehicle license plates before evidence crops are persisted.

### 5. Edge vs Cloud Bandwidth Optimization
- **Continuous Raw Video:** `~144 GB / vehicle / day`
- **Gartika Edge Telemetry:** `~0.035 GB / vehicle / day`
- **Transmission Reduction:** **99.97%** bandwidth savings, enabling massive municipal fleet scaling over standard cellular networks.

---

## 7. Versioned REST & WebSocket API Reference

All core endpoints are exposed with versioning under `/api/v1` and maintained with root aliases for backward compatibility.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/health` | Service health, DB connectivity, uptime |
| `GET` | `/api/v1/ready` | Readiness probe for container orchestration |
| `GET` | `/api/v1/stats` | Observability metrics, fleet totals, verification stats |
| `GET` | `/api/v1/defects` | Query persistent physical defects with multi-bus status |
| `GET` | `/api/v1/defects/{id}/observations` | Chronological observation history across buses |
| `POST`| `/api/v1/telemetry` | Ingest IMU/GPS telemetry and trigger bump shock fusion |
| `POST`| `/api/v1/stream/frame` | Upload live camera frame for real-time edge CV inference |
| `GET` | `/api/v1/stream/latest-frame` | Retrieve latest JPEG frame for live stream preview |
| `POST`| `/api/v1/work-orders` | Dispatch maintenance work order from verified defect |
| `GET` | `/api/v1/work-orders` | List active municipal maintenance orders |
| `PATCH`| `/api/v1/work-orders/{id}` | Update repair order lifecycle status |
| `WS`  | `/ws/events` | High-speed real-time WebSocket event broadcast stream |

---

## 8. Deterministic Multi-Bus Simulation & Bandwidth Audit

### 1. Run the Deterministic 8-Step Simulation
Executes the end-to-end multi-bus detection $\rightarrow$ verification $\rightarrow$ work order dispatch $\rightarrow$ closed-loop repair audit:
```bash
python3 scripts/run_demo.py
```

### 2. Run the Bandwidth & Cost Calculation Script
Computes theoretical and measured network transmission reduction between raw cloud video and Gartika edge sensing:
```bash
python3 scripts/calculate_bandwidth.py --fleet 10 --hours 8
```

---

## 9. Automated Test Suite

Run the full pytest suite covering AI detectors, API routes, sensor fusion buffers, multi-bus elevation, closed-loop repair audits, and end-to-end loops:
```bash
pytest tests/ -v
```

---

## 10. Production Hardware Scaling Roadmap

```text
Raspberry Pi 5 (8GB) + Hailo-8 M.2 AI Accelerator (26 TOPS)
       ├── 4x Sony IMX HDR Cameras (Front, Left, Right, Road Surface)
       ├── Industrial Multi-constellation GNSS (GPS / NavIC) + 6-Axis IMU
       ├── Automotive DC-DC Power & Supercapacitor Backup UPS
       └── Industrial 4G/5G Cellular Gateway (MQTT over TLS)
```

---

## 11. Troubleshooting & FAQ

- **Camera Permissions over HTTP on Mobile:**
  Mobile browsers restrict continuous `getUserMedia()` streams to HTTPS on non-localhost IPs. The mobile terminal includes native snapshot capture and **Simulate Route GPS** & **Trigger Road Bump** tools that work seamlessly across all mobile devices.
- **Port 8000 Already in Use:**
  Set `BACKEND_PORT=8080` in `.env` or start uvicorn with `--port 8080`.
- **Reset to Clean Live State:**
  Run `python3 scripts/reset_to_live.py`.

---

*Developed for Smart India Hackathon 2026 by Team Tech Priests.*

