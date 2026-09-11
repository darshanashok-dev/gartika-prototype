# Gartika Data Model Specification

## 1. Database Schema & Entities

### 1.1 `RoadDefect` Table
Represents persistent, spatially deduplicated road distress incidents.

| Field | Type | Description |
|---|---|---|
| `id` | Integer (PK) | Auto-increment primary key |
| `defect_id` | String (Unique) | Human-readable defect ID (e.g. `DEF-2026-A1B2`) |
| `defect_type` | String | `POTHOLE`, `CRACK`, `RUTTING`, `ROAD_IMPACT` |
| `latitude` | Float (Nullable) | Latitude coordinate (null if GNSS lost) |
| `longitude` | Float (Nullable) | Longitude coordinate (null if GNSS lost) |
| `location_status` | String | `GEOCODED` or `UNKNOWN_LOCATION` |
| `severity` | String | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `status` | String | `SUSPECTED`, `DETECTED`, `SENSOR_FUSED`, `MULTI_BUS_VERIFIED`, `OPERATOR_CONFIRMED`, `REPAIR_PENDING`, `REPAIRED`, `CLOSED`, `REPAIR_FAILED` |
| `first_seen` | DateTime (UTC) | Timestamp of first observation |
| `last_seen` | DateTime (UTC) | Timestamp of most recent observation |
| `observation_count` | Integer | Cumulative total observation count |
| `unique_bus_count` | Integer | Number of distinct transit buses corroborating defect |
| `verifying_buses` | String (JSON) | JSON array of bus IDs that observed the defect |
| `best_confidence` | Float | Highest recorded composite confidence |
| `latest_evidence_path` | String | Relative URL to cropped evidence photograph |
| `repair_status` | String | `NONE`, `PENDING_VERIFICATION`, `REPAIR_VERIFIED`, `REPAIR_FAILED` |
| `repair_verified_at` | DateTime | Timestamp when smooth multi-bus traversal closed repair |
| `repair_verified_by_bus_id` | String | Bus ID that completed final verification pass |
| `work_order_id` | String | Linked municipal work order identifier |

### 1.2 `Observation` Table
Raw transient observation records tied to specific passing vehicles.

### 1.3 `Event` Table
Real-time temporal events recorded during telemetry processing.

### 1.4 `Bus` Table
Transit vehicle registry tracking active status, firmware version, and battery/hardware metrics.

### 1.5 `WorkOrder` Table
Municipal maintenance dispatch lifecycle records (`DRAFT`, `ASSIGNED`, `IN_PROGRESS`, `RESOLVED`, `AUDITED`).
