// Gartika Urban Intelligence Command Center Dashboard
class GartikaDashboard {
  constructor() {
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/events`;
    
    // State
    this.busLocation = [12.971598, 77.594562];
    this.events = [];
    this.workOrders = [];
    this.selectedEvent = null;
    this.map = null;
    this.busMarker = null;
    this.busAccuracyCircle = null;
    this.eventMarkers = {};
    this.ws = null;
    this.sourceMode = "DEMO";
    this.localIp = "localhost";

    this.initElements();
    this.initMap();
    this.initWebSocket();
    this.bindEvents();
    this.loadInitialData();

    // Regular polling fallback every 3 seconds
    setInterval(() => this.pollUpdates(), 3000);
  }

  initElements() {
    // Stat counters
    this.statActiveBuses = document.getElementById("statActiveBuses");
    this.statTotalEvents = document.getElementById("statTotalEvents");
    this.statRoadDefects = document.getElementById("statRoadDefects");
    this.statVehicles = document.getElementById("statVehicles");
    this.statHighPriority = document.getElementById("statHighPriority");
    this.woCount = document.getElementById("woCount");

    // Bus card
    this.cardBusId = document.getElementById("cardBusId");
    this.cardBusName = document.getElementById("cardBusName");
    this.busLat = document.getElementById("busLat");
    this.busLon = document.getElementById("busLon");
    this.busSpeed = document.getElementById("busSpeed");
    this.busLastSeen = document.getElementById("busLastSeen");

    // Containers
    this.eventFeedStream = document.getElementById("eventFeedStream");
    this.woListContainer = document.getElementById("woListContainer");

    // Modals
    this.eventModal = document.getElementById("eventModal");
    this.modalSeverityBadge = document.getElementById("modalSeverityBadge");
    this.modalEventTitle = document.getElementById("modalEventTitle");
    this.modalEventId = document.getElementById("modalEventId");
    this.modalEvidenceImg = document.getElementById("modalEvidenceImg");
    this.modalImgFallback = document.getElementById("modalImgFallback");
    this.modalEventType = document.getElementById("modalEventType");
    this.modalConfidence = document.getElementById("modalConfidence");
    this.modalBusId = document.getElementById("modalBusId");
    this.modalLocation = document.getElementById("modalLocation");
    this.modalTimestamp = document.getElementById("modalTimestamp");
    this.modalVibration = document.getElementById("modalVibration");
    this.btnCreateWorkOrder = document.getElementById("btnCreateWorkOrder");

    // Phone modal
    this.phoneModal = document.getElementById("phoneModal");
    this.mobileConnectUrl = document.getElementById("mobileConnectUrl");
    this.sourceLabel = document.getElementById("sourceLabel");
  }

  initMap() {
    try {
      this.map = L.map("gisMap", {
        center: this.busLocation,
        zoom: 15,
        zoomControl: true,
      });

      // Add high contrast Dark Matter CartoDB tiles with robust offline fallback
      const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OSM',
        maxZoom: 19,
        subdomains: "abcd",
      });
      tiles.addTo(this.map);

      // Create custom Bus pulse marker icon
      const busHtml = `
        <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; width:34px; height:34px; border-radius:50%; background:rgba(0,242,254,0.3); animation:pulse 2s infinite;"></div>
          <div style="width:20px; height:20px; border-radius:50%; background:#00f2fe; border:3px solid #fff; box-shadow:0 0 10px #00f2fe; display:flex; align-items:center; justify-content:center; font-size:10px;">🚌</div>
        </div>
      `;
      const busIcon = L.divIcon({
        className: "custom-bus-marker",
        html: busHtml,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      this.busMarker = L.marker(this.busLocation, { icon: busIcon }).addTo(this.map);
      this.busMarker.bindPopup("<strong>BUS-101</strong><br>BMTC Mobile Sensing Unit (Active)");

      this.busAccuracyCircle = L.circle(this.busLocation, {
        radius: 35,
        color: "#00f2fe",
        fillColor: "#00f2fe",
        fillOpacity: 0.1,
        weight: 1,
      }).addTo(this.map);
    } catch (e) {
      console.warn("Map initialization notice:", e);
    }
  }

  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        document.getElementById("statusBackend").classList.add("online");
        console.log("[WS] Connected to Gartika live event stream.");
      };

      this.ws.onmessage = (msg) => {
        try {
          const payload = JSON.parse(msg.data);
          this.handleLiveMessage(payload);
        } catch (e) {
          console.error("[WS] Error parsing message:", e);
        }
      };

      this.ws.onclose = () => {
        console.log("[WS] Disconnected. Reconnecting in 3s...");
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.warn("[WS] Failed to connect:", e);
    }
  }

  handleLiveMessage(msg) {
    if (msg.type === "NEW_EVENT") {
      this.addEventToFeed(msg.data, true);
      this.addEventMarker(msg.data);
      this.loadStats();
    } else if (msg.type === "TELEMETRY" || msg.type === "BUS_UPDATE") {
      this.updateBusPosition(msg.data);
    } else if (msg.type === "NEW_WORK_ORDER") {
      this.addWorkOrderToUI(msg.data, true);
      this.loadStats();
    } else if (msg.type === "UPDATE_WORK_ORDER") {
      this.updateWorkOrderInUI(msg.data);
    }
  }

  updateBusPosition(data) {
    if (!data.latitude || !data.longitude) return;

    this.busLocation = [data.latitude, data.longitude];
    this.busLat.innerText = data.latitude.toFixed(6);
    this.busLon.innerText = data.longitude.toFixed(6);

    if (data.speed !== undefined) {
      this.busSpeed.innerText = `${parseFloat(data.speed).toFixed(1)} km/h`;
    }
    this.busLastSeen.innerText = "Just now";

    if (this.busMarker && this.map) {
      this.busMarker.setLatLng(this.busLocation);
      if (this.busAccuracyCircle) {
        this.busAccuracyCircle.setLatLng(this.busLocation);
      }
    }
  }

  addEventMarker(evt) {
    if (!this.map || !evt.latitude || !evt.longitude) return;
    if (this.eventMarkers[evt.event_id]) return;

    const isPothole = evt.event_type === "POTHOLE" || evt.event_type === "ROAD_DEFECT";
    const color = isPothole ? "#ef4444" : "#f59e0b";
    const symbol = isPothole ? "🕳️" : "🚗";

    const markerHtml = `
      <div style="width:24px; height:24px; border-radius:50%; background:${color}; border:2px solid #fff; box-shadow:0 0 10px ${color}; display:flex; align-items:center; justify-content:center; font-size:12px; cursor:pointer;">
        ${symbol}
      </div>
    `;
    const icon = L.divIcon({
      className: "custom-event-marker",
      html: markerHtml,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });

    const marker = L.marker([evt.latitude, evt.longitude], { icon }).addTo(this.map);
    marker.bindTooltip(`<strong>${evt.event_type}</strong> (${(evt.confidence * 100).toFixed(0)}%)<br>${evt.location_name || ""}`);
    marker.on("click", () => this.openEventInspection(evt));

    this.eventMarkers[evt.event_id] = marker;
  }

  addEventToFeed(evt, isNew = false) {
    if (document.getElementById(`evt-card-${evt.event_id}`)) return;

    const isPothole = evt.event_type === "POTHOLE" || evt.event_type === "ROAD_DEFECT";
    const card = document.createElement("div");
    card.id = `evt-card-${evt.event_id}`;
    card.className = `event-item-card ${evt.event_type}`;

    const icon = isPothole ? "🕳️" : "🚗";
    const confPct = (evt.confidence * 100).toFixed(0);
    const tsStr = new Date(evt.timestamp).toLocaleTimeString();

    card.innerHTML = `
      <div class="evt-card-top">
        <span class="evt-type">${icon} ${evt.event_type}</span>
        <span class="evt-sev-tag ${evt.severity || 'MEDIUM'}">${evt.severity || 'MEDIUM'}</span>
      </div>
      <div class="evt-card-mid">
        <span>Confidence: <strong class="evt-conf">${confPct}%</strong></span>
        <span>${tsStr}</span>
      </div>
      <div class="evt-loc">📍 ${evt.location_name || `${evt.latitude.toFixed(4)}, ${evt.longitude.toFixed(4)}`}</div>
      <div class="evt-action-hint">🔍 Click to inspect evidence & dispatch work order ➔</div>
    `;

    card.addEventListener("click", () => this.openEventInspection(evt));

    const empty = this.eventFeedStream.querySelector(".empty-state");
    if (empty) empty.remove();

    if (isNew) {
      this.eventFeedStream.prepend(card);
    } else {
      this.eventFeedStream.appendChild(card);
    }
  }

  openEventInspection(evt) {
    this.selectedEvent = evt;
    this.modalSeverityBadge.className = `modal-badge ${evt.severity === 'HIGH' || evt.severity === 'CRITICAL' ? 'danger' : 'warning'}`;
    this.modalSeverityBadge.innerText = `${evt.severity || 'HIGH'} SEVERITY`;
    this.modalEventTitle.innerText = evt.event_type === 'POTHOLE' ? 'ROAD DEFECT / POTHOLE DETECTED' : 'URBAN TRAFFIC DENSITY DETECTED';
    this.modalEventId.innerText = evt.event_id;
    this.modalEventType.innerText = evt.event_type;
    this.modalConfidence.innerText = `${(evt.confidence * 100).toFixed(1)}%`;
    this.modalBusId.innerText = evt.bus_id || 'BUS-101';
    this.modalLocation.innerText = `${evt.latitude.toFixed(6)}, ${evt.longitude.toFixed(6)}`;
    this.modalTimestamp.innerText = new Date(evt.timestamp).toLocaleString();
    this.modalVibration.innerText = evt.vibration_level === 'HIGH' ? 'HIGH Z-SHOCK VIBRATION DETECTED' : 'NORMAL ROAD SENSOR DYNAMICS';

    if (evt.evidence_path) {
      this.modalEvidenceImg.src = `${this.backendUrl}${evt.evidence_path}`;
      this.modalEvidenceImg.style.display = 'block';
      this.modalImgFallback.style.display = 'none';
    } else {
      this.modalEvidenceImg.style.display = 'none';
      this.modalImgFallback.style.display = 'block';
    }

    this.eventModal.classList.add("show");
  }

  closeEventInspection() {
    this.eventModal.classList.remove("show");
    this.selectedEvent = null;
  }

  async createWorkOrderFromSelected() {
    if (!this.selectedEvent) return;

    const payload = {
      event_id: this.selectedEvent.event_id,
      title: `Repair ${this.selectedEvent.event_type} on Route 335E`,
      description: `Automated maintenance dispatch generated by Gartika AI Edge Sensor. Confidence: ${(this.selectedEvent.confidence * 100).toFixed(0)}%, Severity: ${this.selectedEvent.severity}`,
      priority: this.selectedEvent.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
      status: "ASSIGNED",
      assigned_to: "BBMP Ward 112 Maintenance Wing",
      location_name: this.selectedEvent.location_name || "MG Road Corridor",
      latitude: this.selectedEvent.latitude,
      longitude: this.selectedEvent.longitude,
      source_bus_id: this.selectedEvent.bus_id || "BUS-101"
    };

    try {
      const res = await fetch(`${this.backendUrl}/work-orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const wo = await res.json();
        alert(`✓ WORK ORDER CREATED SUCCESSFULLY!\n\nWork Order ID: ${wo.work_order_id}\nPriority: ${wo.priority}\nAssigned: ${wo.assigned_to}\nStatus: ${wo.status}`);
        this.closeEventInspection();
        this.loadWorkOrders();
        this.loadStats();
      }
    } catch (e) {
      alert(`Error creating work order: ${e.message}`);
    }
  }

  async updateWorkOrderStatus(woId, newStatus) {
    try {
      const res = await fetch(`${this.backendUrl}/work-orders/${woId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        this.loadWorkOrders();
        this.loadStats();
      }
    } catch (e) {
      console.warn("Status update error:", e);
    }
  }

  addWorkOrderToUI(wo, isNew = false) {
    const existing = document.getElementById(`wo-card-${wo.work_order_id}`);
    if (existing) {
      this.updateWorkOrderInUI(wo);
      return;
    }

    const empty = this.woListContainer.querySelector(".empty-state");
    if (empty) empty.remove();

    const item = document.createElement("div");
    item.id = `wo-card-${wo.work_order_id}`;
    item.className = "wo-card-item";

    item.innerHTML = `
      <div class="wo-card-header">
        <span class="wo-id">${wo.work_order_id}</span>
        <select class="wo-status-select" id="wo-select-${wo.work_order_id}" style="background:#080d1a; color:#00f2fe; border:1px solid #334155; border-radius:4px; font-size:10px; font-family:monospace; padding:2px 4px; font-weight:700;">
          <option value="OPEN" ${wo.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
          <option value="ASSIGNED" ${wo.status === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED</option>
          <option value="IN PROGRESS" ${wo.status === 'IN PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
          <option value="RESOLVED" ${wo.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
        </select>
      </div>
      <div class="wo-title">${wo.title}</div>
      <div class="wo-loc">📍 ${wo.location_name || 'Urban Zone'} • Assigned: ${wo.assigned_to}</div>
    `;

    const selectEl = item.querySelector(`#wo-select-${wo.work_order_id}`);
    selectEl.addEventListener("change", (e) => this.updateWorkOrderStatus(wo.work_order_id, e.target.value));

    if (isNew) {
      this.woListContainer.prepend(item);
    } else {
      this.woListContainer.appendChild(item);
    }
  }

  updateWorkOrderInUI(wo) {
    const card = document.getElementById(`wo-card-${wo.work_order_id}`);
    if (card) {
      const selectEl = card.querySelector("select");
      if (selectEl && wo.status) {
        selectEl.value = wo.status;
      }
    }
  }

  async loadInitialData() {
    await this.loadStats();
    await this.loadEvents();
    await this.loadWorkOrders();
    await this.loadBuses();
  }

  async pollUpdates() {
    await this.loadStats();
    await this.loadEvents();
    await this.loadWorkOrders();
  }

  async loadStats() {
    try {
      const res = await fetch(`${this.backendUrl}/stats`);
      if (res.ok) {
        const d = await res.json();
        this.statActiveBuses.innerText = d.active_buses;
        this.statTotalEvents.innerText = d.events_today;
        this.statRoadDefects.innerText = d.road_defects;
        this.statVehicles.innerText = d.vehicles_detected;
        this.statHighPriority.innerText = d.high_priority_events;
      }
    } catch (e) {}
  }

  async loadEvents() {
    try {
      const res = await fetch(`${this.backendUrl}/events?limit=25`);
      if (res.ok) {
        const events = await res.json();
        events.forEach((evt) => {
          this.addEventToFeed(evt, false);
          this.addEventMarker(evt);
        });
      }
    } catch (e) {}
  }

  async loadWorkOrders() {
    try {
      const res = await fetch(`${this.backendUrl}/work-orders`);
      if (res.ok) {
        const list = await res.json();
        this.woCount.innerText = list.length;
        list.forEach((wo) => this.addWorkOrderToUI(wo, false));
      }
    } catch (e) {}
  }

  async loadBuses() {
    try {
      const res = await fetch(`${this.backendUrl}/buses`);
      if (res.ok) {
        const buses = await res.json();
        if (buses.length > 0) {
          const b = buses[0];
          this.cardBusId.innerText = b.bus_id;
          this.cardBusName.innerText = b.name;
          if (b.latitude && b.longitude) {
            this.updateBusPosition(b);
          }
        }
      }
    } catch (e) {}
  }

  async seedDemoData() {
    try {
      const sampleEvents = [
        {
          event_type: "POTHOLE",
          confidence: 0.92,
          latitude: 12.973120,
          longitude: 77.601890,
          severity: "HIGH",
          location_name: "Trinity Circle South Approach",
          vibration_level: "HIGH"
        },
        {
          event_type: "POTHOLE",
          confidence: 0.88,
          latitude: 12.976540,
          longitude: 77.618920,
          severity: "MEDIUM",
          location_name: "Halasuru Lake Road Inner Lane",
          vibration_level: "NORMAL"
        },
        {
          event_type: "VEHICLE_COUNT",
          confidence: 0.94,
          latitude: 12.971598,
          longitude: 77.594562,
          severity: "MEDIUM",
          count: 14,
          vehicle_class: "CAR",
          location_name: "MG Road Metro Junction"
        }
      ];

      for (const item of sampleEvents) {
        await fetch(`${this.backendUrl}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bus_id: "BUS-101",
            ...item
          })
        });
      }

      await this.loadInitialData();
      alert("✓ Demo data generated successfully!");
    } catch (e) {
      alert(`Error seeding demo data: ${e.message}`);
    }
  }

  bindEvents() {
    document.getElementById("modalCloseBtn").addEventListener("click", () => this.closeEventInspection());
    document.getElementById("modalDismissBtn").addEventListener("click", () => this.closeEventInspection());
    document.getElementById("btnCreateWorkOrder").addEventListener("click", () => this.createWorkOrderFromSelected());

    document.getElementById("btnSeedData").addEventListener("click", () => this.seedDemoData());
    document.getElementById("btnRefreshEvents").addEventListener("click", () => this.loadInitialData());

    // Connect phone modal
    document.getElementById("btnMobileUrl").addEventListener("click", async () => {
      try {
        const res = await fetch(`${this.backendUrl}/health`);
        const data = await res.json();
        const ip = data.local_ip || window.location.hostname;
        const port = window.location.port || 8000;
        this.mobileConnectUrl.innerText = `http://${ip}:${port}/mobile`;
      } catch (e) {
        this.mobileConnectUrl.innerText = `${window.location.origin}/mobile`;
      }
      this.phoneModal.classList.add("show");
    });
    document.getElementById("phoneModalClose").addEventListener("click", () => this.phoneModal.classList.remove("show"));
    document.getElementById("phoneModalOk").addEventListener("click", () => this.phoneModal.classList.remove("show"));

    // Mode toggles
    document.getElementById("btnModeDemo").addEventListener("click", () => {
      document.getElementById("btnModeDemo").classList.add("active");
      document.getElementById("btnModeLive").classList.remove("active");
      this.sourceLabel.innerText = "DEMO VIDEO";
    });
    document.getElementById("btnModeLive").addEventListener("click", () => {
      document.getElementById("btnModeLive").classList.add("active");
      document.getElementById("btnModeDemo").classList.remove("active");
      this.sourceLabel.innerText = "LIVE PHONE";
    });

    // Center map buttons
    document.getElementById("btnCenterBus").addEventListener("click", () => {
      if (this.map && this.busLocation) {
        this.map.setView(this.busLocation, 16);
      }
    });

    document.getElementById("btnFitAll").addEventListener("click", () => {
      if (this.map) {
        const group = [];
        if (this.busMarker) group.push(this.busMarker.getLatLng());
        Object.values(this.eventMarkers).forEach((m) => group.push(m.getLatLng()));
        if (group.length > 0) {
          this.map.fitBounds(L.latLngBounds(group), { padding: [40, 40] });
        }
      }
    });
  }
}

// Instantiate dashboard upon DOM ready
window.addEventListener("DOMContentLoaded", () => {
  window.gartikaDashboard = new GartikaDashboard();
});
