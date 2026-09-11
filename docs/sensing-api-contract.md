# Gartika Sensing API Contract & Error Handling Specification

## 1. REST Endpoints Overview

| Method | Endpoint | Description | Auth Scope |
|---|---|---|---|
| `POST` | `/api/v1/telemetry` | Ingest vehicle GPS & IMU breadcrumb | Public / Device Token |
| `GET` | `/api/v1/telemetry/latest` | Get most recent telemetry for bus | Public |
| `GET` | `/api/v1/telemetry/buses/{id}/telemetry` | Get historical breadcrumb trail | Public |
| `POST` | `/api/v1/stream/frame` | Upload live JPEG dashcam frame | Public / Device Token |
| `GET` | `/api/v1/stream/latest-frame` | Get raw latest JPEG preview frame | Public |
| `GET` | `/api/v1/health` | Backend subsystem health & diagnostics | Public |
| `GET` | `/api/v1/stats` | Global aggregate operational counts | Public |
| `GET` | `/api/v1/defects` | Get all persistent road defects | Public |
| `GET` | `/api/v1/buses` | Get all registered fleet buses | Public |
| `GET` | `/api/v1/work-orders` | Get municipal work orders | Public |
| `WS` | `/ws/events` | Real-time bi-directional event stream | Public |

---

## 2. Standardized Error Response Structure

All 4xx and 5xx API responses conform to the standard schema:

```json
{
  "error": {
    "code": "INVALID_COORDINATES",
    "message": "Latitude must be between -90.0 and +90.0 degrees.",
    "details": {
      "field": "latitude",
      "value": 142.5
    }
  }
}
```

### Common Error Codes
- `INVALID_COORDINATES`: Latitude or longitude out of geographic bounds.
- `INVALID_IMAGE`: Corrupted, unreadable, or empty JPEG byte stream.
- `DEVICE_UNREGISTERED`: Transmitting device ID unrecognized.
- `RATE_LIMITED`: Packet ingestion exceeds 10 Hz frequency limit.
- `DUPLICATE_SEQUENCE`: Packet sequence number already processed.
- `STREAM_ERROR`: Computer vision inference engine encountered internal fault.

---

## 3. Sensor Fusion Verification Status Hierarchy

```text
[ DETECTED ]
    │ (Single heuristic / CV candidate without corroboration)
    ▼
[ SUSPECTED ]
    │ (AI YOLO model confidence > 0.65)
    ▼
[ SENSOR-CORRELATED ]
    │ (Visual defect corroborated by aligned vertical IMU shock)
    ▼
[ VERIFIED ]
    │ (Corroborated by 2+ distinct transit buses on same road section)
    ▼
[ HIGH_CONFIDENCE ]
    │ (3+ distinct buses or municipal physical confirmation)
    ▼
[ REPAIR PENDING ] -> [ REPAIR VERIFIED ] (Closed-Loop Validation)
```
