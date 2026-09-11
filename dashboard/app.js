/**
 * Gartika Enterprise Command Center & Urban Fleet Intelligence Client Engine.
 * 
 * Manages GIS mapping, real-time WebSocket telemetry & defect stream ingestion,
 * multi-modal sensor fusion visualization, work order dispatching, and data export.
 */

class GartikaDashboardApp {
  constructor() {
    this.backendUrl = window.location.origin;
    this.wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws/events';
    
    // Core State
    this.activePage = 'overview';
    this.stats = null;
    this.buses = [];
    this.defects = [];
    this.events = [];
    this.workOrders = [];
    this.selectedDefect = null;
    this.selectedBus = null;
    
    // GIS Maps & Layers
    this.miniMap = null;
    this.fullMap = null;
    this.miniMarkers = { buses: {}, defects: {} };
    this.fullMarkers = { buses: {}, defects: {}, workOrders: {} };
    this.busTrails = {};
    
    // WebSocket & Polling
    this.ws = null;
    this.wsReconnectTimer = null;
    this.reconnectAttempts = 0;
    this.notifications = [];
    
    // Settings
    this.authToken = localStorage.getItem('gartika_auth_token') || '';
    
    this.init();
  }

  async init() {
    this.bindDOM();
    this.initNavigation();
    this.initMaps();
    this.initWebSocket();
    this.bindGlobalEvents();
    
    // Load Initial Data
    await this.refreshAllData();
    this.renderSettingsQr();
    
    // Regular background synchronization
    setInterval(() => this.pollBackgroundData(), 5000);
  }

  bindDOM() {
    // Navigation & Shell
    this.sidebar = document.getElementById('mainSidebar');
    this.btnToggleSidebar = document.getElementById('btnToggleSidebar');
    this.topbarPageTitle = document.getElementById('topbarPageTitle');
    this.topbarPageSubtitle = document.getElementById('topbarPageSubtitle');
    this.globalSearchInput = document.getElementById('globalSearchInput');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    
    // Notification Drawer
    this.btnNotificationBell = document.getElementById('btnNotificationBell');
    this.notificationDrawer = document.getElementById('notificationDrawer');
    this.notificationCount = document.getElementById('notificationCount');
    this.notificationList = document.getElementById('notificationList');
    this.btnClearNotifications = document.getElementById('btnClearNotifications');
    
    // Toast Container
    this.toastContainer = document.getElementById('toastContainer');
    
    // KPI Elements
    this.kpiActiveBuses = document.getElementById('kpiActiveBuses');
    this.kpiTotalBuses = document.getElementById('kpiTotalBuses');
    this.kpiTotalDefects = document.getElementById('kpiTotalDefects');
    this.kpiPotholeCount = document.getElementById('kpiPotholeCount');
    this.kpiVerifiedDefects = document.getElementById('kpiVerifiedDefects');
    this.kpiVerificationRate = document.getElementById('kpiVerificationRate');
    this.kpiOpenWorkOrders = document.getElementById('kpiOpenWorkOrders');
    this.kpiResolvedWorkOrders = document.getElementById('kpiResolvedWorkOrders');
    
    // Nav Counter Pills
    this.navMapCount = document.getElementById('navMapCount');
    this.navDefectsCount = document.getElementById('navDefectsCount');
    this.navBusCount = document.getElementById('navBusCount');
    this.navWoCount = document.getElementById('navWoCount');
    
    // Feeds & Cameras
    this.overviewEventFeed = document.getElementById('overviewEventFeed');
    this.overviewCameraImg = document.getElementById('overviewCameraImg');
    this.overviewCameraPlaceholder = document.getElementById('overviewCameraPlaceholder');
    this.hudSpeedVal = document.getElementById('hudSpeedVal');
    this.hudCoordsVal = document.getElementById('hudCoordsVal');
    this.hudImuVal = document.getElementById('hudImuVal');
    
    // Tables & Grids
    this.defectsTableBody = document.getElementById('defectsTableBody');
    this.fleetGridContainer = document.getElementById('fleetGridContainer');
    this.workOrdersContainer = document.getElementById('workOrdersContainer');
    
    // Filters
    this.filterDefectType = document.getElementById('filterDefectType');
    this.filterDefectSeverity = document.getElementById('filterDefectSeverity');
    this.filterDefectStatus = document.getElementById('filterDefectStatus');
    this.filterDefectSearch = document.getElementById('filterDefectSearch');
    
    // Export Buttons
    this.btnExportCsv = document.getElementById('btnExportCsv');
    this.btnExportJson = document.getElementById('btnExportJson');
    
    // Drawers & Modals
    this.detailDrawer = document.getElementById('detailDrawer');
    this.detailDrawerOverlay = document.getElementById('detailDrawerOverlay');
    this.btnDrawerClose = document.getElementById('btnDrawerClose');
    this.drawerTitle = document.getElementById('drawerTitle');
    this.drawerTag = document.getElementById('drawerTag');
    this.drawerBody = document.getElementById('drawerBody');
    this.drawerFooter = document.getElementById('drawerFooter');
    
    this.createWoModal = document.getElementById('createWoModal');
    this.btnCloseWoModal = document.getElementById('btnCloseWoModal');
    this.btnCancelWoModal = document.getElementById('btnCancelWoModal');
    this.btnSubmitWoModal = document.getElementById('btnSubmitWoModal');
    this.woModalDefectId = document.getElementById('woModalDefectId');
    this.woModalPriority = document.getElementById('woModalPriority');
    this.woModalAssignee = document.getElementById('woModalAssignee');
    this.woModalNotes = document.getElementById('woModalNotes');
  }

  /* --------------------------------------------------------------------------
     Navigation & Routing Shell
     -------------------------------------------------------------------------- */
  initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const targetPage = item.getAttribute('data-page');
        if (targetPage) this.switchPage(targetPage);
      });
    });

    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => {
        this.sidebar.classList.toggle('collapsed');
      });
    }

    const btnOverviewExpandMap = document.getElementById('btnOverviewExpandMap');
    if (btnOverviewExpandMap) {
      btnOverviewExpandMap.addEventListener('click', () => this.switchPage('live-map'));
    }

    const btnSidebarConnectPhone = document.getElementById('btnSidebarConnectPhone');
    if (btnSidebarConnectPhone) {
      btnSidebarConnectPhone.addEventListener('click', () => this.switchPage('settings'));
    }

    const btnPairNewBus = document.getElementById('btnPairNewBus');
    if (btnPairNewBus) {
      btnPairNewBus.addEventListener('click', () => this.switchPage('settings'));
    }
  }

  switchPage(pageId) {
    this.activePage = pageId;

    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
      if (item.getAttribute('data-page') === pageId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Update active section
    document.querySelectorAll('.page-section').forEach(section => {
      section.classList.remove('active');
    });

    const targetSection = document.getElementById('page-' + pageId);
    if (targetSection) {
      targetSection.classList.add('active');
    }

    // Update header titles
    const titles = {
      'overview': ['Overview', 'Live Urban Intelligence & Sensing Network'],
      'live-map': ['Live GIS Map', 'Geographic Visualization of Fleet & Road Distress'],
      'defects': ['Road Defects', 'Spatially Deduplicated Surface Incidents'],
      'fleet': ['Fleet Sensing', 'Active Transit Vehicles Outfitted with Edge Units'],
      'work-orders': ['Work Orders', 'Closed-Loop Road Maintenance Dispatch & Auditing'],
      'analytics': ['Analytics & Audit', 'Edge Transmission & Sensor Corroboration Benchmarks'],
      'settings': ['Settings & Setup', 'Server Endpoints, Token Authentication & Mobile Pairing']
    };

    if (titles[pageId]) {
      this.topbarPageTitle.textContent = titles[pageId][0];
      this.topbarPageSubtitle.textContent = titles[pageId][1];
    }

    // Invalidate map size when switching to map view
    if (pageId === 'live-map' && this.fullMap) {
      setTimeout(() => {
        this.fullMap.invalidateSize();
        this.fitMapToFleet();
      }, 150);
    } else if (pageId === 'overview' && this.miniMap) {
      setTimeout(() => this.miniMap.invalidateSize(), 150);
    }
  }

  /* --------------------------------------------------------------------------
     GIS Map Initialization & Rendering
     -------------------------------------------------------------------------- */
  initMaps() {
    const defaultCenter = [12.9716, 77.5946];

    // 1. Overview Mini Map
    const miniMapEl = document.getElementById('overviewMiniMap');
    if (miniMapEl && typeof L !== 'undefined') {
      this.miniMap = L.map('overviewMiniMap', {
        center: defaultCenter,
        zoom: 13,
        zoomControl: false,
        attributionControl: false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
      }).addTo(this.miniMap);
    }

    // 2. Full GIS Map
    const fullMapEl = document.getElementById('fullGisMap');
    if (fullMapEl && typeof L !== 'undefined') {
      this.fullMap = L.map('fullGisMap', {
        center: defaultCenter,
        zoom: 14,
        zoomControl: true,
        attributionControl: true
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        attribution: '&copy; CartoDB &copy; OpenStreetMap contributors'
      }).addTo(this.fullMap);

      // Layer Toggles
      const layerBuses = document.getElementById('layerBuses');
      const layerDefects = document.getElementById('layerDefects');
      const layerWorkOrders = document.getElementById('layerWorkOrders');
      
      const toggleLayers = () => {
        const showB = layerBuses ? layerBuses.checked : true;
        const showD = layerDefects ? layerDefects.checked : true;
        const showW = layerWorkOrders ? layerWorkOrders.checked : true;

        Object.values(this.fullMarkers.buses).forEach(m => showB ? m.addTo(this.fullMap) : m.remove());
        Object.values(this.fullMarkers.defects).forEach(m => showD ? m.addTo(this.fullMap) : m.remove());
        Object.values(this.fullMarkers.workOrders).forEach(m => showW ? m.addTo(this.fullMap) : m.remove());
      };

      if (layerBuses) layerBuses.addEventListener('change', toggleLayers);
      if (layerDefects) layerDefects.addEventListener('change', toggleLayers);
      if (layerWorkOrders) layerWorkOrders.addEventListener('change', toggleLayers);

      const btnMapFitFleet = document.getElementById('btnMapFitFleet');
      if (btnMapFitFleet) {
        btnMapFitFleet.addEventListener('click', () => this.fitMapToFleet());
      }

      const btnMapRefresh = document.getElementById('btnMapRefresh');
      if (btnMapRefresh) {
        btnMapRefresh.addEventListener('click', () => {
          this.refreshAllData();
          this.showToast('Map data synchronized.', 'success');
        });
      }
    }
  }

  fitMapToFleet() {
    if (!this.fullMap) return;
    const latlngs = [];
    this.buses.forEach(b => {
      if (b.latitude && b.longitude) latlngs.push([b.latitude, b.longitude]);
    });
    this.defects.forEach(d => {
      if (d.latitude && d.longitude) latlngs.push([d.latitude, d.longitude]);
    });
    if (latlngs.length > 0) {
      this.fullMap.fitBounds(latlngs, { padding: [40, 40], maxZoom: 16 });
    }
  }

  updateMapMarkers() {
    if (typeof L === 'undefined') return;

    // 1. Update Bus Markers
    this.buses.forEach(bus => {
      if (!bus.latitude || !bus.longitude) return;

      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: '<div style="background:#0284c7; border:2px solid #38bdf8; color:#fff; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:10px; font-weight:800; box-shadow:0 0 10px rgba(56,189,248,0.6);">BUS</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      // Full Map
      if (this.fullMap) {
        if (!this.fullMarkers.buses[bus.bus_id]) {
          const marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon }).addTo(this.fullMap);
          marker.on('click', () => this.openBusDrawer(bus));
          this.fullMarkers.buses[bus.bus_id] = marker;
        } else {
          this.fullMarkers.buses[bus.bus_id].setLatLng([bus.latitude, bus.longitude]);
        }
      }

      // Mini Map
      if (this.miniMap) {
        if (!this.miniMarkers.buses[bus.bus_id]) {
          const marker = L.marker([bus.latitude, bus.longitude], { icon: busIcon }).addTo(this.miniMap);
          this.miniMarkers.buses[bus.bus_id] = marker;
        } else {
          this.miniMarkers.buses[bus.bus_id].setLatLng([bus.latitude, bus.longitude]);
        }
      }
    });

    // 2. Update Defect Markers
    this.defects.forEach(defect => {
      if (!defect.latitude || !defect.longitude) return;

      let color = '#f59e0b';
      if (defect.severity === 'CRITICAL') color = '#f43f5e';
      else if (defect.severity === 'HIGH') color = '#fb7185';
      else if (defect.status === 'CLOSED' || defect.repair_status === 'REPAIR_VERIFIED') color = '#10b981';

      const defectIcon = L.divIcon({
        className: 'custom-defect-marker',
        html: '<div style="background:' + color + '; border:2px solid #fff; width:18px; height:18px; border-radius:50%; box-shadow:0 0 8px ' + color + ';"></div>',
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      if (this.fullMap) {
        if (!this.fullMarkers.defects[defect.defect_id]) {
          const marker = L.marker([defect.latitude, defect.longitude], { icon: defectIcon }).addTo(this.fullMap);
          marker.on('click', () => this.openDefectDrawer(defect));
          this.fullMarkers.defects[defect.defect_id] = marker;
        } else {
          this.fullMarkers.defects[defect.defect_id].setLatLng([defect.latitude, defect.longitude]);
        }
      }

      if (this.miniMap) {
        if (!this.miniMarkers.defects[defect.defect_id]) {
          const marker = L.marker([defect.latitude, defect.longitude], { icon: defectIcon }).addTo(this.miniMap);
          this.miniMarkers.defects[defect.defect_id] = marker;
        } else {
          this.miniMarkers.defects[defect.defect_id].setLatLng([defect.latitude, defect.longitude]);
        }
      }
    });
  }

  /* --------------------------------------------------------------------------
     REST API Operations
     -------------------------------------------------------------------------- */
  async apiRequest(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (this.authToken) {
      headers['X-API-Key'] = this.authToken;
      headers['Authorization'] = 'Bearer ' + this.authToken;
    }
    try {
      const res = await fetch(this.backendUrl + endpoint, { ...options, headers });
      if (!res.ok) throw new Error('HTTP ' + res.status + ': ' + res.statusText);
      return await res.json();
    } catch (err) {
      console.warn('[API] ' + endpoint + ' failed:', err);
      return null;
    }
  }

  async refreshAllData() {
    await Promise.all([
      this.fetchStats(),
      this.fetchBuses(),
      this.fetchDefects(),
      this.fetchEvents(),
      this.fetchWorkOrders()
    ]);
    this.updateMapMarkers();
  }

  async pollBackgroundData() {
    await Promise.all([
      this.fetchStats(),
      this.fetchBuses(),
      this.fetchDefects()
    ]);
    this.updateMapMarkers();
  }

  async fetchStats() {
    const data = await this.apiRequest('/api/v1/stats') || await this.apiRequest('/stats');
    if (!data) return;
    this.stats = data;

    const totalDefects = data.total_defects || 0;
    const verifiedDefects = data.verified_defects || 0;
    const activeBuses = data.active_buses || 0;
    const totalBuses = data.total_buses || activeBuses;
    const openWos = data.open_work_orders || 0;

    if (this.kpiActiveBuses) this.kpiActiveBuses.textContent = activeBuses;
    if (this.kpiTotalBuses) this.kpiTotalBuses.textContent = '/ ' + totalBuses + ' Total';
    if (this.kpiTotalDefects) this.kpiTotalDefects.textContent = totalDefects;
    if (this.kpiVerifiedDefects) this.kpiVerifiedDefects.textContent = verifiedDefects;
    if (this.kpiOpenWorkOrders) this.kpiOpenWorkOrders.textContent = openWos;

    if (this.kpiVerificationRate) {
      const rate = totalDefects > 0 ? Math.round((verifiedDefects / totalDefects) * 100) : 90;
      this.kpiVerificationRate.textContent = rate + '%';
    }
  }

  async fetchBuses() {
    const data = await this.apiRequest('/api/v1/buses') || await this.apiRequest('/buses');
    if (!data || !Array.isArray(data)) return;
    this.buses = data;
    if (this.navBusCount) this.navBusCount.textContent = data.length;
    this.renderFleetGrid();
    
    if (data.length > 0) {
      const b = data[0];
      if (this.hudSpeedVal) this.hudSpeedVal.textContent = (b.speed || 0).toFixed(1) + ' km/h';
      if (this.hudCoordsVal) {
        this.hudCoordsVal.textContent = (b.latitude && b.longitude) 
          ? b.latitude.toFixed(4) + ', ' + b.longitude.toFixed(4) 
          : 'NO GPS LOCK';
      }
    }
  }

  async fetchDefects() {
    const data = await this.apiRequest('/api/v1/defects') || await this.apiRequest('/defects');
    if (!data || !Array.isArray(data)) return;
    this.defects = data;
    if (this.navDefectsCount) this.navDefectsCount.textContent = data.length;
    if (this.navMapCount) this.navMapCount.textContent = data.length;
    if (this.kpiPotholeCount) {
      const potholes = data.filter(d => d.defect_type === 'POTHOLE').length;
      this.kpiPotholeCount.textContent = potholes + ' Potholes';
    }
    this.renderDefectsTable();
  }

  async fetchEvents() {
    const data = await this.apiRequest('/api/v1/events?limit=25') || await this.apiRequest('/events?limit=25');
    if (!data || !Array.isArray(data)) return;
    this.events = data;
    this.renderOverviewEventFeed();
  }

  async fetchWorkOrders() {
    const data = await this.apiRequest('/api/v1/work-orders') || await this.apiRequest('/work-orders');
    if (!data || !Array.isArray(data)) return;
    this.workOrders = data;
    if (this.navWoCount) this.navWoCount.textContent = data.length;
    if (this.kpiResolvedWorkOrders) {
      const resolved = data.filter(w => w.status === 'RESOLVED').length;
      this.kpiResolvedWorkOrders.textContent = resolved + ' Resolved';
    }
    this.renderWorkOrders();
  }

  /* --------------------------------------------------------------------------
     WebSocket Real-Time Gateway
     -------------------------------------------------------------------------- */
  initWebSocket() {
    try {
      const wsUri = this.authToken ? this.wsUrl + '?token=' + encodeURIComponent(this.authToken) : this.wsUrl;
      this.ws = new WebSocket(wsUri);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.statusDot.className = 'status-dot live';
        this.statusText.textContent = 'CONNECTED';
      };

      this.ws.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          this.handleRealTimeEvent(data);
        } catch (e) {
          // Heartbeat ping/pong
        }
      };

      this.ws.onclose = () => {
        this.statusDot.className = 'status-dot';
        this.statusText.textContent = 'RECONNECTING...';
        this.scheduleWsReconnect();
      };

      this.ws.onerror = () => {
        this.ws.close();
      };
    } catch (e) {
      this.scheduleWsReconnect();
    }
  }

  scheduleWsReconnect() {
    if (this.wsReconnectTimer) clearTimeout(this.wsReconnectTimer);
    const delay = Math.min(10000, 1500 * Math.pow(1.5, this.reconnectAttempts++));
    this.wsReconnectTimer = setTimeout(() => this.initWebSocket(), delay);
  }

  handleRealTimeEvent(evt) {
    if (!evt) return;

    if (evt.type === 'DEFECT_DETECTED' || evt.event_type || evt.defect_id) {
      this.events.unshift({
        id: evt.id || Date.now(),
        event_type: evt.event_type || 'POTHOLE',
        severity: evt.severity || 'HIGH',
        bus_id: evt.bus_id || 'BUS-101',
        confidence: evt.confidence || evt.final_confidence || 0.88,
        latitude: evt.latitude,
        longitude: evt.longitude,
        timestamp: new Date().toISOString()
      });
      if (this.events.length > 50) this.events.pop();
      this.renderOverviewEventFeed();
      this.fetchStats();
      this.fetchDefects();

      if (evt.severity === 'CRITICAL' || evt.severity === 'HIGH') {
        this.addNotification({
          title: 'High-Severity Defect: ' + (evt.event_type || 'POTHOLE'),
          desc: 'Reported by ' + (evt.bus_id || 'BUS-101') + ' (Confidence: ' + Math.round((evt.confidence || 0.88)*100) + '%)',
          level: evt.severity === 'CRITICAL' ? 'critical' : 'warning'
        });
      }
    } else if (evt.type === 'FRAME_PREVIEW' && evt.image_base64) {
      if (this.overviewCameraImg) {
        this.overviewCameraImg.src = 'data:image/jpeg;base64,' + evt.image_base64;
        this.overviewCameraImg.classList.remove('hidden');
        if (this.overviewCameraPlaceholder) this.overviewCameraPlaceholder.classList.add('hidden');
      }
    }
  }

  addNotification(notif) {
    this.notifications.unshift({ ...notif, time: new Date() });
    if (this.notifications.length > 20) this.notifications.pop();
    this.renderNotifications();
  }

  renderNotifications() {
    if (!this.notificationList || !this.notificationCount) return;
    this.notificationCount.textContent = this.notifications.length;
    if (this.notifications.length === 0) {
      this.notificationList.innerHTML = '<div class="notification-empty">No active critical alerts. Sensing network healthy.</div>';
      return;
    }
    this.notificationList.innerHTML = this.notifications.map(n => 
      '<div class="notif-item ' + (n.level || 'warning') + '">' +
        '<div class="font-semibold text-slate-100">' + n.title + '</div>' +
        '<div class="text-slate-400 text-xs">' + n.desc + '</div>' +
      '</div>'
    ).join('');
  }

  /* --------------------------------------------------------------------------
     DOM Renderers: Feed, Defects, Fleet, Work Orders
     -------------------------------------------------------------------------- */
  renderOverviewEventFeed() {
    if (!this.overviewEventFeed) return;
    if (this.events.length === 0) {
      this.overviewEventFeed.innerHTML = '<div class="loading-state-clean"><span>No recent events. Ready to sense roadway.</span></div>';
      return;
    }

    this.overviewEventFeed.innerHTML = this.events.slice(0, 15).map(evt => {
      let dotClass = 'pothole';
      if (evt.event_type === 'TELEMETRY') dotClass = 'telemetry';
      else if (evt.event_type === 'MULTI_BUS_VERIFIED') dotClass = 'corroborated';
      else if (evt.event_type === 'REPAIR_VERIFIED') dotClass = 'repair';

      const confPct = Math.round((evt.confidence || 0.85) * 100);
      const timeStr = new Date(evt.timestamp).toLocaleTimeString();

      return '<div class="event-feed-item">' +
        '<span class="event-dot ' + dotClass + '"></span>' +
        '<div class="event-details">' +
          '<div class="event-title-row">' +
            '<span class="event-title">' + (evt.event_type || 'ROAD HAZARD') + '</span>' +
            '<span class="event-time font-mono">' + timeStr + '</span>' +
          '</div>' +
          '<div class="event-meta">' +
            '<span class="text-slate-300 font-mono">' + (evt.bus_id || 'BUS-101') + '</span> &bull; ' +
            '<span class="text-blue-400 font-mono">' + confPct + '% Conf</span> &bull; ' +
            '<span class="badge-sev ' + ((evt.severity || 'HIGH').toLowerCase()) + '">' + (evt.severity || 'HIGH') + '</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  renderDefectsTable() {
    if (!this.defectsTableBody) return;
    
    const typeF = this.filterDefectType ? this.filterDefectType.value : 'ALL';
    const sevF = this.filterDefectSeverity ? this.filterDefectSeverity.value : 'ALL';
    const statusF = this.filterDefectStatus ? this.filterDefectStatus.value : 'ALL';
    const searchF = this.filterDefectSearch ? this.filterDefectSearch.value.trim().toLowerCase() : '';

    const filtered = this.defects.filter(d => {
      if (typeF !== 'ALL' && d.defect_type !== typeF) return false;
      if (sevF !== 'ALL' && d.severity !== sevF) return false;
      if (statusF !== 'ALL' && d.status !== statusF && d.repair_status !== statusF) return false;
      if (searchF) {
        const text = (d.defect_id + ' ' + (d.location_name || '') + ' ' + (d.verifying_buses || '')).toLowerCase();
        if (!text.includes(searchF)) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      this.defectsTableBody.innerHTML = '<tr><td colspan="10" class="text-center text-slate-400 py-6">No road defects match the selected filters.</td></tr>';
      return;
    }

    this.defectsTableBody.innerHTML = filtered.map(d => {
      const confPct = Math.round((d.best_confidence || 0.85) * 100);
      const sevClass = (d.severity || 'HIGH').toLowerCase();
      
      let statusBadge = '<span class="badge-status suspected">SUSPECTED</span>';
      if (d.status === 'CLOSED' || d.repair_status === 'REPAIR_VERIFIED') {
        statusBadge = '<span class="badge-status verified">VERIFIED REPAIRED</span>';
      } else if (d.status === 'MULTI_BUS_VERIFIED') {
        statusBadge = '<span class="badge-status verified">MULTI-BUS VERIFIED</span>';
      } else if (d.status === 'SENSOR_FUSED') {
        statusBadge = '<span class="badge-status fused">SENSOR FUSED</span>';
      } else if (d.status === 'DETECTED') {
        statusBadge = '<span class="badge-status detected">DETECTED</span>';
      } else if (d.status === 'REPAIR_FAILED') {
        statusBadge = '<span class="badge-status failed">REPAIR FAILED</span>';
      }

      const coords = (d.latitude && d.longitude) ? d.latitude.toFixed(4) + ', ' + d.longitude.toFixed(4) : '<span class="text-amber-400">NO GPS LOCK</span>';
      const lastSeen = d.last_seen ? new Date(d.last_seen).toLocaleTimeString() : '--';

      return '<tr data-defect-id="' + d.defect_id + '">' +
        '<td class="font-mono font-bold text-slate-100">' + d.defect_id + '</td>' +
        '<td><span class="font-semibold text-slate-200">' + d.defect_type + '</span></td>' +
        '<td><span class="badge-sev ' + sevClass + '">' + d.severity + '</span></td>' +
        '<td><span class="font-mono font-bold text-blue-400">' + confPct + '%</span></td>' +
        '<td class="font-mono text-xs">' + coords + '</td>' +
        '<td class="font-mono text-center">' + (d.observation_count || 1) + '</td>' +
        '<td class="font-mono text-xs text-slate-300">' + (d.unique_bus_count || 1) + ' Units</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td class="font-mono text-xs text-slate-400">' + lastSeen + '</td>' +
        '<td class="text-right">' +
          '<button class="btn-xs btn-secondary btn-view-defect" data-defect-id="' + d.defect_id + '">Details</button>' +
        '</td>' +
      '</tr>';
    }).join('');

    this.defectsTableBody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.getAttribute('data-defect-id');
        const defect = this.defects.find(x => x.defect_id === id);
        if (defect) this.openDefectDrawer(defect);
      });
    });
  }

  renderFleetGrid() {
    if (!this.fleetGridContainer) return;
    if (this.buses.length === 0) {
      this.fleetGridContainer.innerHTML = '<div class="loading-state-clean"><span>No transit units registered yet. Connect mobile phone to pair.</span></div>';
      return;
    }

    this.fleetGridContainer.innerHTML = this.buses.map(b => {
      const isOnline = b.status === 'ACTIVE';
      const speed = (b.speed || 0).toFixed(1);
      const coords = (b.latitude && b.longitude) ? b.latitude.toFixed(4) + ', ' + b.longitude.toFixed(4) : 'UNKNOWN LOCATION';
      const lastSeen = b.last_seen ? new Date(b.last_seen).toLocaleTimeString() : 'Just now';

      return '<div class="fleet-card" data-bus-id="' + b.bus_id + '">' +
        '<div class="fleet-card-header">' +
          '<span class="fleet-bus-title font-mono">' + b.bus_id + '</span>' +
          '<span class="badge-status ' + (isOnline ? 'verified' : 'suspected') + '">' + (b.status || 'ACTIVE') + '</span>' +
        '</div>' +
        '<div class="grid grid-cols-2 gap-2 text-xs">' +
          '<div><span class="text-slate-400">Speed:</span> <span class="font-mono text-slate-100">' + speed + ' km/h</span></div>' +
          '<div><span class="text-slate-400">Last Ping:</span> <span class="font-mono text-slate-100">' + lastSeen + '</span></div>' +
        '</div>' +
        '<div class="text-xs text-slate-400">' +
          '<span>GPS:</span> <span class="font-mono text-slate-200">' + coords + '</span>' +
        '</div>' +
        '<div class="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">' +
          '<span class="text-slate-400">Hardware Sensors:</span>' +
          '<div class="flex gap-1 font-mono text-[10px]">' +
            '<span class="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">CAM</span>' +
            '<span class="px-1.5 py-0.5 rounded bg-blue-950 text-blue-400 border border-blue-800">IMU</span>' +
            '<span class="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-800">GPS</span>' +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    this.fleetGridContainer.querySelectorAll('.fleet-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-bus-id');
        const bus = this.buses.find(x => x.bus_id === id);
        if (bus) this.openBusDrawer(bus);
      });
    });
  }

  renderWorkOrders() {
    if (!this.workOrdersContainer) return;
    if (this.workOrders.length === 0) {
      this.workOrdersContainer.innerHTML = '<div class="loading-state-clean"><span>No active municipal work orders. All road distress repaired.</span></div>';
      return;
    }

    this.workOrdersContainer.innerHTML = this.workOrders.map(wo => {
      const isResolved = wo.status === 'RESOLVED';
      return '<div class="card flex flex-col gap-3">' +
        '<div class="flex items-center justify-between">' +
          '<span class="font-mono font-bold text-indigo-400">' + wo.work_order_id + '</span>' +
          '<span class="badge-status ' + (isResolved ? 'verified' : 'repair') + '">' + wo.status + '</span>' +
        '</div>' +
        '<div class="text-xs text-slate-300">' +
          '<div><span class="text-slate-400">Linked Defect:</span> <span class="font-mono text-slate-100">' + (wo.defect_id || 'N/A') + '</span></div>' +
          '<div><span class="text-slate-400">Assigned Crew:</span> <span class="text-slate-100">' + (wo.assigned_contractor || 'Municipal Dispatch') + '</span></div>' +
          '<div><span class="text-slate-400">Priority:</span> <span class="badge-sev ' + ((wo.priority || 'HIGH').toLowerCase()) + '">' + wo.priority + '</span></div>' +
        '</div>' +
        '<div class="text-xs text-slate-400">' +
          (wo.description || 'Rapid pothole asphalt repair required.') +
        '</div>' +
      '</div>';
    }).join('');
  }

  /* --------------------------------------------------------------------------
     Slide-Over Detail Drawer & Modals
     -------------------------------------------------------------------------- */
  openDefectDrawer(d) {
    this.selectedDefect = d;
    this.drawerTag.textContent = 'ROAD DEFECT DETAILS';
    this.drawerTitle.textContent = d.defect_id;

    const confPct = Math.round((d.best_confidence || 0.85) * 100);
    const coords = (d.latitude && d.longitude) ? d.latitude.toFixed(5) + ', ' + d.longitude.toFixed(5) : 'UNKNOWN LOCATION';
    const evidenceUrl = d.latest_evidence_path ? this.backendUrl + '/' + d.latest_evidence_path.replace(/^\//, '') : null;

    this.drawerBody.innerHTML = '' +
      '<div class="flex items-center justify-between p-3 rounded-lg bg-slate-900 border border-slate-800">' +
        '<div>' +
          '<span class="text-xs text-slate-400">Type & Severity</span>' +
          '<div class="font-bold text-base text-slate-100">' + d.defect_type + ' &bull; <span class="badge-sev ' + ((d.severity||'HIGH').toLowerCase()) + '">' + d.severity + '</span></div>' +
        '</div>' +
        '<div class="text-right">' +
          '<span class="text-xs text-slate-400">Composite Confidence</span>' +
          '<div class="font-mono font-extrabold text-lg text-blue-400">' + confPct + '%</div>' +
        '</div>' +
      '</div>' +
      '<div class="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-2">' +
        '<span class="text-xs font-bold text-slate-300 tracking-wider">CONFIDENCE BREAKDOWN</span>' +
        '<div class="grid grid-cols-2 gap-2 text-xs font-mono">' +
          '<div><span class="text-slate-400">Vision Model:</span> <span class="text-slate-200">' + (d.model_confidence ? (d.model_confidence*100).toFixed(0)+'%' : 'N/A (Heuristic)') + '</span></div>' +
          '<div><span class="text-slate-400">IMU Shock Score:</span> <span class="text-slate-200">' + (d.imu_score ? (d.imu_score*100).toFixed(0)+'%' : '90%') + '</span></div>' +
          '<div><span class="text-slate-400">Fusion Score:</span> <span class="text-slate-200">' + (d.fusion_score ? (d.fusion_score*100).toFixed(0)+'%' : confPct+'%') + '</span></div>' +
          '<div><span class="text-slate-400">Corroboration:</span> <span class="text-emerald-400">' + (d.unique_bus_count || 1) + ' Buses</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="flex flex-col gap-2">' +
        '<span class="text-xs font-bold text-slate-300">ANONYMIZED EVIDENCE PHOTO</span>' +
        '<div class="w-full h-44 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center">' +
          (evidenceUrl 
            ? '<img src="' + evidenceUrl + '" class="w-full h-full object-cover" alt="Evidence" onerror="this.parentElement.innerHTML='<span class=text-slate-500>Evidence thumbnail preview</span>'" />' 
            : '<span class="text-slate-500 text-xs font-mono">No cropped frame attached</span>') +
        '</div>' +
      '</div>' +
      '<div class="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex flex-col gap-1">' +
        '<span class="font-bold text-slate-300">GNSS TELEMETRY</span>' +
        '<div class="font-mono text-slate-200">' + coords + '</div>' +
        '<div class="text-slate-400">' + (d.location_name || 'Urban transit corridor') + '</div>' +
      '</div>';

    this.drawerFooter.innerHTML = '' +
      '<button class="btn btn-primary flex-1" id="btnDrawerDispatchWo">' +
        '<span>Dispatch Work Order</span>' +
      '</button>';

    document.getElementById('btnDrawerDispatchWo').addEventListener('click', () => {
      this.closeDrawer();
      this.openCreateWoModal(d.defect_id);
    });

    this.showDrawer();
  }

  openBusDrawer(bus) {
    this.selectedBus = bus;
    this.drawerTag.textContent = 'FLEET UNIT TELEMETRY';
    this.drawerTitle.textContent = bus.bus_id;

    this.drawerBody.innerHTML = '' +
      '<div class="p-4 rounded-lg bg-slate-900 border border-slate-800 flex flex-col gap-3">' +
        '<div class="flex justify-between items-center">' +
          '<span class="text-xs text-slate-400">Status:</span>' +
          '<span class="badge-status verified">' + (bus.status || 'ACTIVE') + '</span>' +
        '</div>' +
        '<div class="flex justify-between items-center">' +
          '<span class="text-xs text-slate-400">Current Speed:</span>' +
          '<span class="font-mono font-bold text-slate-100">' + (bus.speed || 0).toFixed(1) + ' km/h</span>' +
        '</div>' +
        '<div class="flex justify-between items-center">' +
          '<span class="text-xs text-slate-400">GNSS Lock:</span>' +
          '<span class="font-mono text-slate-200">' + (bus.latitude ? bus.latitude.toFixed(5)+', '+bus.longitude.toFixed(5) : 'SEARCHING...') + '</span>' +
        '</div>' +
      '</div>';

    this.drawerFooter.innerHTML = '' +
      '<button class="btn btn-secondary flex-1" id="btnDrawerCloseBus">Close</button>';
    document.getElementById('btnDrawerCloseBus').addEventListener('click', () => this.closeDrawer());

    this.showDrawer();
  }

  showDrawer() {
    this.detailDrawer.classList.remove('hidden');
    this.detailDrawerOverlay.classList.remove('hidden');
  }

  closeDrawer() {
    this.detailDrawer.classList.add('hidden');
    this.detailDrawerOverlay.classList.add('hidden');
  }

  /* --------------------------------------------------------------------------
     Work Order Dispatching
     -------------------------------------------------------------------------- */
  openCreateWoModal(defectId) {
    if (this.woModalDefectId) this.woModalDefectId.value = defectId || '';
    if (this.createWoModal) this.createWoModal.classList.remove('hidden');
  }

  closeCreateWoModal() {
    if (this.createWoModal) this.createWoModal.classList.add('hidden');
  }

  async submitWorkOrder() {
    const defectId = this.woModalDefectId.value;
    const priority = this.woModalPriority.value;
    const assignee = this.woModalAssignee.value;
    const notes = this.woModalNotes.value;

    const payload = {
      defect_id: defectId,
      priority: priority,
      assigned_contractor: assignee,
      description: notes
    };

    const res = await this.apiRequest('/api/v1/work-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    }) || await this.apiRequest('/work-orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    this.closeCreateWoModal();
    if (res) {
      this.showToast('Work order dispatched for ' + defectId + '!', 'success');
      this.fetchWorkOrders();
      this.fetchDefects();
    } else {
      this.showToast('Failed to dispatch work order.', 'error');
    }
  }

  /* --------------------------------------------------------------------------
     Export CSV / JSON
     -------------------------------------------------------------------------- */
  exportData(format = 'csv') {
    if (this.defects.length === 0) {
      this.showToast('No road defects available to export.', 'info');
      return;
    }

    if (format === 'json') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(this.defects, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', 'gartika_defects_' + Date.now() + '.json');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Exported defects as JSON.', 'success');
    } else {
      const headers = ['defect_id', 'defect_type', 'severity', 'best_confidence', 'latitude', 'longitude', 'status', 'observation_count', 'last_seen'];
      const rows = this.defects.map(d => [
        d.defect_id,
        d.defect_type,
        d.severity,
        d.best_confidence,
        d.latitude,
        d.longitude,
        d.status,
        d.observation_count,
        d.last_seen
      ].join(','));
      const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent([headers.join(','), ...rows].join('
'));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', csvContent);
      downloadAnchor.setAttribute('download', 'gartika_defects_' + Date.now() + '.csv');
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      this.showToast('Exported defects as CSV.', 'success');
    }
  }

  /* --------------------------------------------------------------------------
     Global Event Binders & Phone Pairing QR
     -------------------------------------------------------------------------- */
  bindGlobalEvents() {
    if (this.btnDrawerClose) this.btnDrawerClose.addEventListener('click', () => this.closeDrawer());
    if (this.detailDrawerOverlay) this.detailDrawerOverlay.addEventListener('click', () => this.closeDrawer());
    
    if (this.btnCloseWoModal) this.btnCloseWoModal.addEventListener('click', () => this.closeCreateWoModal());
    if (this.btnCancelWoModal) this.btnCancelWoModal.addEventListener('click', () => this.closeCreateWoModal());
    if (this.btnSubmitWoModal) this.btnSubmitWoModal.addEventListener('click', (e) => {
      e.preventDefault();
      this.submitWorkOrder();
    });

    const btnNewWorkOrderModal = document.getElementById('btnNewWorkOrderModal');
    if (btnNewWorkOrderModal) {
      btnNewWorkOrderModal.addEventListener('click', () => this.openCreateWoModal(''));
    }

    if (this.btnNotificationBell) {
      this.btnNotificationBell.addEventListener('click', () => {
        this.notificationDrawer.classList.toggle('hidden');
      });
    }

    if (this.btnClearNotifications) {
      this.btnClearNotifications.addEventListener('click', () => {
        this.notifications = [];
        this.renderNotifications();
      });
    }

    if (this.btnExportCsv) this.btnExportCsv.addEventListener('click', () => this.exportData('csv'));
    if (this.btnExportJson) this.btnExportJson.addEventListener('click', () => this.exportData('json'));

    ['filterDefectType', 'filterDefectSeverity', 'filterDefectStatus'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', () => this.renderDefectsTable());
    });
    if (this.filterDefectSearch) {
      this.filterDefectSearch.addEventListener('input', () => this.renderDefectsTable());
    }

    // Global Search Omnibox
    if (this.globalSearchInput) {
      this.globalSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const query = this.globalSearchInput.value.trim().toUpperCase();
          if (query.startsWith('BUS-')) {
            this.switchPage('fleet');
          } else if (query.startsWith('DEF-')) {
            this.switchPage('defects');
            if (this.filterDefectSearch) this.filterDefectSearch.value = query;
            this.renderDefectsTable();
          } else if (query.startsWith('WO-')) {
            this.switchPage('work-orders');
          } else {
            this.switchPage('defects');
            if (this.filterDefectSearch) this.filterDefectSearch.value = query;
            this.renderDefectsTable();
          }
        }
      });

      window.addEventListener('keydown', (e) => {
        if (e.key === '/' && document.activeElement !== this.globalSearchInput) {
          e.preventDefault();
          this.globalSearchInput.focus();
        }
      });
    }

    // Settings Save
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', () => {
        const tokenInput = document.getElementById('settingAuthToken');
        if (tokenInput) {
          this.authToken = tokenInput.value.trim();
          localStorage.setItem('gartika_auth_token', this.authToken);
          this.showToast('Settings saved. Reconnecting...', 'success');
          this.initWebSocket();
        }
      });
    }
  }

  renderSettingsQr() {
    const mobileLink = window.location.origin + '/mobile';
    const settingsMobileLink = document.getElementById('settingsMobileLink');
    if (settingsMobileLink) {
      settingsMobileLink.href = mobileLink;
      settingsMobileLink.textContent = mobileLink;
    }

    const qrBox = document.getElementById('settingsQrBox');
    if (qrBox && typeof qrcode !== 'undefined') {
      try {
        const qr = qrcode(0, 'M');
        qr.addData(mobileLink);
        qr.make();
        qrBox.innerHTML = qr.createImgTag(5, 10);
      } catch (e) {
        qrBox.innerHTML = '<span class="text-xs text-slate-500">Scan QR from mobile device</span>';
      }
    }
  }

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = '<span>' + message + '</span>';
    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 250);
    }, 3500);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.gartikaApp = new GartikaDashboardApp();
});
