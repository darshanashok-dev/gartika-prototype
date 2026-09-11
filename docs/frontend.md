# Gartika Frontend Architecture & UI Guidelines

## 1. Design System & Hierarchy
The Gartika frontend is an enterprise-grade urban intelligence control center styled in modern dark minimalist slate (`#030712`, `#0f172a`, `#1e293b`).

### Navigation Views
1. **Overview**: Executive control center with top KPIs, 4-layer sensor intelligence status, real-time incident feed, and mini-GIS viewport.
2. **Live GIS Map**: Full-screen interactive Leaflet map with layer toggles (Buses, Defects, Work Orders), fleet centering, and click-to-view detail drawers.
3. **Road Defects**: Searchable, filterable table with severity badges, multi-score breakdowns, and CSV/JSON export.
4. **Fleet Sensing**: Grid of active buses with sensor health pills (CAM, IMU, GPS), speed gauges, and ping times.
5. **Work Orders**: Municipal repair dispatch pipeline with closed-loop multi-pass audit tracking.
6. **Analytics & Audit**: Benchmarks on edge bandwidth reduction (99.71% savings) and sensor fusion precision (93.88%).
7. **Settings**: API endpoint configuration, authentication keys, and smartphone pairing QR code.

---

## 2. Real-Time State Management
A single centralized WebSocket service (`/ws/events`) receives live events and updates global application state, map markers, KPI counters, and notification drawers consistently without redundant polling.
