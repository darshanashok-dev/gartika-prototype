# Gartika — System Architecture & Dataflow Specification

## 1. System Topology & Dataflow

Gartika transforms public transit buses into intelligent mobile sensing units that continuously monitor road surface health, traffic density, and municipal infrastructure.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MOBILE / BUS EDGE UNIT                          │
│                                                                        │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────────────┐  │
│  │   Camera Feed     │  │   3-Axis IMU      │  │    GPS Receiver    │  │
│  │  (1280x720 @15fps)│  │   (50Hz Telemetry)│  │ (1-5Hz Lat/Lon/Spd)│  │
│  └─────────┬─────────┘  └─────────┬─────────┘  └──────────┬─────────┘  │
│            │                      │                       │            │
│            ▼                      ▼                       ▼            │
│  ┌───────────────────┐  ┌───────────────────────────────────────────┐  │
│  │ Edge AI Inference │  │     Local Ring Buffer & Anonymizer        │  │
│  │ (YOLO / Heuristic)│  │ (Privacy Blur: Plates/Faces, JSON Telemetry) │
│  └─────────┬─────────┘  └─────────────────────┬─────────────────────┘  │
└────────────┼──────────────────────────────────┼────────────────────────┘
             │                                  │
             │ HTTPS Multipart Frames           │ WSS / HTTPS Telemetry Ingest
             ▼                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       GARTIKA BACKEND (FASTAPI)                        │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                  Spatio-Temporal Fusion Engine                   │  │
│  │  - Multi-Bus Ring Buffer Manager (Buffer isolation per bus_id)   │  │
│  │  - Temporal Window Alignment (±1.5s Optical + IMU Correlation)   │  │
│  │  - Spatial Deduplication (Haversine 25m Clustering)              │  │
│  │  - Multi-Bus Bayesian Verification (Elevation to VERIFIED)       │  │
│  │  - Closed-Loop Repair Verification (Re-transit Confirmation)     │  │
│  └────────────────────────────────┬─────────────────────────────────┘  │
│                                   │                                    │
│                 ┌─────────────────┴─────────────────┐                  │
│                 ▼                                   ▼                  │
│  ┌───────────────────────────────┐ ┌────────────────────────────────┐  │
│  │     SQLAlchemy ORM Database   │ │    WebSocket Broadcast Manager │  │
│  │  (Defects, Telemetry, Orders) │ │ (Real-Time HUD & GIS Updates)  │  │
│  └──────────────┬────────────────┘ └────────────────┬───────────────┘  │
└─────────────────┼───────────────────────────────────┼──────────────────┘
                  │                                   │
                  ▼                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      MUNICIPAL OPERATIONS FRONTEND                     │
│                                                                        │
│  ┌───────────────────────────────────┐  ┌───────────────────────────┐  │
│  │       GIS Command Dashboard       │  │    Mobile Sensing Client  │  │
│  │ (Leaflet Map, Work Orders, Filter)│  │  (Driver HUD, Sync Queue) │  │
│  └───────────────────────────────────┘  └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Specifications

### 2.1 Edge & Ingestion Layer
- **Input Channels:** Video frames via `/api/v1/stream/frame` and sensor streams via `/api/v1/telemetry`.
- **Honest GPS Strategy:** Observations captured during tunnel transit or GPS lock loss are stored with `latitude=null, longitude=null` with `status: "UNKNOWN_LOCATION"`. No synthetic coordinates are ever injected.

### 2.2 Processing & Fusion Engine
- **Per-Bus Isolation:** Buffer management isolates telemetry per `bus_id` preventing cross-bus telemetry bleeding.
- **Fusion Logic:** Computes composite defect severity combining visual bounding box scale/confidence and IMU z-axis shock acceleration ($|a_z - 9.81| > 4.0\text{ m/s}^2$).
- **Multi-Bus Verification:** A single bus sighting creates a `CANDIDATE` defect. Confirmation by a second distinct bus elevates status to `VERIFIED` with `confidence > 0.85`.

### 2.3 Municipal Work Order & Repair Verification Lifecycle
1. Defect verified $\to$ `WorkOrder` created (`OPEN`).
2. Municipal team scheduled $\to$ `WorkOrder` marked `IN_PROGRESS`.
3. Road repaired $\to$ `WorkOrder` set to `COMPLETED`; `RoadDefect` set to `REPAIRED` / `PENDING_VERIFICATION`.
4. Subsequent bus transit over coordinate:
   - **No Shock ($|a_z| < 12.0\text{ m/s}^2$):** Defect marked `REPAIR_VERIFIED` and closed.
   - **Shock Re-detected:** Defect marked `REPAIR_FAILED` and escalated.
