# Gartika — Municipal Operations & Fleet Intelligence Dashboard

**Gartika Operations Console** is the frontend command and control application for the Gartika Urban Intelligence Platform (SIH 2026, Problem Statement 26124).

Built with **React 18**, **Vite 5**, **Tailwind CSS**, and **Leaflet GIS**, it delivers a low-latency, utilitarian operations interface designed for municipal transit engineers and road maintenance teams.

---

## 1. Core Capabilities & Architecture

- **Information Architecture:**
  - **Overview (`/`):** Real-time situational KPIs, active sensing fleet count, detected road cavities, verified anomalies, open work orders, and live 50Hz ingestion stream.
  - **Live GIS Map (`/map`):** Interactive dark-matter Leaflet map showing active bus nodes (velocity, heading, status) and defect markers color-coded by severity (Critical/High red, Medium amber, Verified green).
  - **Defects Catalog (`/defects`):** Spatially deduplicated road defects with multi-column filtering, sorting, CSV export, and slide-over defect inspector drawer.
  - **Fleet Registry (`/fleet`):** Complete vehicle node inventory with real-time GNSS lock status, 3-axis IMU calibration readiness, and camera streaming health.
  - **Work Orders (`/work-orders`):** Municipal maintenance dispatch pipeline (`OPEN` $\to$ `ASSIGNED` $\to$ `IN_PROGRESS` $\to$ `REPAIR_PENDING` $\to$ `CLOSED`) integrated with closed-loop transit vibration re-verification.
  - **Analytics & Reports (`/analytics`):** Real-world evaluation metrics on held-out test splits (99.50% mAP@50), edge latency profiles (26.3 ms), and 99.71% cellular bandwidth savings benchmarks.
  - **System & Health (`/settings`):** Live REST health check probe inspector, detection thresholds review, and demo mode indicator.

---

## 2. Development & Production Build

### Prerequisites
- Node.js 18+ (verified on Node v24.20.0, npm 11.19.0)

### Install Dependencies
```bash
cd dashboard
npm install
```

### Run Local Development Server with Proxy
```bash
npm run dev
```
Development server will start at `http://localhost:3000` with API proxying to `http://localhost:8000`.

### Production Build
```bash
npm run build
```
Compiles and bundles the application to `dashboard/dist/`. FastAPI automatically serves this distribution directly at root `http://localhost:8000/`.

---

## 3. Communication & State Resilience

1. **Central REST API Service (`src/services/api.js`):** Unified error handling, timeout recovery, and standard endpoint bindings.
2. **Resilient WebSocket Client (`src/services/websocket.js`):** Auto-reconnect with exponential backoff, ping/pong heartbeats, and graceful fallback to REST polling if WebSocket disconnects.
