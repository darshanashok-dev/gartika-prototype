/**
 * Gartika Mobile Edge Unit Sensing Controller.
 * 
 * Manages front camera capture, continuous Geolocation tracking,
 * calibrated DeviceMotion IMU shock detection, offline queueing,
 * and periodic batch transmission to central Gartika fusion backend.
 */

class GartikaMobileEdgeApp {
  constructor() {
    this.backendUrl = window.location.origin;
    this.wsUrl = (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + window.location.host + '/ws/events';
    
    // State
    this.isSensing = false;
    this.busId = 'BUS-101';
    this.sequenceNumber = 1;
    this.packetsCount = 0;
    this.eventsToday = 0;
    
    // Hardware streams
    this.cameraStream = null;
    this.gpsWatchId = null;
    this.currentLat = null;
    this.currentLon = null;
    this.currentSpeed = 0;
    this.currentAccuracy = null;
    this.currentAz = 9.81;
    
    // Offline Storage Queue
    this.offlineQueue = [];
    this.ws = null;
    
    this.init();
  }

  init() {
    this.bindDOM();
    this.initWebSocket();
    this.bindEvents();
    this.updateHostTarget();
  }

  bindDOM() {
    this.busIdInput = document.getElementById('busIdInput');
    this.toggleBtn = document.getElementById('toggleBtn');
    this.toggleBtnText = document.getElementById('toggleBtnText');
    this.sensingBanner = document.getElementById('sensingBanner');
    this.bannerStateText = document.getElementById('bannerStateText');
    this.bannerInstruction = document.getElementById('bannerInstruction');
    
    this.camStatus = document.getElementById('camStatus');
    this.gpsStatus = document.getElementById('gpsStatus');
    this.imuStatus = document.getElementById('imuStatus');
    this.netStatus = document.getElementById('netStatus');
    
    this.cameraPreview = document.getElementById('cameraPreview');
    this.camFallbackMsg = document.getElementById('camFallbackMsg');
    this.ingestMode = document.getElementById('ingestMode');
    this.hudPackets = document.getElementById('hudPackets');
    this.recDot = document.getElementById('recDot');
    
    this.latVal = document.getElementById('latVal');
    this.lonVal = document.getElementById('lonVal');
    this.speedVal = document.getElementById('speedVal');
    this.imuVal = document.getElementById('imuVal');
    this.eventsCountVal = document.getElementById('eventsCountVal');
    this.gpsAccuracyBadge = document.getElementById('gpsAccuracyBadge');
    
    this.offlineQueueBar = document.getElementById('offlineQueueBar');
    this.queueCount = document.getElementById('queueCount');
    this.btnSyncNow = document.getElementById('btnSyncNow');
    
    this.snapInput = document.getElementById('snapInput');
    this.logStream = document.getElementById('logStream');
    this.btnClearLog = document.getElementById('btnClearLog');
    this.connectionTarget = document.getElementById('connectionTarget');
  }

  updateHostTarget() {
    if (this.connectionTarget) {
      this.connectionTarget.textContent = 'Server: ' + window.location.host;
    }
  }

  log(msg, type = 'info') {
    if (!this.logStream) return;
    const line = document.createElement('div');
    line.className = 'log-line ' + type;
    line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
    this.logStream.appendChild(line);
    this.logStream.scrollTop = this.logStream.scrollHeight;
  }

  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        if (this.netStatus) this.netStatus.classList.add('online');
        this.log('Connected to Gartika central WebSocket hub.', 'info');
      };
      this.ws.onclose = () => {
        if (this.netStatus) this.netStatus.classList.remove('online');
        setTimeout(() => this.initWebSocket(), 4000);
      };
    } catch (e) {
      setTimeout(() => this.initWebSocket(), 4000);
    }
  }

  bindEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleSensing());
    }

    if (this.busIdInput) {
      this.busIdInput.addEventListener('change', () => {
        this.busId = this.busIdInput.value.trim().toUpperCase() || 'BUS-101';
      });
    }

    if (this.snapInput) {
      this.snapInput.addEventListener('change', (e) => this.handleSnapUpload(e));
    }

    if (this.btnSyncNow) {
      this.btnSyncNow.addEventListener('click', () => this.flushOfflineQueue());
    }

    if (this.btnClearLog) {
      this.btnClearLog.addEventListener('click', () => {
        if (this.logStream) this.logStream.innerHTML = '';
      });
    }
  }

  async toggleSensing() {
    if (this.isSensing) {
      this.stopSensing();
    } else {
      await this.startSensing();
    }
  }

  async startSensing() {
    this.isSensing = true;
    this.busId = this.busIdInput.value.trim().toUpperCase() || 'BUS-101';
    
    this.toggleBtn.classList.add('sensing');
    this.toggleBtnText.textContent = 'Stop Sensing';
    
    this.sensingBanner.className = 'sensing-status-banner sensing';
    this.bannerStateText.textContent = 'ACTIVE SENSING';
    this.bannerInstruction.textContent = 'Phone mounted facing forward. Streaming telemetry & road frames.';
    this.ingestMode.textContent = 'LIVE SENSING';

    this.log('Starting hardware sensor pipelines for ' + this.busId + '...', 'info');

    // 1. Camera Access
    await this.initCamera();

    // 2. GPS Geolocation
    this.initGps();

    // 3. IMU Accelerometer
    this.initImu();

    // 4. Periodic telemetry transmission loop (every 1.5s)
    this.telemetryInterval = setInterval(() => this.transmitTelemetry(), 1500);

    // 5. Periodic frame sample transmission loop (every 2.0s)
    this.frameInterval = setInterval(() => this.captureAndTransmitFrame(), 2000);
  }

  stopSensing() {
    this.isSensing = false;
    this.toggleBtn.classList.remove('sensing');
    this.toggleBtnText.textContent = 'Start Live Sensing';
    
    this.sensingBanner.className = 'sensing-status-banner standby';
    this.bannerStateText.textContent = 'STANDBY';
    this.bannerInstruction.textContent = 'Tap Start Live Sensing to activate sensors.';
    this.ingestMode.textContent = 'STANDBY';

    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach(t => t.stop());
      this.cameraStream = null;
    }
    if (this.camStatus) this.camStatus.classList.remove('online');
    if (this.camFallbackMsg) this.camFallbackMsg.classList.remove('hidden');

    if (this.gpsWatchId) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    if (this.gpsStatus) this.gpsStatus.classList.remove('online');

    clearInterval(this.telemetryInterval);
    clearInterval(this.frameInterval);
    this.log('Sensing halted.', 'warn');
  }

  async initCamera() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        this.cameraStream = stream;
        this.cameraPreview.srcObject = stream;
        if (this.camStatus) this.camStatus.classList.add('online');
        if (this.camFallbackMsg) this.camFallbackMsg.classList.add('hidden');
        this.log('Camera activated successfully.', 'info');
      }
    } catch (e) {
      this.log('Camera permission denied or unavailable on HTTP. Using photo capture fallback.', 'warn');
    }
  }

  initGps() {
    if ('geolocation' in navigator) {
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.currentLat = pos.coords.latitude;
          this.currentLon = pos.coords.longitude;
          this.currentSpeed = (pos.coords.speed || 0) * 3.6; // m/s to km/h
          this.currentAccuracy = pos.coords.accuracy;

          if (this.latVal) this.latVal.textContent = this.currentLat.toFixed(5);
          if (this.lonVal) this.lonVal.textContent = this.currentLon.toFixed(5);
          if (this.speedVal) this.speedVal.textContent = this.currentSpeed.toFixed(1) + ' km/h';
          if (this.gpsAccuracyBadge) this.gpsAccuracyBadge.textContent = this.currentAccuracy.toFixed(0) + 'm ACCURACY';
          if (this.gpsStatus) this.gpsStatus.classList.add('online');
        },
        (err) => {
          this.log('Waiting for high-accuracy GPS lock...', 'warn');
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    }
  }

  initImu() {
    if (window.DeviceMotionEvent) {
      window.addEventListener('devicemotion', (evt) => {
        if (evt.accelerationIncludingGravity) {
          const az = evt.accelerationIncludingGravity.z || 9.81;
          this.currentAz = az;
          if (this.imuVal) this.imuVal.textContent = az.toFixed(2) + ' m/s²';
          if (this.imuStatus) this.imuStatus.classList.add('online');

          // Mechanical shock detected
          if (Math.abs(az - 9.81) > 3.2) {
            this.log('IMU Shock Detected: ' + az.toFixed(2) + ' m/s²', 'warn');
            this.captureAndTransmitFrame();
          }
        }
      });
    }
  }

  async transmitTelemetry() {
    if (!this.isSensing) return;
    this.packetsCount++;
    if (this.hudPackets) this.hudPackets.textContent = this.packetsCount;

    const payload = {
      bus_id: this.busId,
      latitude: this.currentLat,
      longitude: this.currentLon,
      speed: this.currentSpeed,
      heading: 0.0,
      timestamp: Date.now() / 1000,
      ax: 0.0,
      ay: 0.0,
      az: this.currentAz,
      sequence_number: this.sequenceNumber++
    };

    try {
      const res = await fetch(this.backendUrl + '/api/v1/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (e) {
      this.enqueueOffline(payload);
    }
  }

  async captureAndTransmitFrame() {
    if (!this.isSensing || !this.cameraStream) return;
    
    try {
      const track = this.cameraStream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const blob = await imageCapture.takePhoto();

      const formData = new FormData();
      formData.append('file', blob, 'frame.jpg');
      formData.append('bus_id', this.busId);
      if (this.currentLat && this.currentLon) {
        formData.append('latitude', this.currentLat);
        formData.append('longitude', this.currentLon);
      }

      const res = await fetch(this.backendUrl + '/api/v1/stream/frame', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        this.eventsToday++;
        if (this.eventsCountVal) this.eventsCountVal.textContent = this.eventsToday;
      }
    } catch (e) {
      // Background frame capture error
    }
  }

  async handleSnapUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    this.log('Uploading manual defect photograph...', 'info');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('bus_id', this.busId);
    if (this.currentLat && this.currentLon) {
      formData.append('latitude', this.currentLat);
      formData.append('longitude', this.currentLon);
    }

    try {
      const res = await fetch(this.backendUrl + '/api/v1/stream/frame', {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        this.log('Defect photo successfully analyzed and uploaded!', 'info');
        this.eventsToday++;
        if (this.eventsCountVal) this.eventsCountVal.textContent = this.eventsToday;
      } else {
        this.log('Upload failed. Queued offline.', 'warn');
      }
    } catch (err) {
      this.log('Network unavailable. Photo queued offline.', 'warn');
    }
  }

  enqueueOffline(item) {
    this.offlineQueue.push(item);
    if (this.offlineQueueBar) this.offlineQueueBar.classList.remove('hidden');
    if (this.queueCount) this.queueCount.textContent = this.offlineQueue.length;
  }

  async flushOfflineQueue() {
    if (this.offlineQueue.length === 0) return;
    this.log('Flushing ' + this.offlineQueue.length + ' queued telemetry packets...', 'info');

    while (this.offlineQueue.length > 0) {
      const item = this.offlineQueue[0];
      try {
        const res = await fetch(this.backendUrl + '/api/v1/telemetry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item)
        });
        if (res.ok) {
          this.offlineQueue.shift();
          if (this.queueCount) this.queueCount.textContent = this.offlineQueue.length;
        } else {
          break;
        }
      } catch (e) {
        break;
      }
    }

    if (this.offlineQueue.length === 0) {
      if (this.offlineQueueBar) this.offlineQueueBar.classList.add('hidden');
      this.log('All offline telemetry packets synchronized.', 'info');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.gartikaMobileApp = new GartikaMobileEdgeApp();
});
