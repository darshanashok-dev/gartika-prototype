# Gartika Security, Privacy & Authentication Architecture

Gartika is built with edge-first privacy preservation, role-based access control, and resilient network authentication.

---

## 1. Edge Privacy Filter
Before any imagery is analyzed, cropped for evidence, or transmitted to backend servers, the `PrivacyFilter` removes personally identifiable information (PII):
- **License Plate Anonymization**: Uses contour detection and localized Gaussian blur with configurable kernel (=31$).
- **Facial Redaction**: Automated bounding box localization and blur.
- **Selective Cropping**: Only cropped bounding boxes surrounding confirmed road hazards are transmitted, avoiding wide-angle cabin or street monitoring.

---

## 2. Role-Based Access Control (RBAC)

The system supports four distinct roles:
1. `ADMIN`: Full access to configuration, database management, work orders, bus lifecycle, and user management.
2. `OPERATOR`: Can view GIS dashboard, confirm road defects, create and assign work orders.
3. `MOBILE_UNIT`: Authorized edge units / buses transmitting telemetry, frames, and defect observations.
4. `VIEWER`: Read-only access to GIS maps and defect statistics.

### Authentication Enforcement
- **HTTP Header**: `X-API-Key` or `Authorization: Bearer <token>`.
- **WebSocket Handshake**: Validates token query parameter (`/ws/events?token=...`) when `WS_AUTH_REQUIRED=true`.
- **Development/Demo Mode**: If `DEVICE_AUTH_ENABLED=false`, unauthenticated requests default to safe development access for ease of local demo execution.

---

## 3. Data Integrity & Idempotency
- **Sequence Numbering**: Each mobile unit streams telemetry with strictly increasing sequence numbers.
- **Packet Gap Tracking**: The backend monitors gaps to identify cellular blind spots.
- **Deduplication**: Ingestion prevents duplicate frame and telemetry entries by vehicle ID and timestamp window.
