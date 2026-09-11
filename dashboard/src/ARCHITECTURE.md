# Gartika Dashboard — Frontend Architecture & Dataflow

## 1. High-Level Topology

```
┌────────────────────────────────────────────────────────┐
│               GARTIKA FASTAPI BACKEND                  │
│                                                        │
│   REST Endpoints (/api/v1/...)   WebSocket (/ws/events)│
└─────────────┬───────────────────────────┬──────────────┘
              │                           │
              │ HTTP JSON                 │ Bi-directional WSS
              ▼                           ▼
┌───────────────────────────┐ ┌──────────────────────────┐
│   src/services/api.js     │ │ src/services/websocket.js│
│   (Central API Client)    │ │ (Auto-Reconnect Client)  │
└─────────────┬─────────────┘ └───────────┬──────────────┘
              │                           │
              └─────────────┬─────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │       src/App.jsx         │
              │   (Global App State)      │
              └─────────────┬─────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  TopNav.jsx  │    │ Sidebar.jsx  │    │ DefectDrawer │
└──────────────┘    └──────────────┘    └──────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│                 PAGES (7 ACTIVE VIEWS)               │
│  - OverviewPage    - LiveMapPage    - DefectsPage    │
│  - FleetPage       - WorkOrdersPage - AnalyticsPage  │
│  - SettingsPage                                      │
└──────────────────────────────────────────────────────┘
```

---

## 2. Component Design Principles

- **Utilitarian & Information-Dense:** Built to resemble municipal GIS and fleet operations workstations without decorative marketing fluff.
- **Fail-Safe Degradation:** If WebSocket disconnects, the UI automatically transitions to background REST polling without crashing or locking the screen.
- **Honest GPS Representation:** Observations without satellite lock are clearly marked as `UNLOCATED` rather than plotted at fabricated map coordinates.
- **Single Source of Truth:** Centralized API client handles all data mutations, guaranteeing synchronization across tables and map markers.
