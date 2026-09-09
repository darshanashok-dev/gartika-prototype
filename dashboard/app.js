/**
 * Gartika Urban Intelligence Command Center — Clean Client Engine.
 * 
 * Interactive GIS mapping, real-time mobile GPS tracking, live camera preview,
 * AI defect stream ingestion via WebSockets, and municipal work order dispatching.
 */
class GartikaCommandCenter {
  constructor() {
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/events`;
    
    // Core Application State
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
    this.localIp = window.location.hostname || 'localhost';
    this.isFirstGpsLock = true;

    this.initElements();
    this.initMap();
    this.initWebSocket();
    this.bindEvents();
    this.loadInitialData();
    this.startLiveStreamPolling();

    // Background sync every 4 seconds
    setInterval(() => this.pollUpdates(), 4000);
  }

  initElements() {
    // KPI Counters
    this.metricActiveBuses = document.getElementById('metricActiveBuses');
    this.metricBusId = document.getElementById('metricBusId');
    this.metricBusBadge = document.getElementById('metricBusBadge');
    this.metricRoadDefects = document.getElementById('metricRoadDefects');
    this.metricVehicles = document.getElementById('metricVehicles');
    this.metricHighPriority = document.getElementById('metricHighPriority');

    // Telemetry HUD
    this.teleLat = document.getElementById('teleLat');
    this.teleLon = document.getElementById('teleLon');
    this.teleSpeed = document.getElementById('teleSpeed');
    this.imuValStatus = document.getElementById('imuValStatus');
    this.hudBusTag = document.getElementById('hudBusTag');
    this.streamFpsChip = document.getElementById('streamFpsChip');

    // Camera Stream
    this.liveStreamImg = document.getElementById('liveStreamImg');
    this.streamPlaceholder = document.getElementById('streamPlaceholder');
    this.streamOverlayBadge = document.getElementById('streamOverlayBadge');

    // Feed and Containers
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

    // Phone Pairing Modal
    this.phoneModal = document.getElementById('phoneModal');
    this.mobileConnectUrl = document.getElementById('mobileConnectUrl');
    this.qrCodeContainer = document.getElementById('qrCodeContainer');

    // Live Status Badge
    this.wsStatusDot = document.getElementById('wsStatusDot');
    this.liveStatusText = document.getElementById('liveStatusText');
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  initMap() {
    try {
      // Default view centering (neutral view until phone GPS connects)
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

  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      
      this.ws.onopen = () => {
        if (this.wsStatusDot) this.wsStatusDot.className = 'dot-led online';
        if (this.liveStatusText) this.liveStatusText.innerHTML = 'Live System: <strong>Online</strong>';
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.handleIncomingEvent(payload);
        } catch (e) {}
      };

      this.ws.onerror = () => {
        if (this.wsStatusDot) this.wsStatusDot.className = 'dot-led';
        if (this.liveStatusText) this.liveStatusText.innerHTML = 'Live System: <strong>Connecting...</strong>';
      };

      this.ws.onclose = () => {
        if (this.wsStatusDot) this.wsStatusDot.className = 'dot-led';
        if (this.liveStatusText) this.liveStatusText.innerHTML = 'Live System: <strong>Reconnecting</strong>';
        setTimeout(() => this.initWebSocket(), 4000);
      };
    } catch (e) {
      console.warn('[WS] Error:', e);
    }
  }

  bindEvents() {
    document.getElementById('btnConnectPhone')?.addEventListener('click', () => this.openPhoneModal());
    document.getElementById('phoneModalClose')?.addEventListener('click', () => this.closePhoneModal());
    document.getElementById('phoneModalOk')?.addEventListener('click', () => this.closePhoneModal());

    document.getElementById('btnCopyMobileUrl')?.addEventListener('click', () => {
      const url = this.mobileConnectUrl.value;
      navigator.clipboard?.writeText(url);
      this.showToast('Mobile URL copied to clipboard!', 'success');
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
      this.showToast('Synchronized with live backend', 'info');
    });

    document.getElementById('modalCloseBtn')?.addEventListener('click', () => this.closeEventModal());
    document.getElementById('modalDismissBtn')?.addEventListener('click', () => this.closeEventModal());
    this.btnCreateWorkOrder?.addEventListener('click', () => this.dispatchWorkOrderFromModal());
  }

  async loadInitialData() {
    await Promise.all([
      this.loadHealth(),
      this.loadStats(),
      this.loadEvents(),
      this.loadWorkOrders(),
      this.loadBusTelemetry()
    ]);
  }

  async pollUpdates() {
    await Promise.all([
      this.loadStats(),
      this.loadBusTelemetry()
    ]);
  }

  async loadHealth() {
    try {
      const res = await fetch(`${this.backendUrl}/health`);
      if (res.ok) {
        const data = await res.json();
        if (data.local_ip && this.mobileConnectUrl) {
          const proto = window.location.protocol;
          const port = window.location.port ? `:${window.location.port}` : '';
          this.mobileConnectUrl.value = `${proto}//${data.local_ip}${port}/mobile`;
          this.updateQrCode(this.mobileConnectUrl.value);
        }
      }
    } catch (e) {}
  }

  async loadStats() {
    try {
      const res = await fetch(`${this.backendUrl}/stats/summary`);
      if (res.ok) {
        const s = await res.json();
        if (this.metricActiveBuses) this.metricActiveBuses.innerHTML = `${s.active_buses || 0} <span class="metric-unit">Units</span>`;
        if (this.metricRoadDefects) this.metricRoadDefects.innerText = s.road_defects || 0;
        if (this.metricHighPriority) this.metricHighPriority.innerText = `${s.high_priority_events || 0} Critical`;
        if (this.metricVehicles) this.metricVehicles.innerHTML = `${s.vehicles_detected || 0} <span class="metric-unit">Vehicles</span>`;
      }
    } catch (e) {}
  }

  async loadEvents() {
    try {
      const res = await fetch(`${this.backendUrl}/events?limit=40`);
      if (res.ok) {
        this.events = await res.json();
        this.renderEventFeed();
        this.renderEventMarkersOnMap();
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

  async loadBusTelemetry() {
    try {
      const res = await fetch(`${this.backendUrl}/telemetry/latest?bus_id=BUS-101`);
      if (res.ok) {
        const tel = await res.json();
        this.updateBusTelemetryUI(tel);
      }
    } catch (e) {}
  }

  updateBusTelemetryUI(tel) {
    if (!tel || tel.latitude === undefined || tel.longitude === undefined) return;
    
    if (this.teleLat) this.teleLat.innerText = tel.latitude !== null ? tel.latitude.toFixed(4) : '--';
    if (this.teleLon) this.teleLon.innerText = tel.longitude !== null ? tel.longitude.toFixed(4) : '--';
    if (this.teleSpeed) this.teleSpeed.innerText = `${(tel.speed || 0.0).toFixed(1)} km/h`;

    const az = tel.az !== undefined ? tel.az : 9.81;
    if (this.imuValStatus) {
      if (Math.abs(az - 9.81) > 3.0) {
        this.imuValStatus.innerHTML = `<span style="color:var(--accent-red); font-weight:700;">${az.toFixed(2)} m/s² (Bump)</span>`;
      } else {
        this.imuValStatus.innerText = `${az.toFixed(2)} m/s²`;
      }
    }

    if (this.metricBusId) this.metricBusId.innerText = `${tel.bus_id || 'BUS-101'} (Active)`;
    if (this.metricBusBadge) this.metricBusBadge.innerText = 'Online';

    if (tel.latitude && tel.longitude) {
      const newPos = [tel.latitude, tel.longitude];
      this.busLocation = newPos;

      if (!this.busMarker) {
        const busIcon = L.divIcon({
          className: 'custom-bus-icon',
          html: `<div class="marker-bus-pulse"></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        this.busMarker = L.marker(newPos, { icon: busIcon }).addTo(this.map);
        this.busMarker.bindPopup(`<strong>${tel.bus_id || 'BUS-101'}</strong><br>Live Sensing Unit`);
        
        if (this.isFirstGpsLock) {
          this.map.setView(newPos, 16);
          this.isFirstGpsLock = false;
        }
      } else {
        this.busMarker.setLatLng(newPos);
      }

      this.busTrail.push(newPos);
      if (this.busTrail.length > 50) this.busTrail.shift();
      if (this.busRoutePolyline) this.busRoutePolyline.setLatLngs(this.busTrail);
    }
  }

  startLiveStreamPolling() {
    let consecutiveEmpty = 0;
    setInterval(async () => {
      try {
        const ts = Date.now();
        const res = await fetch(`${this.backendUrl}/stream/latest-frame?t=${ts}`);
        if (res.status === 200) {
          const blob = await res.blob();
          if (blob.size > 0) {
            const objectUrl = URL.createObjectURL(blob);
            if (this.liveStreamImg) {
              this.liveStreamImg.src = objectUrl;
              this.liveStreamImg.style.display = 'block';
            }
            if (this.streamPlaceholder) this.streamPlaceholder.style.display = 'none';
            if (this.streamOverlayBadge) this.streamOverlayBadge.style.display = 'block';
            consecutiveEmpty = 0;
          }
        } else {
          consecutiveEmpty++;
          if (consecutiveEmpty > 3) {
            if (this.liveStreamImg) this.liveStreamImg.style.display = 'none';
            if (this.streamPlaceholder) this.streamPlaceholder.style.display = 'flex';
            if (this.streamOverlayBadge) this.streamOverlayBadge.style.display = 'none';
          }
        }
      } catch (e) {}
    }, 1000);
  }

  handleIncomingEvent(payload) {
    if (!payload || !payload.type) return;

    if (payload.type === 'NEW_EVENT' && payload.data) {
      const evt = payload.data;
      this.events.unshift(evt);
      if (this.events.length > 50) this.events.pop();

      this.renderEventFeed();
      this.addEventMarkerToMap(evt);
      this.showToast(`New ${evt.event_type}: ${evt.event_id}`, 'warn');
      this.loadStats();
    } else if (payload.type === 'TELEMETRY' && payload.data) {
      this.updateBusTelemetryUI(payload.data);
    } else if (payload.type === 'WORK_ORDER_UPDATE') {
      this.loadWorkOrders();
    }
  }

  renderEventFeed() {
    if (!this.eventFeedScroll) return;

    let filtered = this.events;
    if (this.activeFeedFilter === 'POTHOLE') {
      filtered = this.events.filter(e => e.event_type === 'POTHOLE' || e.event_type === 'ROAD_DEFECT');
    } else if (this.activeFeedFilter === 'VEHICLE_COUNT') {
      filtered = this.events.filter(e => e.event_type === 'VEHICLE_COUNT' || e.event_type === 'TRAFFIC');
    } else if (this.activeFeedFilter === 'HIGH') {
      filtered = this.events.filter(e => e.severity === 'HIGH' || e.severity === 'CRITICAL');
    }

    if (filtered.length === 0) {
      this.eventFeedScroll.innerHTML = `
        <div class="empty-state">
          <p>Awaiting live detections from mobile camera stream...</p>
        </div>
      `;
      return;
    }

    this.eventFeedScroll.innerHTML = filtered.map(evt => {
      const isHigh = evt.severity === 'HIGH' || evt.severity === 'CRITICAL';
      const badgeCls = isHigh ? 'badge-red' : (evt.event_type === 'POTHOLE' ? 'badge-amber' : 'badge-blue');
      const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : 'Live';
      const coordsStr = (evt.latitude && evt.longitude) ? `${evt.latitude.toFixed(4)}, ${evt.longitude.toFixed(4)}` : 'GPS Ingesting';
      const thumb = evt.evidence_image_url ? `${this.backendUrl}${evt.evidence_image_url}` : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%23222"><rect width="36" height="36"/></svg>';

      return `
        <div class="event-card-item" onclick="window.gartikaApp.openEventModal('${evt.event_id}')">
          <div class="event-item-left">
            <img class="event-thumb" src="${thumb}" onerror="this.style.opacity=0.3" alt="Defect" />
            <div>
              <div class="event-title-line">
                <span class="badge ${badgeCls}">${evt.event_type}</span>
                <span>${intPercent(evt.confidence)}%</span>
              </div>
              <div class="event-sub-line font-mono">${coordsStr} • ${evt.bus_id || 'BUS-101'}</div>
            </div>
          </div>
          <div class="event-item-right font-mono text-muted" style="font-size: 0.68rem;">
            ${timeStr}
          </div>
        </div>
      `;
    }).join('');
  }

  renderEventMarkersOnMap() {
    this.events.forEach(evt => this.addEventMarkerToMap(evt));
  }

  addEventMarkerToMap(evt) {
    if (!this.map || !evt.latitude || !evt.longitude) return;
    if (this.eventMarkers[evt.event_id]) return;

    const isPothole = evt.event_type === 'POTHOLE' || evt.event_type === 'ROAD_DEFECT';
    const markerColor = isPothole ? '#ef4444' : '#f59e0b';
    
    const icon = L.divIcon({
      className: 'custom-event-icon',
      html: `<div class="marker-defect-dot" style="background: ${markerColor};"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([evt.latitude, evt.longitude], { icon }).addTo(this.map);
    marker.bindPopup(`
      <div style="font-size: 12px; padding: 4px;">
        <strong style="color: ${markerColor};">${evt.event_type}</strong> (${intPercent(evt.confidence)}%)<br>
        Severity: <strong>${evt.severity || 'MEDIUM'}</strong><br>
        <a href="javascript:void(0)" onclick="window.gartikaApp.openEventModal('${evt.event_id}')" style="color: #3b82f6; text-decoration: underline;">Inspect Details</a>
      </div>
    `);

    this.eventMarkers[evt.event_id] = marker;
  }

  renderWorkOrders(filterStatus = 'ALL') {
    if (!this.woItemsContainer) return;

    let list = this.workOrders;
    if (filterStatus !== 'ALL') {
      list = list.filter(w => w.status === filterStatus);
    }

    if (list.length === 0) {
      this.woItemsContainer.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 11l3 3L22 4"></path>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
          </svg>
          <p>No active work orders. Verified defects from your mobile stream can be dispatched here.</p>
        </div>
      `;
      return;
    }

    this.woItemsContainer.innerHTML = list.map(wo => {
      const isResolved = wo.status === 'RESOLVED';
      const badgeCls = isResolved ? 'badge-green' : (wo.priority === 'CRITICAL' ? 'badge-red' : 'badge-blue');

      return `
        <div class="wo-item-card">
          <div class="wo-item-left">
            <span class="badge ${badgeCls} font-mono">${wo.work_order_id}</span>
            <div>
              <div class="wo-item-title">${wo.title}</div>
              <div class="wo-item-meta font-mono">${wo.assigned_contractor || 'Municipal Works'} • ${wo.status}</div>
            </div>
          </div>
          <div class="wo-item-right">
            <select class="form-select" onchange="window.gartikaApp.updateWorkOrderStatus('${wo.work_order_id}', this.value)">
              <option value="OPEN" ${wo.status === 'OPEN' ? 'selected' : ''}>Open</option>
              <option value="ASSIGNED" ${wo.status === 'ASSIGNED' ? 'selected' : ''}>Assigned</option>
              <option value="IN PROGRESS" ${wo.status === 'IN PROGRESS' ? 'selected' : ''}>In Progress</option>
              <option value="RESOLVED" ${wo.status === 'RESOLVED' ? 'selected' : ''}>Resolved</option>
            </select>
          </div>
        </div>
      `;
    }).join('');
  }

  async updateWorkOrderStatus(woId, newStatus) {
    try {
      const res = await fetch(`${this.backendUrl}/work-orders/${woId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        this.showToast(`Updated ${woId} to ${newStatus}`, 'success');
        this.loadWorkOrders();
      }
    } catch (e) {
      this.showToast('Failed to update work order', 'warn');
    }
  }

  openEventModal(eventId) {
    const evt = this.events.find(e => e.event_id === eventId);
    if (!evt) return;

    this.selectedEvent = evt;
    if (this.modalEventTitle) this.modalEventTitle.innerText = `${evt.event_type} Hazard Inspection`;
    if (this.modalEventId) this.modalEventId.innerText = evt.event_id;
    if (this.modalEventType) this.modalEventType.innerText = evt.event_type;
    if (this.modalConfidence) this.modalConfidence.innerText = `${intPercent(evt.confidence)}%`;
    if (this.modalBusId) this.modalBusId.innerText = evt.bus_id || 'BUS-101';
    if (this.modalLocation) this.modalLocation.innerText = (evt.latitude && evt.longitude) ? `${evt.latitude.toFixed(5)}, ${evt.longitude.toFixed(5)}` : 'Awaiting GPS';
    if (this.modalTimestamp) this.modalTimestamp.innerText = evt.timestamp ? new Date(evt.timestamp).toLocaleString() : 'Just now';

    if (this.modalEvidenceImg) {
      if (evt.evidence_image_url) {
        this.modalEvidenceImg.src = `${this.backendUrl}${evt.evidence_image_url}`;
        this.modalEvidenceImg.style.display = 'block';
        if (this.modalEvidenceFallback) this.modalEvidenceFallback.style.display = 'none';
      } else {
        this.modalEvidenceImg.style.display = 'none';
        if (this.modalEvidenceFallback) this.modalEvidenceFallback.style.display = 'flex';
      }
    }

    if (this.eventModal) this.eventModal.classList.add('open');
  }

  closeEventModal() {
    if (this.eventModal) this.eventModal.classList.remove('open');
    this.selectedEvent = null;
  }

  async dispatchWorkOrderFromModal() {
    if (!this.selectedEvent) return;
    try {
      const res = await fetch(`${this.backendUrl}/work-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: this.selectedEvent.event_id,
          title: `Civic Repair: ${this.selectedEvent.event_type} (${intPercent(this.selectedEvent.confidence)}% Conf)`,
          priority: this.selectedEvent.severity || 'HIGH',
          assigned_contractor: 'BBMP Road Maintenance Crew'
        })
      });

      if (res.ok) {
        this.showToast('Repair work order dispatched successfully!', 'success');
        this.closeEventModal();
        this.loadWorkOrders();
      } else {
        this.showToast('Work order already exists for this event.', 'info');
        this.closeEventModal();
      }
    } catch (e) {
      this.showToast('Failed to dispatch work order', 'warn');
    }
  }

  openPhoneModal() {
    if (this.phoneModal) this.phoneModal.classList.add('open');
  }

  closePhoneModal() {
    if (this.phoneModal) this.phoneModal.classList.remove('open');
  }

  updateQrCode(url) {
    if (!this.qrCodeContainer) return;
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=4&data=${encodeURIComponent(url)}`;
    this.qrCodeContainer.innerHTML = `<img src="${qrUrl}" alt="QR Code" style="width:134px; height:134px;" />`;
  }

  centerOnBus() {
    if (this.busLocation && this.map) {
      this.map.setView(this.busLocation, 16);
      this.showToast('Centered on mobile sensor', 'info');
    } else {
      this.showToast('Awaiting GPS lock from mobile phone', 'warn');
    }
  }

  fitMapBounds() {
    if (!this.map) return;
    const coords = [];
    if (this.busLocation) coords.push(this.busLocation);
    this.events.forEach(e => {
      if (e.latitude && e.longitude) coords.push([e.latitude, e.longitude]);
    });

    if (coords.length > 0) {
      this.map.fitBounds(L.latLngBounds(coords), { padding: [40, 40] });
    }
  }
}

function intPercent(val) {
  if (!val) return 85;
  if (val <= 1.0) return Math.round(val * 100);
  return Math.round(val);
}

// Instantiate global app instance
document.addEventListener('DOMContentLoaded', () => {
  window.gartikaApp = new GartikaCommandCenter();
});
