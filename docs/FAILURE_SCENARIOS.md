# Gartika Failure-Injection & Resilience Test Matrix

| # | Injected Failure Scenario | Expected System Behavior | Verified Recovery Mechanism |
|---|---|---|---|
| **1** | **No Camera Hardware** (Camera disconnected / permission denied) | Backend continues operating; IMU and GPS telemetry stream normally; UI indicates `Camera: Inactive`. | `PotholeDetector` returns `[]`; `SensorFusionEngine` processes IMU shock events without camera frames. |
| **2** | **Lost GPS Lock** (Bus enters underground tunnel) | Telemetry continues; coordinates stored as `null`; status marked `UNKNOWN_LOCATION`. | Spatial deduplication is deferred; no fake Bengaluru coordinates are generated. |
| **3** | **No IMU Accelerometer** (Sensor unavailable on client) | Visual detection operates independently; confidence marked as `visual_only`. | Engine skips temporal IMU alignment and records `imu_score: null`. |
| **4** | **Missing YOLO Weights** (`.pt` file not found) | Server starts cleanly without crashing; switches to OpenCV contour analysis. | `PotholeDetector` catches model missing exception and runs OpenCV morphological pipeline. |
| **5** | **Database Lock / Collision** (Concurrent writes) | Database rolls back transaction cleanly; returns HTTP 409 or 503 with safe JSON. | Scoped session rollback in `except` blocks prevents session contamination. |
| **6** | **WebSocket Disconnection** (Network drop) | Dashboard UI shows `RECONNECTING...`; falls back to REST polling. | Exponential backoff automatically reconnects when network recovers. |
| **7** | **Corrupted Image Upload** (0-byte file or random binary) | Upload endpoint catches `cv2.imdecode` failure; returns HTTP 400. | Server does not crash; error logged to backend logger. |
| **8** | **Frontend Starts Before Backend** | Frontend shows clean error state: `Unable to load fleet data. [Retry]`. | Client automatically retries polling once backend starts up. |
| **9** | **Duplicate Telemetry Packets** | System detects sequence number gap or duplicate; discards redundant packet. | `SensorBufferManager` checks sequence monotonic counter. |
| **10** | **Post-Repair Persistent Bump** (Contractor did poor patch) | Re-inspection detects persistent shock ($a_z > 14	ext{ m/s}^2$); status transitions to `REPAIR_FAILED`. | System re-opens work order and alerts municipal supervisor. |
