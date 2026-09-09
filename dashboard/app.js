/**
 * Gartika Urban Intelligence Command Center — Live Enterprise Client Engine.
 * 
 * Provides interactive GIS map visualization (Leaflet.js), live smartphone telemetry tracking,
 * real-time defect alert ingestion via WebSockets, live camera preview, and work order dispatching.
 * 
 * Strictly operates on live smartphone camera frames, real GPS coordinates, and real IMU shock alerts.
 */
class GartikaCommandCenter {
  /**
   * Initializes state, map layer, WebSocket channels, DOM elements, and periodic polling.
   */
  constructor() {
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/events`;
    
    // Core State
    this.busLocation = null;
    this.events = [];
    this.workOrders = [];
    this.selectedEvent = null;
    this.activeFeedFilter = 'ALL';
    this.map = null;
    this.busMarker = null;
    this.busRoutePolyline = null;
    this.busTrail = [];
    this.eventMarkers = {};
    this.ws = null;
    this.localIp = 'localhost';

    this.initElements();
    this.initMap();
    this.initWebSocket();
    this.bindEvents();
    this.loadInitialData();
    this.startLiveStreamPolling();

    // Regular polling fallback every 3.0s to ensure consistency
    setInterval(() => this.pollUpdates(), 3000);
  }

  /**
   * Cache references to UI counters, stream elements, feeds, and modals.
   */
  initElements() {
    // KPI Counters
    this.metricActiveBuses = document.getElementById('metricActiveBuses');
    this.metricBusId = document.getElementById('metricBusId');
    this.metricRoadDefects = document.getElementById('metricRoadDefects');
    this.metricVehicles = document.getElementById('metricVehicles');
    this.metricHighPriority = document.getElementById('metricHighPriority');

    // Telemetry display
    this.teleLat = document.getElementById('teleLat');
    this.teleLon = document.getElementById('teleLon');
    this.teleSpeed = document.getElementById('teleSpeed');
    this.imuValStatus = document.getElementById('imuValStatus');
    this.hudBusTag = document.getElementById('hudBusTag');
    this.streamFpsChip = document.getElementById('streamFpsChip');

    // Camera Stream
    this.liveStreamImg = document.getElementById('liveStreamImg');
    this.streamPlaceholder = document.getElementById('streamPlaceholder');

    // Containers
    this.eventFeedScroll = document.getElementById('eventFeedScroll');
    this.woItemsContainer = document.getElementById('woItemsContainer');
    this.woFilterSelect = document.getElementById('woFilterSelect');
    this.toastContainer = document.getElementById('toastContainer');

    // Modals
    this.eventModal = document.getElementById('eventModal');
    this.modalSeverityTag = document.getElementById('modalSeverityTag');
    this.modalEventTitle = document.getElementById('modalEventTitle');
    this.modalEventId = document.getElementById('modalEventId');
    this.modalEvidenceImg = document.getElementById('modalEvidenceImg');
    this.modalEvidenceFallback = document.getElementById('modalEvidenceFallback');
    this.modalEventType = document.getElementById('modalEventType');
    this.modalConfidence = document.getElementById('modalConfidence');
    this.modalBusId = document.getElementById('modalBusId');
    this.modalLocation = document.getElementById('modalLocation');
    this.modalTimestamp = document.getElementById('modalTimestamp');
    this.modalVibration = document.getElementById('modalVibration');
    this.btnCreateWorkOrder = document.getElementById('btnCreateWorkOrder');

    // Phone modal
    this.phoneModal = document.getElementById('phoneModal');
    this.mobileConnectUrl = document.getElementById('mobileConnectUrl');
    this.qrCodeContainer = document.getElementById('qrCodeContainer');

    // Connectivity Status Nodes
    this.pillEdge = document.getElementById('pillEdge');
    this.pillBackend = document.getElementById('pillBackend');
    this.pillAi = document.getElementById('pillAi');
    this.pillWs = document.getElementById('pillWs');
  }

  /**
   * Display floating toast notification on top-right of dashboard.
   * @param {string} message - Notification text.
   * @param {string} type - Notification level ('info', 'success', 'warn', 'error').
   */
  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    let svgIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
    if (type === 'success') {
      svgIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>';
    } else if (type === 'warn') {
      svgIcon = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>';
    }
    
    toast.innerHTML = `<span class="toast-icon-wrap">${svgIcon}</span> <span>${message}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3200);
  }

  /**
   * Initialize Leaflet GIS map with dark mode tiles.
   */
  initMap() {
    try {
      // Default view centering on Bangalore or neutral location until real GPS is received
      const initialCenter = [12.971598, 77.594562];
      this.map = L.map('gisMap', {
        center: initialCenter,
        zoom: 14,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
        subdomains: 'abc',
      }).addTo(this.map);

      const coordsBar = document.getElementById('mapCursorCoords');
      if (coordsBar) {
        this.map.on('mousemove', (e) => {
          coordsBar.innerText = `Lat: ${e.latlng.lat.toFixed(5)}° N | Lon: ${e.latlng.lng.toFixed(5)}° E`;
        });
      }

      this.busRoutePolyline = L.polyline([], {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.85
      }).addTo(this.map);

    } catch (e) {
      console.error('[MAP] Initialization error:', e);
    }
  }

  /**
   * Connect to real-time WebSocket channel and register reconnection lifecycle listeners.
   */
  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.updateNodeStatus(this.pillWs, true, 'Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncomingEvent(payload);
        } catch (e) {}
      };

      this.ws.onerror = () => {
        this.updateNodeStatus(this.pillWs, false, 'Offline');
      };

      this.ws.onclose = () => {
        this.updateNodeStatus(this.pillWs, false, 'Reconnecting');
        setTimeout(() => this.initWebSocket(), 4000);
      };
    } catch (e) {
      this.updateNodeStatus(this.pillWs, false, 'Error');
    }
  }

  /**
   * Update top navigation LED pill status.
   * @param {HTMLElement} el - Pill DOM element.
   * @param {boolean} isOnline - Whether state is healthy.
   * @param {string} text - Label text.
   */
  updateNodeStatus(el, isOnline, text) {
    if (!el) return;
    const dot = el.querySelector('.dot-led');
    const strong = el.querySelector('strong');
    if (dot) {
      dot.className = `dot-led ${isOnline ? 'online' : 'offline'}`;
    }
    if (strong) {
      strong.innerText = text;
    }
  }

  /**
   * Bind event listeners to UI toolbar buttons, modals, and tab filters.
   */
  bindEvents() {
    document.getElementById('btnConnectPhone')?.addEventListener('click', () => this.openPhoneModal());
    document.getElementById('phoneModalClose')?.addEventListener('click', () => this.closePhoneModal());
    document.getElementById('phoneModalOk')?.addEventListener('click', () => this.closePhoneModal());

    document.getElementById('btnCopyMobileUrl')?.addEventListener('click', () => {
      const url = this.mobileConnectUrl.value;
      navigator.clipboard?.writeText(url);
      this.showToast('Mobile URL copied to clipboard', 'success');
    });

    document.getElementById('btnCenterBus')?.addEventListener('click', () => this.centerOnBus());
    document.getElementById('btnFitAll')?.addEventListener('click', () => this.fitMapBounds());

    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        tabs.forEach((t) => t.classList.remove('active'));
        e.target.classList.add('active');
        this.activeFeedFilter = e.target.dataset.filter;
        this.renderEventFeed();
      });
    });

    this.woFilterSelect?.addEventListener('change', (e) => {
      this.renderWorkOrders(e.target.value);
    });

    document.getElementById('btnRefreshEvents')?.addEventListener('click', () => {
      this.loadInitialData();
      this.showToast('Synchronized detections', 'info');
    });

    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.closeEventModal());
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.closeEventModal());
    this.btnCreateWorkOrder?.addEventListener('click', () => this.dispatchWorkOrderFromModal());
  }

  /**
   * Fetch initial batch of system health, stats, events, work orders, and bus coordinates.
   */
  async loadInitialData() {
    await Promise.all([
      this.loadHealth(),
      this.loadStats(),
      this.loadEvents(),
      this.loadWorkOrders(),
      this.loadBusTelemetry()
    ]);
  }

  /**
   * Background polling fallback to refresh stats and coordinates.
   */
  async pollUpdates() {
    await Promise.all([
      this.loadStats(),
      this.loadBusTelemetry(),
      this.loadWorkOrders()
    ]);
  }

  /**
   * Check backend health and update status pills.
   */
  async loadHealth() {
    try {
      const res = await fetch(`${this.backendUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        this.localIp = data.local_ip || window.location.hostname || 'localhost';
        this.updateNodeStatus(this.pillBackend, true, 'Healthy');
        this.updateNodeStatus(this.pillAi, true, 'Ready');
      }
    } catch (e) {
      this.updateNodeStatus(this.pillBackend, false, 'Degraded');
    }
  }

  /**
   * Fetch statistical summary counters and update KPI widgets.
   */
  async loadStats() {
    try {
      const res = await fetch(`${this.backendUrl}/stats/summary`);
      if (res.ok) {
        const stats = await res.json();
        if (this.metricActiveBuses) this.metricActiveBuses.innerHTML = `${stats.active_buses || 0} <span class="metric-unit">Units</span>`;
        if (this.metricRoadDefects) this.metricRoadDefects.innerText = stats.total_potholes || 0;
        if (this.metricVehicles) this.metricVehicles.innerHTML = `${stats.total_vehicles || 0} <span class="metric-unit">Vehicles</span>`;
        if (this.metricHighPriority) this.metricHighPriority.innerText = `${stats.high_priority_events || 0} Critical`;
        
        if (stats.active_buses > 0) {
          if (this.metricBusId) this.metricBusId.innerText = 'BUS-101 (Connected)';
          this.updateNodeStatus(this.pillEdge, true, 'Active');
        } else {
          if (this.metricBusId) this.metricBusId.innerText = 'Awaiting connection...';
          this.updateNodeStatus(this.pillEdge, false, 'Listening');
        }
      }
    } catch (e) {}
  }

  /**
   * Load recent AI detection events from /events.
   */
  async loadEvents() {
    try {
      const res = await fetch(`${this.backendUrl}/events?limit=40`);
      if (res.ok) {
        this.events = await res.json();
        this.renderEventFeed();
        this.plotEventMarkers();
      }
    } catch (e) {}
  }

  /**
   * Load all maintenance work orders from /work-orders.
   */
  async loadWorkOrders() {
    try {
      const res = await fetch(`${this.backendUrl}/work-orders`);
      if (res.ok) {
        this.workOrders = await res.json();
        this.renderWorkOrders(this.woFilterSelect?.value || 'ALL');
      }
    } catch (e) {}
  }

  /**
   * Load latest GPS and IMU telemetry observation for BUS-101.
   */
  async loadBusTelemetry() {
    try {
      const res = await fetch(`${this.backendUrl}/telemetry/latest?bus_id=BUS-101`);
      if (res.ok) {
        const tel = await res.json();
        this.updateBusTelemetryUI(tel);
      }
    } catch (e) {}
  }

  /**
   * Update HUD telemetry labels, marker position, and polyline trail.
   * @param {Object} tel - Telemetry payload.
   */
  updateBusTelemetryUI(tel) {
    if (!tel || tel.latitude === undefined || tel.longitude === undefined) return;
    
    if (this.teleLat) this.teleLat.innerText = tel.latitude.toFixed(4);
    if (this.teleLon) this.teleLon.innerText = tel.longitude.toFixed(4);
    if (this.teleSpeed) this.teleSpeed.innerText = `${(tel.speed || 0.0).toFixed(1)} km/h`;

    const az = tel.az !== undefined ? tel.az : 9.81;
    if (this.imuValStatus) {
      if (az > 13.5 || Math.abs(az - 9.81) > 4.0) {
        this.imuValStatus.innerHTML = `<span style="color:var(--accent-red); font-weight:700;">${az.toFixed(2)} m/s² (Bump Shock)</span>`;
      } else {
        this.imuValStatus.innerText = `${az.toFixed(2)} m/s² (Normal)`;
      }
    }

    if (tel.latitude && tel.longitude) {
      const newPos = [tel.latitude, tel.longitude];
      this.busLocation = newPos;

      if (!this.busMarker) {
        const busHtml = `
          <div class="marker-bus-clean">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" stroke-width="2">
              <rect x="3" y="6" width="18" height="12" rx="2"></rect>
              <circle cx="7" cy="18" r="2"></circle>
              <circle cx="17" cy="18" r="2"></circle>
            </svg>
          </div>
        `;
        const busIcon = L.divIcon({
          className: 'custom-bus-icon',
          html: busHtml,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        this.busMarker = L.marker(newPos, { icon: busIcon }).addTo(this.map);
        this.busMarker.bindPopup(`
          <div style="font-size:12px; padding:4px;">
            <strong style="color:#3b82f6;">${tel.bus_id || 'BUS-101'}</strong><br>
            Live Mobile Sensing Unit<br>
            Status: Active
          </div>
        `);
        this.map.setView(newPos, 16);
      } else {
        this.busMarker.setLatLng(newPos);
      }

      this.busTrail.push(newPos);
      if (this.busTrail.length > 50) this.busTrail.shift();
      if (this.busRoutePolyline) this.busRoutePolyline.setLatLngs(this.busTrail);
    }
  }

  /**
   * Poll latest video frame snapshot from /stream/latest-frame for live preview feed.
   */
  startLiveStreamPolling() {
    let errCount = 0;
    setInterval(() => {
      if (!this.liveStreamImg) return;
      const img = new Image();
      const ts = new Date().getTime();
      img.src = `${this.backendUrl}/stream/latest-frame?t=${ts}`;
      img.onload = () => {
        this.liveStreamImg.src = img.src;
        if (this.streamPlaceholder) this.streamPlaceholder.style.display = 'none';
        errCount = 0;
      };
      img.onerror = () => {
        errCount++;
        if (errCount > 2 && this.streamPlaceholder) {
          this.streamPlaceholder.style.display = 'flex';
        }
      };
    }, 800);
  }

  /**
   * Dispatch actions for incoming WebSocket messages (NEW_EVENT, TELEMETRY, etc).
   * @param {Object} payload - Received WebSocket payload.
   */
  handleIncomingEvent(payload) {
    if (!payload || !payload.type) return;

    if (payload.type === 'NEW_EVENT' && payload.data) {
      const evt = payload.data;
      this.events.unshift(evt);
      if (this.events.length > 40) this.events.pop();

      this.renderEventFeed();
      this.addEventMarkerToMap(evt);
      this.loadStats();

      if (evt.event_type === 'POTHOLE' || evt.severity === 'HIGH') {
        this.showToast(`Real road defect detected at ${evt.latitude?.toFixed(4)}, ${evt.longitude?.toFixed(4)}`, 'warn');
      }
    } else if ((payload.type === 'TELEMETRY_UPDATE' || payload.type === 'TELEMETRY') && payload.data) {
      this.updateBusTelemetryUI(payload.data);
      this.loadStats();
    } else if (payload.type === 'NEW_WORK_ORDER' || payload.type === 'UPDATE_WORK_ORDER') {
      this.loadWorkOrders();
    }
  }

  /**
   * Render filtered event cards into the detection feed sidebar.
   */
  renderEventFeed() {
    if (!this.eventFeedScroll) return;
    
    let filtered = this.events;
    if (this.activeFeedFilter === 'POTHOLE') {
      filtered = this.events.filter(e => e.event_type === 'POTHOLE');
    } else if (this.activeFeedFilter === 'VEHICLE_COUNT') {
      filtered = this.events.filter(e => e.event_type === 'VEHICLE_COUNT');
    } else if (this.activeFeedFilter === 'HIGH') {
      filtered = this.events.filter(e => e.severity === 'HIGH');
    }

    if (filtered.length === 0) {
      this.eventFeedScroll.innerHTML = `
        <div class="empty-state">
          <p>No detections matching filter '${this.activeFeedFilter}'</p>
        </div>
      `;
      return;
    }

    this.eventFeedScroll.innerHTML = '';
    filtered.forEach((evt) => {
      const el = document.createElement('div');
      el.className = 'feed-item';
      
      const confPct = Math.round((evt.confidence || 0.75) * 100);
      const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const thumbSrc = evt.evidence_path || evt.evidence_image_url ? `${this.backendUrl}${evt.evidence_path || evt.evidence_image_url}` : '';

      el.innerHTML = `
        <div class="feed-thumb">
          ${thumbSrc ? `<img src="${thumbSrc}" alt="Evidence" />` : `<div style="width:100%;height:100%;background:#18181b;display:flex;align-items:center;justify-content:center;color:#71717a;font-size:10px;">IMG</div>`}
        </div>
        <div class="feed-details">
          <div class="feed-row-top">
            <span class="feed-tag">${evt.event_type === 'POTHOLE' ? 'Road Defect' : 'Traffic Count'}</span>
            <span class="feed-time font-mono">${timeStr}</span>
          </div>
          <div class="feed-meta font-mono">
            <span>${evt.latitude?.toFixed(4)}, ${evt.longitude?.toFixed(4)}</span> • <span style="color:#fafafa;">${evt.bus_id}</span>
          </div>
          <div>
            <div class="progress-track">
              <div class="progress-fill" style="width: ${confPct}%; background: ${evt.severity === 'HIGH' ? '#ef4444' : '#3b82f6'};"></div>
            </div>
          </div>
        </div>
      `;

      el.addEventListener('click', () => this.openEventModal(evt));
      this.eventFeedScroll.appendChild(el);
    });
  }

  /**
   * Plot all loaded event coordinates onto the GIS map.
   */
  plotEventMarkers() {
    if (!this.map) return;
    this.events.forEach((evt) => this.addEventMarkerToMap(evt));
  }

  /**
   * Add an individual interactive marker for a defect or traffic event onto the map.
   * @param {Object} evt - Event object.
   */
  addEventMarkerToMap(evt) {
    if (!this.map || !evt.latitude || !evt.longitude) return;
    if (this.eventMarkers[evt.id || evt.event_id]) return;

    const isPothole = evt.event_type === 'POTHOLE';
    const markerHtml = `
      <div class="marker-pothole-clean" style="background:${isPothole ? '#ef4444' : '#f59e0b'};"></div>
    `;

    const icon = L.divIcon({
      className: 'custom-defect-icon',
      html: markerHtml,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([evt.latitude, evt.longitude], { icon }).addTo(this.map);
    marker.bindPopup(`
      <div style="font-size:12px; padding:4px;">
        <strong>${isPothole ? 'Pothole Defect' : 'Traffic Hub'}</strong><br>
        Severity: <span style="color:${evt.severity === 'HIGH' ? '#ef4444' : '#3b82f6'}; font-weight:700;">${evt.severity}</span> • Conf: ${Math.round((evt.confidence || 0.75)*100)}%<br>
        <button style="margin-top:6px; background:#2563eb; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px; font-weight:600;" id="popupBtn_${evt.event_id || evt.id}">Inspect & Dispatch</button>
      </div>
    `);

    marker.on('popupopen', () => {
      document.getElementById(`popupBtn_${evt.event_id || evt.id}`)?.addEventListener('click', () => {
        this.openEventModal(evt);
      });
    });

    this.eventMarkers[evt.id || evt.event_id] = marker;
  }

  /**
   * Render maintenance work orders table with status dropdown controls.
   * @param {string} statusFilter - Filter status ('ALL', 'OPEN', 'ASSIGNED', 'RESOLVED').
   */
  renderWorkOrders(statusFilter = 'ALL') {
    if (!this.woItemsContainer) return;
    
    let filtered = this.workOrders;
    if (statusFilter !== 'ALL') {
      filtered = this.workOrders.filter(wo => wo.status === statusFilter);
    }

    if (filtered.length === 0) {
      this.woItemsContainer.innerHTML = `
        <div class="empty-state">
          <p>No work orders found with status '${statusFilter}'</p>
        </div>
      `;
      return;
    }

    this.woItemsContainer.innerHTML = '';
    filtered.forEach((wo) => {
      const row = document.createElement('div');
      row.className = 'wo-row';
      const timeStr = new Date(wo.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

      row.innerHTML = `
        <div class="wo-left">
          <span class="wo-badge">${wo.work_order_id || wo.order_id}</span>
          <div>
            <div class="wo-title">${wo.title || wo.description || 'Pothole Patching Order'}</div>
            <div class="wo-meta font-mono">${wo.latitude ? wo.latitude.toFixed(4) : '--'}, ${wo.longitude ? wo.longitude.toFixed(4) : '--'} • ${timeStr}</div>
          </div>
        </div>
        <div>
          <select class="status-select-pill status-${(wo.status || 'OPEN').replace(' ', '_')}">
            <option value="OPEN" ${wo.status === 'OPEN' ? 'selected' : ''}>Open</option>
            <option value="ASSIGNED" ${wo.status === 'ASSIGNED' ? 'selected' : ''}>Assigned</option>
            <option value="IN PROGRESS" ${wo.status === 'IN PROGRESS' ? 'selected' : ''}>In Progress</option>
            <option value="RESOLVED" ${wo.status === 'RESOLVED' ? 'selected' : ''}>Resolved</option>
          </select>
        </div>
      `;

      const select = row.querySelector('.status-select-pill');
      select.addEventListener('change', (e) => {
        this.updateWorkOrderStatus(wo.work_order_id || wo.id, e.target.value);
      });

      this.woItemsContainer.appendChild(row);
    });
  }

  /**
   * Update status of a work order via PATCH request.
   * @param {string} id - Work order ID.
   * @param {string} newStatus - Updated status.
   */
  async updateWorkOrderStatus(id, newStatus) {
    try {
      const res = await fetch(`${this.backendUrl}/work-orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        this.showToast(`Updated Work Order status to ${newStatus}`, 'success');
        this.loadWorkOrders();
      }
    } catch (e) {
      this.showToast('Failed to update status', 'error');
    }
  }

  /**
   * Open modal popup with annotated evidence image and full defect telemetry details.
   * @param {Object} evt - Event object to display.
   */
  openEventModal(evt) {
    this.selectedEvent = evt;
    if (!this.eventModal) return;

    this.modalSeverityTag.innerText = `${evt.severity || 'HIGH'} SEVERITY`;
    this.modalSeverityTag.className = `badge ${evt.severity === 'HIGH' ? 'badge-red' : 'badge-subtle'}`;
    this.modalEventTitle.innerText = evt.event_type === 'POTHOLE' ? 'Road Pothole Defect' : 'Traffic Count Event';
    this.modalEventId.innerText = evt.event_id || evt.id;
    this.modalEventType.innerText = evt.event_type || 'POTHOLE';
    this.modalConfidence.innerText = `${Math.round((evt.confidence || 0.85) * 100)}%`;
    this.modalBusId.innerText = evt.bus_id || 'BUS-101';
    this.modalLocation.innerText = evt.latitude && evt.longitude ? `${evt.latitude.toFixed(6)}, ${evt.longitude.toFixed(6)}` : '--';
    this.modalTimestamp.innerText = new Date(evt.timestamp).toLocaleString();

    const imgUrl = evt.evidence_path || evt.evidence_image_url;
    if (imgUrl) {
      this.modalEvidenceImg.src = `${this.backendUrl}${imgUrl}`;
      this.modalEvidenceImg.style.display = 'block';
      this.modalEvidenceFallback.style.display = 'none';
    } else {
      this.modalEvidenceImg.style.display = 'none';
      this.modalEvidenceFallback.style.display = 'flex';
    }

    this.eventModal.classList.add('active');
  }

  /**
   * Close the event inspection modal.
   */
  closeEventModal() {
    if (this.eventModal) this.eventModal.classList.remove('active');
    this.selectedEvent = null;
  }

  /**
   * Dispatch a new repair work order directly from the open event modal.
   */
  async dispatchWorkOrderFromModal() {
    if (!this.selectedEvent) return;
    const evt = this.selectedEvent;

    const payload = {
      event_id: evt.event_id || evt.id,
      title: `Repair ${evt.event_type} (${evt.severity || 'HIGH'})`,
      priority: evt.severity === 'HIGH' ? 'HIGH' : 'MEDIUM',
      assigned_to: 'BBMP Road Maintenance Crew Alpha',
      description: `Fix ${evt.severity || 'HIGH'} defect reported by ${evt.bus_id} at Lat: ${evt.latitude?.toFixed(4)}, Lon: ${evt.longitude?.toFixed(4)}`
    };

    try {
      const res = await fetch(`${this.backendUrl}/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.showToast('Repair Work Order Dispatched', 'success');
        this.closeEventModal();
        this.loadWorkOrders();
      }
    } catch (e) {
      this.showToast('Failed to dispatch order', 'error');
    }
  }

  /**
   * Open the phone connection modal showing QR code and network URL.
   */
  async openPhoneModal() {
    if (!this.phoneModal) return;
    try {
      const res = await fetch(`${this.backendUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        this.localIp = data.local_ip || window.location.hostname || 'localhost';
      }
    } catch (e) {}

    const proto = window.location.protocol;
    const port = window.location.port ? `:${window.location.port}` : '';
    const host = this.localIp !== 'localhost' && this.localIp !== '127.0.0.1' ? this.localIp : (window.location.hostname || 'localhost');
    const mobileUrl = `${proto}//${host}${port}/mobile`;
    
    if (this.mobileConnectUrl) {
      this.mobileConnectUrl.value = mobileUrl;
    }

    if (this.qrCodeContainer) {
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=2&color=ffffff&bgcolor=121215&data=${encodeURIComponent(mobileUrl)}`;
      this.qrCodeContainer.innerHTML = `
        <div style="padding:8px; background:#121215; border:1px solid rgba(255,255,255,0.12); border-radius:8px; text-align:center;">
          <img src="${qrApiUrl}" width="140" height="140" alt="QR Code" style="display:block; margin:0 auto; border-radius:4px;" onerror="this.outerHTML='<div style=padding:16px;color:#a1a1aa;font-size:12px;>Open URL in Phone</div>'" />
          <div style="margin-top:6px; font-size:10px; color:#a1a1aa;">Scan on smartphone to start sensing</div>
        </div>
      `;
    }

    this.phoneModal.classList.add('active');
  }

  /**
   * Close the phone connection modal.
   */
  closePhoneModal() {
    if (this.phoneModal) this.phoneModal.classList.remove('active');
  }

  /**
   * Smoothly pan and zoom GIS map to the phone's current GPS location.
   */
  centerOnBus() {
    if (this.map && this.busLocation) {
      this.map.flyTo(this.busLocation, 16, { animate: true, duration: 1.0 });
    }
  }

  /**
   * Adjust GIS map bounds to fit the phone GPS and all recorded defect markers in one view.
   */
  fitMapBounds() {
    if (!this.map) return;
    const group = [];
    if (this.busLocation) group.push(this.busLocation);
    this.events.forEach(e => {
      if (e.latitude && e.longitude) group.push([e.latitude, e.longitude]);
    });
    if (group.length > 0) {
      this.map.fitBounds(L.latLngBounds(group).pad(0.1));
    }
  }
}

// Instantiate command center on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.gartikaApp = new GartikaCommandCenter();
});
