# Gartika System Reliability & Fault-Tolerance Audit

This audit documents every single point of potential failure across Gartika's architecture and describes the isolation and recovery mechanisms implemented to guarantee zero demo crashes.

---

## 1. Subsystem Reliability Matrix

| Subsystem / Entry Point | Potential Failure Mode | Impact if Unhandled | Gartika Resilient Mitigation |
|---|---|---|---|
| **Camera & Video Streams** | Device disconnect, permission denied, corrupt JPEG byte stream | Application crash on `cv2.imdecode` | Fallback to IMU/GPS sensing; UI shows `Camera: Unavailable`; returns HTTP 400 for corrupted uploads without raising 500. |
| **GPS / GNSS Telemetry** | Underpasses, urban canyons, receiver loss | Fabricating fake Bengaluru coordinates (`12.9716, 77.5946`) | Preserves `latitude: null, longitude: null`, sets `location_status: "UNKNOWN_LOCATION"`, retains observation honestly. |
| **IMU / Accelerometer** | Missing axes ($a_x, a_y, a_z$), extreme vibration noise, sensor disconnect | Math domain error / division by zero | Dynamic gravity calibration ($ar{g}$), noise floor filter (`IMU_NOISE_FLOOR=0.25`), falls back to visual-only detection. |
| **AI Neural Network (YOLO)** | Missing weights (`.pt`), out-of-memory, PyTorch inference failure | Startup failure, pipeline crash | Automatic fallback to OpenCV adaptive morphological contour heuristic; if both fail, returns safe empty `[]`. |
| **Database Transactions** | SQLite lock contention, schema migration conflict | Unhandled 500 Internal Server Error | Explicit rollback on exception (`db.rollback()`), scoped sessions via `get_db()`, sanitized user-facing error envelopes. |
| **WebSocket Stream Gateway** | Client abrupt disconnect, socket timeout, malformed JSON | Server thread crash | Ping/pong heartbeat monitoring, exponential backoff reconnect on client (`min(10s, 1.5s * 1.5^n)`), REST polling fallback. |
| **File Storage / Evidence** | Missing directories, disk full, write permission denial | Evidence upload failure | Auto-creates `data/evidence`, `data/videos`, `data/demo` on startup; returns safe relative path or `None`. |
| **Frontend API Calls** | Network drop, backend restart, HTTP 503 | White screen / undefined Javascript errors | Centralized `apiRequest` handler with loading skeletons, error states, retry triggers, and offline IndexedDB queue. |

---

## 2. Error Envelope Standard

All API routes implement structured, sanitized error envelopes that never leak database stack traces or internal filesystem paths:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Defect DEF-2026-A101 not found.",
    "timestamp": "2026-09-11T07:15:00Z"
  }
}
```

Detailed Python tracebacks remain securely confined to application logs.
