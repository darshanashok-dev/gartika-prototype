# GARTIKA — AI-Powered Mobile Urban Intelligence Platform

> **Sense. Analyze. Predict. Act.**  
> *Smart India Hackathon 2026 | Problem Statement ID: 26124 — Buses as Urban Sensors*  
> *Team: Tech Priests*

---

## 1. How Gartika Works

**Gartika** turns moving public-transport buses and municipal fleets into real-time mobile urban intelligence platforms. Instead of relying on static CCTV cameras with limited field-of-view or delayed citizen complaints, transit buses continuously survey road surface conditions, traffic flows, and hazards along their regular routes.

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
│ 4. PREDICT & VISUALIZE │ ➔ Minimalist GIS Command Center with real-time bus tracking and defect markers
└───────────┬────────────┘
            │ Operator Inspection
            ▼
┌────────────────────────┐
│ 5. ACT (Work Orders)   │ ➔ Instant municipal work order creation and bi-directional status synchronization
└────────────────────────┘
```

---

## 2. End-to-End Architecture

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
│  │ - YOLOv8 Traffic Det │    │ - REST APIs          │  │
│  │ - ByteTrack Tracker  │───▶│ - Real-time WS Stream│  │
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
│  │ - Edge Camera preview window                     │  │
│  │ - Evidence inspection modal with 1-click WO      │  │
│  │ - Bandwidth savings comparison (99.97% reduction)│  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 3. How to Use with Mobile (Step-by-Step)

The prototype turns any smartphone into a mobile edge sensing terminal without requiring any app store installation.

### Step 1: Connect Laptop and Phone to the Same Network
- Connect both your laptop and smartphone to the **same Wi-Fi network**, OR
- Turn on your laptop's **mobile hotspot** and connect your smartphone to it.

### Step 2: Start the Gartika Platform on Your Laptop
Run the startup script from the project root:
```bash
./scripts/start_demo.sh
```
Or start the server directly:
```bash
python3 -m backend.app.main
```
The terminal will display your local network IP (e.g., `http://192.168.1.15:8000`).

### Step 3: Open the Mobile Sensing Web App on Your Phone
1. Open Chrome / Safari on your mobile phone.
2. Navigate to:
   ```text
   http://<YOUR-LAPTOP-IP>:8000/mobile
   ```
   *(Example: `http://192.168.1.15:8000/mobile`)*
3. You will see the dark **Gartika Edge Unit** sensing terminal.

### Step 4: Operate Mobile Sensing
- **Device ID:** Set to `BUS-101` (or custom bus number).
- **Tap `[ ⚡ START SENSING ]`:**
  - The phone starts capturing camera frames and telemetry.
  - GPS coordinates and speed update in real time.
- **Indoor / Simulation Controls:**
  - **Simulate Route GPS:** If testing indoors or without live GPS lock, tap `[ 📍 SIMULATE ROUTE GPS ]` to smoothly traverse the Bangalore transit corridor.
  - **Trigger Road Bump:** Tap `[ 💥 TRIGGER ROAD BUMP ]` to simulate hitting a pothole with the accelerometer (Z-axis shock `16.8 m/s²`).
- **Dashboard Synchronization:**
  - Look at your laptop screen on `http://localhost:8000` — the bus marker will move live on the map, telemetry updates every 2 seconds, and live camera frames appear in the preview box.

---

## 4. Quick Start for Presentation & Evaluation

### Prerequisites
- **Python:** 3.10+
- **Browser:** Google Chrome, Firefox, Edge, or Safari

### Single-Command Launch
```bash
./scripts/start_demo.sh
```

### URLs at a Glance
| Interface | URL | Purpose |
|---|---|---|
| **GIS Command Center** | `http://localhost:8000` | Full urban intelligence dashboard |
| **Mobile Sensing Unit** | `http://<laptop-ip>:8000/mobile` | Smartphone camera & sensor terminal |
| **Interactive API Docs** | `http://localhost:8000/docs` | Swagger OpenAPI backend testbed |
| **Health Check** | `http://localhost:8000/health` | Backend and subsystem status |

---

## 5. Live Presentation Walkthrough Script

| Step | Action | Observed Result on Screen |
|---|---|---|
| **1** | Open `http://localhost:8000` | **Gartika Command Center** displays active fleet summary, dark GIS map, and metrics. |
| **2** | Start Sensing on Phone | Bus status switches to **ACTIVE**, and real-time speed & coordinates update. |
| **3** | AI Detection in Action | Detections appear live in the **Real-Time Event Feed** via WebSockets with confidence scores. |
| **4** | Defect Inspection | Click on any Pothole event card or map pin to open the **Evidence Modal** showing the localized bounding-box frame and IMU vibration fusion. |
| **5** | Work Order Dispatch | Click **`[ 📋 DISPATCH WORK ORDER ]`** to instantly generate maintenance ticket `WO-XXXX`. Status is synced across all clients. |
| **6** | Bandwidth Proof | Point to the **Bandwidth Comparison Panel** demonstrating **99.97% transmission reduction** (~0.035 GB vs 144 GB/day) due to edge processing. |

---

## 6. Key Innovations & Technical Highlights

### 1. Dual AI Sensing Pipeline
- **Traffic & Vehicle Counting:** YOLOv8 detects urban transport classes (`car`, `bus`, `truck`, `motorcycle`, `bicycle`). Integrated **ByteTrack** ensures persistent ID tracking across frames to avoid double-counting.
- **Road Defect Detection:** Vision-based pothole and crack classification boosted by multi-modal IMU accelerometer fusion.

### 2. Spatial & Temporal Deduplication
- Prevents redundant alerts when a vehicle slows down or stops over a defect using a **5-second temporal cooldown** and a **20-meter spatial Haversine threshold**.

### 3. Privacy-by-Design
- Local frame anonymization: Automatic blurring of human faces and vehicle license plates before evidence crops are stored.

### 4. Edge vs Cloud Bandwidth Optimization
- **Continuous Raw Video:** `~144 GB / vehicle / day`
- **Gartika Edge Telemetry:** `~0.035 GB / vehicle / day`
- **Reduction:** **99.97%** data savings, allowing scale to thousands of buses over 4G/5G cellular.

---

## 7. Individual Service Commands (Manual Run)

### Backend & Command Center
```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

### AI Video Processing Engine
```bash
# Run on demo road video
python3 ai/video_processor.py --source demo --bus-id BUS-101

# Run on connected webcam
python3 ai/video_processor.py --source 0

# Run with visual OpenCV preview window
python3 ai/video_processor.py --source demo --display
```

### Seed Synthetic Demo Dataset
```bash
python3 scripts/seed_demo_data.py
```

### Reset to Clean Real-Time Live State
```bash
python3 scripts/reset_to_live.py
```

### Run Edge Ingestion / Webcam Streamer
```bash
# Ingest live USB webcam or built-in camera to backend with real-time inference
python3 scripts/run_webcam_edge.py --camera 0

# Stream dashcam video file as live edge input
python3 scripts/run_webcam_edge.py --video path/to/dashcam.mp4
```

### Run Full Test Suite
```bash
pytest tests/
```

---

## 8. REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Subsystem status, DB connection, local IP |
| `GET` | `/stats` | Fleet summary, road defects, vehicle totals, bandwidth |
| `POST` | `/events` | Ingest AI detection event (geotagged) |
| `GET` | `/events` | Filter events by type, severity, confidence, or bus |
| `GET` | `/events/{id}` | Retrieve individual event details |
| `PATCH`| `/events/{id}` | Update event status / severity |
| `POST` | `/telemetry` | Ingest GPS & IMU vibration telemetry from phone |
| `GET` | `/buses` | Retrieve active buses and telemetry positions |
| `POST` | `/stream/frame` | Upload live camera frame from mobile unit (triggers CV detection) |
| `GET` | `/stream/latest-frame`| Retrieve latest JPEG frame for live stream preview |
| `POST` | `/work-orders` | Dispatch maintenance work order from detection event |
| `GET` | `/work-orders` | Retrieve list of maintenance work orders |
| `PATCH`| `/work-orders/{id}` | Update work order status (`OPEN`, `ASSIGNED`, `IN PROGRESS`, `RESOLVED`) |
| `WS` | `/ws/events` | High-speed real-time WebSocket event stream |

---

## 9. Production Hardware Scaling Roadmap

While this prototype uses a smartphone and laptop for demonstration, the production hardware roadmap transitions to:

```text
Raspberry Pi 5 (8GB) + Hailo-8 M.2 AI Accelerator (26 TOPS)
       ├── 4x Sony IMX HDR Cameras (Front, Left, Right, Road Surface)
       ├── Industrial Multi-constellation GNSS (GPS / NavIC) + 6-Axis IMU
       ├── Automotive DC-DC Power & Supercapacitor Backup UPS
       └── Industrial 4G/5G Cellular Gateway (MQTT over TLS)
```

---

## 10. Troubleshooting & Utilities

- **Mobile Camera Permissions on HTTP:**
  Mobile browsers restrict continuous `getUserMedia()` camera streams to HTTPS on non-localhost IPs. The mobile terminal provides both native file snapshot capture (`Take Snapshot Frame`) and **Simulate Route GPS** & **Trigger Road Bump** tools, ensuring 100% of features work seamlessly on any device.
- **Port 8000 Already in Use:**
  Set `BACKEND_PORT=8080` in `.env` or run `uvicorn backend.app.main:app --port 8080`.
- **Reset to Clean Live State (Zero Mock Data):**
  Run `python3 scripts/reset_to_live.py`.
- **Seed Synthetic Demo Dataset (Optional):**
  Run `python3 scripts/seed_demo_data.py`.

---

*Developed for Smart India Hackathon 2026 by Team Tech Priests.*

