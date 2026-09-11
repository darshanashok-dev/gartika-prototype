# Gartika Frontend / Backend API Contract Specification

| Frontend Operation | HTTP Method | Endpoint | Request Body | Response Shape |
| :--- | :--- | :--- | :--- | :--- |
| **Health Check** | `GET` | `/health` | None | `{"status": "ok", "subsystems": {...}}` |
| **System Stats** | `GET` | `/api/v1/stats` | None | `{"active_buses": 10, "potholes_count": 45, ...}` |
| **Get Fleet** | `GET` | `/api/v1/buses` | None | `[{"bus_id": "BUS-101", "latitude": 12.97, ...}]` |
| **Get Events** | `GET` | `/api/v1/events?limit=50` | None | `[{"event_id": "EV-01", "event_type": "POTHOLE", ...}]` |
| **Get Defects** | `GET` | `/api/v1/defects` | None | `[{"defect_id": "DEF-01", "status": "VERIFIED", ...}]` |
| **Get Work Orders** | `GET` | `/api/v1/work-orders` | None | `[{"id": 1, "status": "IN_PROGRESS", ...}]` |
| **Create Work Order** | `POST` | `/api/v1/work-orders` | `{"defect_id": 1, "priority": "HIGH", ...}` | `{"id": 2, "status": "OPEN", ...}` |
| **Update Work Order** | `PATCH` | `/api/v1/work-orders/{id}`| `{"status": "REPAIR_PENDING"}` | `{"id": 1, "status": "REPAIR_PENDING"}` |
| **Export Defects CSV** | `GET` | `/api/v1/events/export/csv`| None | CSV File Stream |
| **Live WebSockets** | `WSS/WS` | `/ws/events` | None / Ping | Real-time JSON events |
