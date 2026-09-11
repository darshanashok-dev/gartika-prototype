# Gartika REST & WebSocket API Reference

The Gartika platform provides versioned REST APIs (`/api/v1`) along with legacy compatibility endpoints and high-speed bidirectional WebSockets.

## 1. System Health & Observability

### `GET /api/v1/health`
Returns current system health status, database connection state, and server uptime.

**Response `200 OK`**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected",
  "timestamp": "2026-09-10T15:20:00Z"
}
```

### `GET /api/v1/ready`
Kubernetes/container readiness probe confirming database responsiveness and model initialization.

**Response `200 OK`**:
```json
{
  "ready": true,
  "database": "ready",
  "ai_detector": "ready",
  "sensor_fusion_engine": "active"
}
```

### `GET /api/v1/stats`
Fleet-wide aggregated metrics, defect lifecycle counters, verification breakdown, and bandwidth savings.

**Response `200 OK`**:
```json
{
  "active_buses": 3,
  "total_events": 48,
  "defects_detected": 12,
  "verified_defects": 9,
  "closed_loop_repairs_verified": 4,
  "vehicles_counted": 1420,
  "bandwidth_reduction_pct": 99.71
}
```

---

## 2. Road Defect Management

### `GET /api/v1/defects`
List persistent physical road defects with optional filtering.

**Query Parameters:**
- `status` (*string*, optional): Filter by lifecycle status (`UNVERIFIED`, `SUSPECTED`, `VERIFIED`, `HIGH_CONFIDENCE`, `REPAIRED`, `CLOSED`, etc.)
- `severity` (*string*, optional): Filter by severity (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`)
- `defect_type` (*string*, optional): Defect category (`POTHOLE`, `CRACK`, `ROAD_IMPACT`, `WATERLOGGING`)
- `limit` (*integer*, default: 100): Maximum records returned

**Response `200 OK`**:
```json
[
  {
    "defect_id": "DEF-ROAD-690A47",
    "defect_type": "POTHOLE",
    "latitude": 12.9738,
    "longitude": 77.6189,
    "severity": "HIGH",
    "status": "VERIFIED",
    "observation_count": 2,
    "unique_bus_count": 2,
    "verifying_buses": ["BUS-101", "BUS-208"],
    "repair_status": "NONE",
    "first_seen": "2026-09-10T14:45:00Z",
    "last_seen": "2026-09-10T15:00:00Z"
  }
]
```

### `GET /api/v1/defects/{defect_id}/observations`
Retrieve the complete temporal observation history for a specific persistent defect across all buses.

---

## 3. Telemetry & Sensor Ingestion

### `POST /api/v1/telemetry`
Ingest high-frequency IMU and GPS telemetry from mobile sensing units.

**Request Body**:
```json
{
  "bus_id": "BUS-101",
  "latitude": 12.97380,
  "longitude": 77.61890,
  "speed": 32.4,
  "heading": 85.0,
  "accel_x": 0.12,
  "accel_y": -0.05,
  "accel_z": 15.2,
  "gyro_x": 0.01,
  "gyro_y": 0.02,
  "gyro_z": -0.01,
  "sequence_number": 1042,
  "timestamp": "2026-09-10T15:00:00.120Z"
}
```

---

## 4. Work Order Management

### `POST /api/v1/work-orders`
Dispatch an urban road maintenance work order from a verified defect.

**Request Body**:
```json
{
  "defect_id": "DEF-ROAD-690A47",
  "title": "Repair Verified Pothole #690A47",
  "description": "Multi-bus verified crater detected at Trinity Circle.",
  "priority": "CRITICAL",
  "assigned_to": "BBMP East Zone Rapid Repair Wing Alpha-3",
  "latitude": 12.9738,
  "longitude": 77.6189
}
```

### `PATCH /api/v1/work-orders/{id}`
Update work order lifecycle state (`ASSIGNED`, `IN_PROGRESS`, `COMPLETED`, `RESOLVED`, `CLOSED`).

---

## 5. WebSockets Real-Time Stream

### `WS /ws/events`
High-speed bidirectional WebSocket broadcasting real-time defect alerts, multi-bus verifications, live vehicle positions, and work order transitions to connected GIS dashboard clients.
