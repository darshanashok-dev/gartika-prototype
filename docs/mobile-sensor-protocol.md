# Gartika Mobile Edge Sensor Protocol Specification

## 1. Overview

This document specifies the communication wire formats, timestamping protocols, idempotency requirements, sequence handling, and sensor state schemas for mobile edge sensing units mounted on transit buses.

---

## 2. Telemetry Packet Protocol (`POST /api/v1/telemetry`)

### Schema Specification
```json
{
  "bus_id": "BUS-101",
  "device_id": "EDG-NODE-7842",
  "sequence_number": 1042,
  "timestamp": "2026-09-11T07:30:15.120Z",
  "latitude": 12.971598,
  "longitude": 77.594562,
  "accuracy": 4.8,
  "speed": 34.2,
  "heading": 88.5,
  "ax": 0.12,
  "ay": -0.05,
  "az": 9.84,
  "gx": 0.01,
  "gy": 0.00,
  "gz": 0.02,
  "network": {
    "carrier": "cellular",
    "rtt_ms": 42
  }
}
```

### Protocol Invariants
1. **Monotonic Sequences:** `sequence_number` starts from persistent counter (saved across browser refreshes). If the backend receives an out-of-order sequence (e.g. sequence 100 after 101), the latest-state cache is not overwritten with stale data, though the time-series record is preserved.
2. **Idempotency:** The composite tuple `(bus_id, sequence_number)` is uniquely indexed. Re-transmissions from the offline queue are safely deduplicated.
3. **No Fake Coordinates:** When GPS lock is lost or unavailable, `latitude` and `longitude` are transmitted as `null`. The backend marks the observation as `UNKNOWN_LOCATION` rather than fabricating coordinates.
4. **Calibrated Gravity:** `az` represents raw vertical acceleration. Baseline gravity ($g \approx 9.81\text{ m/s}^2$) is dynamically tracked per device mounting angle.

---

## 3. Optical Frame Capture Protocol (`POST /api/v1/stream/frame`)

### Multipart Payload Form Fields
- `bus_id`: String identifier of the bus unit (e.g. `BUS-101`).
- `device_id`: Optional hardware device UUID.
- `file` / `frame`: Binary JPEG image (`image/jpeg`, quality: 0.80, resolution: $640 \times 480$ or $1280 \times 720$).
- `latitude`: Optional floating point GPS latitude at frame shutter time.
- `longitude`: Optional floating point GPS longitude at frame shutter time.
- `accuracy`: Horizontal GPS accuracy radius in meters.
- `sequence_number`: Monotonic frame sequence integer.
- `timestamp`: UTC ISO timestamp at shutter trigger.

### Response Schema
```json
{
  "status": "ok",
  "bus_id": "BUS-101",
  "size": 48210,
  "defects_detected": 1,
  "vehicles_detected": 4,
  "tracked_vehicles": 4,
  "events_created": ["EVT-POTH-9F8A2"]
}
```

---

## 4. WebSocket Event Dispatch Protocol (`/ws/events`)

### Message Types Broadcast to Dashboard & Mobile Clients

#### 1. `NEW_EVENT` (Road Defect or Impact Alert)
```json
{
  "type": "NEW_EVENT",
  "data": {
    "id": 142,
    "event_id": "EVT-POTH-9F8A2",
    "defect_id": "DEF-POTH-3A1BC",
    "bus_id": "BUS-101",
    "event_type": "POTHOLE",
    "confidence": 0.94,
    "latitude": 12.971598,
    "longitude": 77.594562,
    "severity": "HIGH",
    "evidence_image_url": "/evidence/EVT_POTHOLE_1789123456_9F8A.jpg",
    "status": "VERIFIED",
    "observation_count": 3,
    "unique_bus_count": 2,
    "vibration_level": "HIGH",
    "model_confidence": 0.89,
    "imu_score": 0.92,
    "fusion_score": 0.94,
    "timestamp": "2026-09-11T07:30:15.120Z"
  }
}
```

#### 2. `TELEMETRY_UPDATE` (Live Bus Positioning)
```json
{
  "type": "TELEMETRY_UPDATE",
  "data": {
    "bus_id": "BUS-101",
    "latitude": 12.971598,
    "longitude": 77.594562,
    "speed": 34.2,
    "accuracy": 4.8,
    "heading": 88.5,
    "ax": 0.12,
    "ay": -0.05,
    "az": 9.84,
    "sequence_number": 1042,
    "timestamp": "2026-09-11T07:30:15.120Z"
  }
}
```
