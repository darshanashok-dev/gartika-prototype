# Gartika System Architecture & Deep Technical Design

## 1. System Philosophy & Objectives
Gartika is an autonomous, privacy-preserving, edge-fused urban road distress and traffic intelligence platform that leverages regular transit buses as continuous civic scanning units.

Rather than streaming continuous raw high-definition video over public cellular infrastructure, Gartika performs:
1. **Edge Computer Vision & Mechanical Shock Detection**: High-frequency IMU and camera frames are aligned in temporal buffers per vehicle.
2. **Multi-Modal Sensor Fusion**: Visual pothole detections are correlated with IMU accelerometer spikes ($|a_z - 9.81\text{ m/s}^2| > 3.2\text{ m/s}^2$) within a $\pm 500\text{ms}$ temporal alignment window.
3. **Spatial Deduplication & Aggregation**: Transient observations are deduplicated within a 15-meter Haversine spatial radius to form persistent `RoadDefect` entities.
4. **Multi-Bus Verification Lifecycle**: Defect confidence is graduated progressively from `UNVERIFIED` / `SUSPECTED` to `VERIFIED` and `HIGH_CONFIDENCE` when corroborated by distinct fleet buses.
5. **Closed-Loop Repair Auditing**: When municipal road maintenance completes a work order, returning fleet buses automatically verify whether the defect has been properly surfaced and smoothed.

```mermaid
graph TD
    subgraph Mobile Edge Unit [Windshield Edge Device]
        CAM[Front Camera 15 FPS] --> PRIV[Privacy Filter - Face & Plate Blur]
        PRIV --> YOLO[YOLOv8 & CV Defect Detector]
        IMU[6-Axis IMU Accel & Gyro 10-50 Hz] --> SHOCK[Shock Extraction & Threshold Filter]
        GPS[GNSS / GPS Receiver 1-10 Hz] --> QUEUE[Offline-First IndexedDB Queue]
        YOLO --> QUEUE
        SHOCK --> QUEUE
        QUEUE --> NET{Cellular / Wi-Fi Active?}
        NET -- Yes --> HTTPS[REST / WebSocket Ingestion]
        NET -- No --> CACHE[Local Persistent Queue]
    end

    subgraph Central Intelligence Cloud [FastAPI Backend]
        HTTPS --> BUF[Per-Bus Isolated Sensor Buffer]
        BUF --> FUSION[SensorFusionEngine]
        FUSION --> DEDUP[Haversine Spatial Deduplication 15m]
        DEDUP --> DB[(SQLite / PostgreSQL Engine)]
        FUSION --> WS_BROADCAST[WebSocket Hub /ws/events]
    end

    subgraph Municipal Operations & GIS [GIS Dashboard & Work Orders]
        WS_BROADCAST --> UI[Real-time GIS Command Dashboard]
        DB --> WO[Work Order Dispatch Engine]
        WO --> CREW[Rapid Response Municipal Crew]
        CREW --> REPAIR[Field Repair Work Completed]
        REPAIR --> REVERIFY[Post-Repair Traversal by Fleet Bus]
        REVERIFY --> FUSION
    end
```

---

## 2. Multi-Modal Sensor Fusion Engine

### Temporal Windowing & Alignment
Camera frame capture rates (10–30 FPS) and IMU sampling frequencies (10–100 Hz) run on separate asynchronous threads. The `SensorBufferManager` maintains individual circular ring buffers per registered `bus_id`.

When a visual candidate is detected at $t_{\text{frame}}$, the engine searches the IMU circular buffer for readings where:
$$|t_{\text{imu}} - t_{\text{frame}}| \le \Delta t_{\text{window}} \quad (\text{default: } 500\text{ ms})$$

### Multi-Modal Scoring Rules
1. **Corroborated Defect (Visual + IMU Shock)**:
   - High visual confidence ($\ge 0.70$) + vertical shock ($|a_z - 9.81| > 3.2\text{ m/s}^2$):
   $$\text{Final Confidence} = \min(0.98, \text{Visual Conf} \times 0.65 + \text{Shock Score} \times 0.35 + 0.10)$$
2. **Visual Only (No IMU Shock)**:
   - Defect detected visually but no vehicle shock felt (vehicle swerved or defect is shallow):
   $$\text{Final Confidence} = \text{Visual Conf} \times 0.85$$
3. **IMU Shock Only (No Aligned Visual Candidate)**:
   - Physical bump detected without confirmed visual crater:
   - Classified strictly as intermediate `ROAD_IMPACT` ($C \approx 0.65 - 0.85$), avoiding false positive overclaims.

---

## 3. Persistent Defect vs. Transient Observation Data Model

To prevent redundant tickets and maintain complete audit history, Gartika enforces strict architectural separation between **Physical Road Defects** and **Individual Bus Observations**:

```mermaid
erDiagram
    BUS ||--o{ OBSERVATION : "records"
    ROAD_DEFECT ||--o{ OBSERVATION : "aggregates"
    ROAD_DEFECT ||--o| WORK_ORDER : "triggers"
    EVENT ||--o| ROAD_DEFECT : "references"

    ROAD_DEFECT {
        string defect_id PK
        string defect_type
        float latitude
        float longitude
        string severity
        string status
        int observation_count
        int unique_bus_count
        string verifying_buses
        string repair_status
        datetime first_seen
        datetime last_seen
    }

    OBSERVATION {
        string observation_id PK
        string defect_id FK
        string bus_id FK
        datetime timestamp
        float latitude
        float longitude
        float shock_magnitude
        float visual_confidence
        string source
        string evidence_path
        boolean is_repair_check
    }

    WORK_ORDER {
        string work_order_id PK
        string defect_id FK
        string title
        string priority
        string status
        string assigned_to
        datetime assigned_at
        datetime started_at
        datetime completed_at
    }
```

---

## 4. Multi-Bus Verification State Machine

```mermaid
stateDiagram-v2
    [*] --> UNVERIFIED: Bus A detects visual candidate / IMU bump
    UNVERIFIED --> SUSPECTED: Bus A corroborates with both visual + IMU shock
    SUSPECTED --> VERIFIED: Bus B passes within 15m and detects same defect
    VERIFIED --> HIGH_CONFIDENCE: >= 3 distinct buses confirm defect
    
    VERIFIED --> ASSIGNED: Municipal Work Order Dispatched
    HIGH_CONFIDENCE --> ASSIGNED: Municipal Work Order Dispatched
    
    ASSIGNED --> IN_PROGRESS: Contractor begins field operations
    IN_PROGRESS --> PENDING_VERIFICATION: Contractor marks physical completion
    
    PENDING_VERIFICATION --> CLOSED: Fleet bus traverses site, confirms flat surface & smooth IMU
    PENDING_VERIFICATION --> REPAIR_FAILED: Fleet bus detects persistent shock/crater
    REPAIR_FAILED --> ASSIGNED: Re-dispatched for corrective surfacing
```

---

## 5. Bandwidth & Scaling Analysis

Continuous video streaming consumes massive data budgets that render fleet-wide deployments cost-prohibitive. By performing edge inference and transmitting only structured metadata and event crops:

$$\text{Raw Video Bitrate} = W \times H \times \text{bpp} \times \text{FPS} \approx 6.91\text{ Mbps per bus}$$
$$\text{Gartika Edge Bitrate} = \text{Telemetry Rate} + \text{Defect Rate} \approx 20.04\text{ Kbps per bus}$$

**Total Fleet Bandwidth Reduction: 99.71% (344.9x efficiency multiplier)**
