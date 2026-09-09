// Gartika Mobile Urban Intelligence Command Center
class GartikaDashboard {
  constructor() {
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/events`;
    
    // State
    this.busLocation = [12.971598, 77.594562];
    this.events = [];
    this.workOrders = [];
    this.selectedEvent = null;
    this.activeFeedFilter = "ALL";
    this.map = null;
    this.busMarker = null;
    this.busAccuracyCircle = null;
    this.eventMarkers = {};
    this.ws = null;
    this.sourceMode = "DEMO";
    this.streamInterval = null;

    this.initElements();
    this.initMap();
    this.initWebSocket();
    this.bindEvents();
    this.loadInitialData();
    this.startLiveStreamPolling();

    // Regular polling fallback every 3.5 seconds
    setInterval(() => this.pollUpdates(), 3500);
  }

  initElements() {
    // Stat counters
    this.metricActiveBuses = document.getElementById("metricActiveBuses");
    this.metricBusId = document.getElementById("metricBusId");
    this.metricTotalEvents = document.getElementById("metricTotalEvents");
    this.metricRoadDefects = document.getElementById("metricRoadDefects");
    this.metricVehicles = document.getElementById("metricVehicles");
    this.metricHighPriority = document.getElementById("metricHighPriority");

    // Bus card
    this.busIdVal = document.getElementById("busIdVal");
    this.busNameVal = document.getElementById("busNameVal");
    this.teleLat = document.getElementById("teleLat");
    this.teleLon = document.getElementById("teleLon");
    this.teleSpeed = document.getElementById("teleSpeed");
    this.teleLastSeen = document.getElementById("teleLastSeen");
    this.busLiveChip = document.getElementById("busLiveChip");
    this.hudBusTag = document.getElementById("hudBusTag");

    // Live Stream
    this.liveStreamImg = document.getElementById("liveStreamImg");
    this.streamPlaceholder = document.getElementById("streamPlaceholder");

    // Containers
    this.eventFeedScroll = document.getElementById("eventFeedScroll");
    this.woItemsContainer = document.getElementById("woItemsContainer");
    this.woCountBadge = document.getElementById("woCountBadge");
    this.woFilterSelect = document.getElementById("woFilterSelect");

    // Modals
    this.eventModal = document.getElementById("eventModal");
    this.modalSeverityTag = document.getElementById("modalSeverityTag");
    this.modalEventTitle = document.getElementById("modalEventTitle");
    this.modalEventId = document.getElementById("modalEventId");
    this.modalEvidenceImg = document.getElementById("modalEvidenceImg");
    this.modalEvidenceFallback = document.getElementById("modalEvidenceFallback");
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

    // Connectivity Pills
    this.pillEdge = document.getElementById("pillEdge");
    this.pillBackend = document.getElementById("pillBackend");
    this.pillAi = document.getElementById("pillAi");
    this.pillWs = document.getElementById("pillWs");
  }

  initMap() {
    try {
      this.map = L.map("gisMap", {
        center: this.busLocation,
        zoom: 15,
        zoomControl: true,
      });

      // High contrast Dark Matter CartoDB tiles
      const tiles = L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OSM',
        maxZoom: 19,
        subdomains: "abcd",
      });
      tiles.addTo(this.map);

      // Custom Bus pulse marker icon
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
        if (this.pillWs) {
          this.pillWs.classList.add("online");
          document.getElementById("valWs").innerText = "SYNCED";
        }
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
        if (this.pillWs) {
          this.pillWs.classList.remove("online");
          document.getElementById("valWs").innerText = "OFFLINE";
        }
        console.log("[WS] Disconnected. Reconnecting in 3s...");
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.warn("[WS] Failed to connect:", e);
    }
  }

  handleLiveMessage(msg) {
    if (msg.type === "NEW_EVENT") {
      this.events.unshift(msg.data);
      this.renderEvents();
      this.addEventMarker(msg.data);
      this.loadStats();
    } else if (msg.type === "TELEMETRY" || msg.type === "BUS_UPDATE") {
      this.updateBusPosition(msg.data);
    } else if (msg.type === "NEW_WORK_ORDER") {
      this.workOrders.unshift(msg.data);
      this.renderWorkOrders();
      this.loadStats();
    } else if (msg.type === "UPDATE_WORK_ORDER") {
      const idx = this.workOrders.findIndex(w => w.work_order_id === msg.data.work_order_id);
      if (idx !== -1) {
        this.workOrders[idx] = { ...this.workOrders[idx], ...msg.data };
        this.renderWorkOrders();
      } else {
        this.loadWorkOrders();
      }
      this.loadStats();
    } else if (msg.type === "DELETE_EVENT") {
      this.events = this.events.filter(e => e.event_id !== msg.data.event_id);
      if (this.eventMarkers[msg.data.event_id]) {
        this.map.removeLayer(this.eventMarkers[msg.data.event_id]);
        delete this.eventMarkers[msg.data.event_id];
      }
      this.renderEvents();
      this.loadStats();
    }
  }

  updateBusPosition(data) {
    if (!data.latitude || !data.longitude) return;

    this.busLocation = [data.latitude, data.longitude];
    if (this.teleLat) this.teleLat.innerText = data.latitude.toFixed(6);
    if (this.teleLon) this.teleLon.innerText = data.longitude.toFixed(6);

    if (data.speed !== undefined && this.teleSpeed) {
      this.teleSpeed.innerText = `${parseFloat(data.speed).toFixed(1)} km/h`;
    }
    if (this.teleLastSeen) this.teleLastSeen.innerText = "Just now";

    if (data.bus_id && this.busIdVal) {
      this.busIdVal.innerText = data.bus_id;
      if (this.hudBusTag) this.hudBusTag.innerText = data.bus_id;
    }

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

    const isPothole = evt.event_type === "POTHOLE" || evt.event_type === "ROAD_DEFECT" || evt.event_type === "CRACK";
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

  renderEvents() {
    if (!this.eventFeedScroll) return;

    let filtered = this.events;
    if (this.activeFeedFilter === "POTHOLE") {
      filtered = this.events.filter(e => e.event_type === "POTHOLE" || e.event_type === "ROAD_DEFECT" || e.event_type === "CRACK");
    } else if (this.activeFeedFilter === "VEHICLE_COUNT") {
      filtered = this.events.filter(e => e.event_type === "VEHICLE_COUNT" || e.event_type === "TRAFFIC");
    } else if (this.activeFeedFilter === "HIGH") {
      filtered = this.events.filter(e => e.severity === "HIGH" || e.severity === "CRITICAL");
    }

    if (filtered.length === 0) {
      this.eventFeedScroll.innerHTML = `<div class="empty-hint">No detections matching filter '${this.activeFeedFilter}'</div>`;
      return;
    }

    this.eventFeedScroll.innerHTML = "";
    filtered.forEach(evt => {
      const isPothole = evt.event_type === "POTHOLE" || evt.event_type === "ROAD_DEFECT" || evt.event_type === "CRACK";
      const icon = isPothole ? "🕳️" : "🚗";
      const confPct = (evt.confidence * 100).toFixed(0);
      const tsStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      const card = document.createElement("div");
      card.className = `event-card ${evt.event_type}`;
      card.innerHTML = `
        <div class="event-top-row">
          <span class="event-type-label">${icon} ${evt.event_type}</span>
          <span class="event-sev-chip ${evt.severity || 'MEDIUM'}">${evt.severity || 'MEDIUM'}</span>
        </div>
        <div class="event-mid-row">
          <span>Confidence: <strong class="event-conf-bold">${confPct}%</strong></span>
          <span>${tsStr}</span>
        </div>
        <div class="event-loc-text">📍 ${evt.location_name || `${evt.latitude.toFixed(4)}, ${evt.longitude.toFixed(4)}`}</div>
        <div class="event-inspect-hint">🔍 Inspect Evidence & Dispatch ➔</div>
      `;

      card.addEventListener("click", () => this.openEventInspection(evt));
      this.eventFeedScroll.appendChild(card);
    });
  }

  openEventInspection(evt) {
    this.selectedEvent = evt;
    if (this.modalSeverityTag) {
      this.modalSeverityTag.className = `modal-tag ${evt.severity === 'HIGH' || evt.severity === 'CRITICAL' ? 'danger' : 'warning'}`;
      this.modalSeverityTag.innerText = `${evt.severity || 'HIGH'} SEVERITY`;
    }
    if (this.modalEventTitle) {
      this.modalEventTitle.innerText = (evt.event_type === 'POTHOLE' || evt.event_type === 'ROAD_DEFECT') 
        ? 'ROAD DEFECT DETECTED' 
        : 'URBAN TRAFFIC DENSITY DETECTED';
    }
    if (this.modalEventId) this.modalEventId.innerText = evt.event_id;
    if (this.modalEventType) this.modalEventType.innerText = evt.event_type;
    if (this.modalConfidence) this.modalConfidence.innerText = `${(evt.confidence * 100).toFixed(1)}%`;
    if (this.modalBusId) this.modalBusId.innerText = evt.bus_id || 'BUS-101';
    if (this.modalLocation) this.modalLocation.innerText = `${evt.latitude.toFixed(6)}, ${evt.longitude.toFixed(6)}`;
    if (this.modalTimestamp) this.modalTimestamp.innerText = new Date(evt.timestamp).toLocaleString();
    if (this.modalVibration) {
      this.modalVibration.innerText = evt.vibration_level === 'HIGH' ? 'HIGH Z-SHOCK VIBRATION (DEFECT CONFIRMED)' : 'NORMAL ROAD SENSOR DYNAMICS';
    }

    if (evt.evidence_path) {
      this.modalEvidenceImg.src = `${this.backendUrl}${evt.evidence_path}`;
      this.modalEvidenceImg.style.display = 'block';
      this.modalEvidenceFallback.style.display = 'none';
    } else {
      this.modalEvidenceImg.style.display = 'none';
      this.modalEvidenceFallback.style.display = 'flex';
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
      title: `Repair ${this.selectedEvent.event_type} on Route 335E Corridor`,
      description: `Automated maintenance dispatch generated by Gartika AI Edge Sensor. Confidence: ${(this.selectedEvent.confidence * 100).toFixed(0)}%, Severity: ${this.selectedEvent.severity}`,
      priority: this.selectedEvent.severity === "CRITICAL" ? "CRITICAL" : "HIGH",
      status: "ASSIGNED",
      assigned_to: "BBMP Ward 112 Road Infrastructure Cell",
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
        alert(`✓ WORK ORDER DISPATCHED SUCCESSFULLY!\n\nWork Order ID: ${wo.work_order_id}\nPriority: ${wo.priority}\nAssigned To: ${wo.assigned_to}\nStatus: ${wo.status}`);
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

  renderWorkOrders() {
    if (!this.woItemsContainer) return;

    const filterVal = this.woFilterSelect ? this.woFilterSelect.value : "ALL";
    let filtered = this.workOrders;
    if (filterVal !== "ALL") {
      filtered = this.workOrders.filter(w => w.status === filterVal);
    }

    if (this.woCountBadge) this.woCountBadge.innerText = this.workOrders.length;

    if (filtered.length === 0) {
      this.woItemsContainer.innerHTML = `<div class="empty-hint">No maintenance orders found.</div>`;
      return;
    }

    this.woItemsContainer.innerHTML = "";
    filtered.forEach(wo => {
      const item = document.createElement("div");
      item.className = "wo-row-item";
      item.innerHTML = `
        <div class="wo-info-group">
          <div class="wo-header-line">
            <span class="wo-id-badge">${wo.work_order_id}</span>
            <span class="wo-prio-badge ${wo.priority || 'HIGH'}">${wo.priority || 'HIGH'}</span>
          </div>
          <div class="wo-title-text">${wo.title}</div>
          <div class="wo-sub-text">📍 ${wo.location_name || 'Urban Zone'} • ${wo.assigned_to || 'Maintenance Team'}</div>
        </div>
        <div class="wo-action-group">
          <select class="wo-status-select" data-wo-id="${wo.work_order_id}">
            <option value="OPEN" ${wo.status === 'OPEN' ? 'selected' : ''}>OPEN</option>
            <option value="ASSIGNED" ${wo.status === 'ASSIGNED' ? 'selected' : ''}>ASSIGNED</option>
            <option value="IN PROGRESS" ${wo.status === 'IN PROGRESS' ? 'selected' : ''}>IN PROGRESS</option>
            <option value="RESOLVED" ${wo.status === 'RESOLVED' ? 'selected' : ''}>RESOLVED</option>
          </select>
        </div>
      `;

      const sel = item.querySelector("select");
      sel.addEventListener("change", (e) => this.updateWorkOrderStatus(wo.work_order_id, e.target.value));

      this.woItemsContainer.appendChild(item);
    });
  }

  startLiveStreamPolling() {
    // Refresh live frame preview every 800ms
    if (this.streamInterval) clearInterval(this.streamInterval);
    this.streamInterval = setInterval(() => {
      if (this.liveStreamImg && !document.hidden) {
        this.liveStreamImg.src = `${this.backendUrl}/stream/latest-frame?t=${Date.now()}`;
      }
    }, 800);
  }

  async loadInitialData() {
    await this.loadHealth();
    await this.loadStats();
    await this.loadEvents();
    await this.loadWorkOrders();
    await this.loadBuses();
  }

  async pollUpdates() {
    await this.loadHealth();
    await this.loadStats();
    await this.loadEvents();
    await this.loadWorkOrders();
  }


  async loadHealth() {
    try {
      const res = await fetch(`${this.backendUrl}/health`);
      if (res.ok) {
        const d = await res.json();
        if (this.pillBackend) {
          this.pillBackend.classList.toggle("online", d.backend_status === "ONLINE");
          document.getElementById("valBackend").innerText = d.backend_status || "ONLINE";
        }
        if (this.pillAi) {
          this.pillAi.classList.toggle("online", d.ai_engine_status === "ONLINE");
          document.getElementById("valAi").innerText = d.ai_engine_status || "READY";
        }
        if (this.pillEdge) {
          this.pillEdge.classList.toggle("online", d.edge_unit_status === "ONLINE");
          document.getElementById("valEdge").innerText = d.edge_unit_status || "ONLINE";
        }
      }
    } catch (e) {
      if (this.pillBackend) {
        this.pillBackend.classList.remove("online");
        document.getElementById("valBackend").innerText = "OFFLINE";
      }
    }
  }

  async loadStats() {
    try {
      const res = await fetch(`${this.backendUrl}/stats`);
      if (res.ok) {
        const d = await res.json();
        if (this.metricActiveBuses) this.metricActiveBuses.innerText = d.active_buses;
        if (this.metricTotalEvents) this.metricTotalEvents.innerText = d.events_today;
        if (this.metricRoadDefects) this.metricRoadDefects.innerText = d.road_defects;
        if (this.metricVehicles) this.metricVehicles.innerText = d.vehicles_detected;
        if (this.metricHighPriority) this.metricHighPriority.innerText = d.high_priority_events;
      }
    } catch (e) {}
  }


  async loadEvents() {
    try {
      const res = await fetch(`${this.backendUrl}/events?limit=40`);
      if (res.ok) {
        this.events = await res.json();
        this.renderEvents();
        this.events.forEach((evt) => this.addEventMarker(evt));
      }
    } catch (e) {}
  }

  async loadWorkOrders() {
    try {
      const res = await fetch(`${this.backendUrl}/work-orders`);
      if (res.ok) {
        this.workOrders = await res.json();
        this.renderWorkOrders();
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
          if (this.busIdVal) this.busIdVal.innerText = b.bus_id;
          if (this.busNameVal) this.busNameVal.innerText = b.name;
          if (this.metricBusId) this.metricBusId.innerText = b.bus_id;
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
          confidence: 0.94,
          latitude: 12.973120,
          longitude: 77.601890,
          severity: "HIGH",
          location_name: "Trinity Circle South Approach",
          vibration_level: "HIGH"
        },
        {
          event_type: "POTHOLE",
          confidence: 0.89,
          latitude: 12.976540,
          longitude: 77.618920,
          severity: "MEDIUM",
          location_name: "Halasuru Lake Road Inner Lane",
          vibration_level: "NORMAL"
        },
        {
          event_type: "VEHICLE_COUNT",
          confidence: 0.95,
          latitude: 12.971598,
          longitude: 77.594562,
          severity: "MEDIUM",
          count: 16,
          vehicle_class: "CAR",
          location_name: "MG Road Metro Junction"
        },
        {
          event_type: "CRACK",
          confidence: 0.91,
          latitude: 12.974500,
          longitude: 77.608000,
          severity: "LOW",
          location_name: "Brigade Road Intersection",
          vibration_level: "NORMAL"
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
      alert("✓ Sample AI detection events seeded successfully!");
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

    // Filter tabs for event feed
    document.querySelectorAll(".feed-tab").forEach(tab => {
      tab.addEventListener("click", (e) => {
        document.querySelectorAll(".feed-tab").forEach(t => t.classList.remove("active"));
        e.target.classList.add("active");
        this.activeFeedFilter = e.target.getAttribute("data-filter");
        this.renderEvents();
      });
    });

    // Filter select for work orders
    if (this.woFilterSelect) {
      this.woFilterSelect.addEventListener("change", () => this.renderWorkOrders());
    }

    // Connect phone modal
    document.getElementById("btnConnectPhone").addEventListener("click", async () => {
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

