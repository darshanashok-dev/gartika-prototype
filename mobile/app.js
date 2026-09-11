/**
 * Gartika Edge Unit — Live Mobile Sensing Application.
 * 
 * Orchestrates physical camera frames, GPS coordinates, IMU accelerometer sensors,
 * and offline-first edge queueing for reliable municipal fleet intelligence.
 */

class GartikaMobileEdgeUnit {
  constructor() {
    this.busId = "BUS-101";
    this.isSensing = false;
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/events`;

    // Instantiate Subsystems
    this.ui = new MobileUI();
    this.offlineQueue = new OfflineQueue();
    this.telemetryClient = new TelemetryClient(this.backendUrl, this.offlineQueue);
    
    this.connectionManager = new ConnectionManager(
      this.backendUrl,
      this.wsUrl,
      (state, detail) => this.handleConnectionStateChange(state, detail)
    );

    this.imu = new ImuSensorManager(
      (shock) => this.handleRoadShock(shock),
      (reading) => this.handleImuReading(reading)
    );

    this.gps = new GpsSensorManager(
      (pos) => this.handleGpsUpdate(pos),
      (err) => this.handleGpsError(err)
    );

    this.camera = new CameraManager(
      this.ui.cameraPreview,
      (blob) => this.handleFrameCaptured(blob),
      (err) => this.handleCameraError(err)
    );

    // Timers
    this.telemetryTimer = null;
    this.currentGps = null;
    this.currentImu = { ax: 0.0, ay: 0.0, az: 9.81 };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.connectionManager.connectWebSocket();
    const health = await this.connectionManager.checkHealth();
    if (health.online) {
      this.ui.updateConnectionState("CONNECTED", health.pingMs);
      this.ui.log(`Connected to Gartika Platform (${health.pingMs}ms ping)`, "success");
    } else {
      this.ui.updateConnectionState("OFFLINE");
      this.ui.log("Platform server offline. Events will queue locally.", "warn");
    }
  }

  bindEvents() {
    this.ui.busIdInput?.addEventListener("change", (e) => {
      this.busId = e.target.value.trim().toUpperCase() || "BUS-101";
      this.ui.log(`Bus identifier updated to ${this.busId}`, "info");
    });

    this.ui.toggleBtn?.addEventListener("click", () => this.toggleSensing());
    this.ui.snapInput?.addEventListener("change", (e) => this.handleNativePhotoSnap(e));
    this.ui.btnClearLog?.addEventListener("click", () => {
      if (this.ui.logStream) this.ui.logStream.innerHTML = "";
    });

    if (this.ui.connectionTarget) {
      this.ui.connectionTarget.innerText = `Host: ${this.backendUrl}`;
    }
  }

  handleConnectionStateChange(state, detail) {
    this.ui.updateConnectionState(state);
    if (state === "CONNECTED") {
      this.ui.log("Real-time WebSocket stream connected", "success");
      this.offlineQueue.flush(this.backendUrl);
    } else if (state === "RECONNECTING") {
      this.ui.log("Network interrupted, reconnecting...", "warn");
    }
  }

  handleImuReading(reading) {
    this.currentImu = reading;
    this.ui.updateTelemetryDisplay(this.currentGps, this.currentImu, this.telemetryClient.packetCount);
  }

  handleRoadShock(shock) {
    this.ui.log(`Road shock detected! az=${shock.az.toFixed(2)} m/s²`, "bump");
    // Immediately transmit telemetry ping to trigger shock sensor fusion
    if (this.currentGps) {
      this.telemetryClient.sendTelemetry(this.busId, this.currentGps, this.currentImu);
    }
  }

  handleGpsUpdate(pos) {
    this.currentGps = pos;
    this.ui.gpsStatus?.classList.add("online");
    this.ui.updateTelemetryDisplay(this.currentGps, this.currentImu, this.telemetryClient.packetCount);
  }

  handleGpsError(errMsg) {
    this.ui.gpsStatus?.classList.remove("online");
    this.ui.log(`GPS status: ${errMsg}`, "warn");
  }

  handleFrameCaptured(blob) {
    if (this.isSensing) {
      this.telemetryClient.uploadFrame(this.busId, blob);
    }
  }

  handleCameraError(errMsg) {
    this.ui.camStatus?.classList.remove("online");
    if (this.ui.camFallbackMsg) this.ui.camFallbackMsg.style.display = "flex";
    if (this.ui.camNoticeText) this.ui.camNoticeText.innerText = errMsg;
    this.ui.log(`Camera notice: ${errMsg}`, "warn");
  }

  handleNativePhotoSnap(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.ui.log(`Photo captured (${(file.size / 1024).toFixed(1)} KB), uploading...`, "info");
    this.telemetryClient.uploadFrame(this.busId, file).then((ok) => {
      if (ok) {
        this.ui.log("Photo analyzed successfully by AI engine", "success");
      } else {
        this.ui.log("Photo upload queued or failed.", "warn");
      }
    });
  }

  async toggleSensing() {
    if (!this.isSensing) {
      await this.startSensing();
    } else {
      this.stopSensing();
    }
  }

  async startSensing() {
    this.isSensing = true;
    this.ui.setSensingState(true);
    this.ui.log(`Started live sensing on ${this.busId}`, "success");

    // Request accelerometer permission
    await this.imu.requestPermission();
    this.imu.start();

    // Start GPS
    this.gps.start();

    // Start Camera
    const camOk = await this.camera.start();
    if (camOk) {
      this.ui.camStatus?.classList.add("online");
      if (this.ui.camFallbackMsg) this.ui.camFallbackMsg.style.display = "none";
      this.camera.startFrameCapture(1000);
    }

    // Telemetry reporting interval (every 1.5s)
    this.telemetryTimer = setInterval(() => {
      if (this.currentGps) {
        this.telemetryClient.sendTelemetry(this.busId, this.currentGps, this.currentImu);
        this.ui.updateTelemetryDisplay(this.currentGps, this.currentImu, this.telemetryClient.packetCount);
      }
    }, 1500);
  }

  stopSensing() {
    this.isSensing = false;
    this.ui.setSensingState(false);
    this.ui.log("Sensing paused", "warn");

    this.imu.stop();
    this.gps.stop();
    this.camera.stop();

    this.ui.camStatus?.classList.remove("online");
    this.ui.gpsStatus?.classList.remove("online");
    if (this.ui.camFallbackMsg) this.ui.camFallbackMsg.style.display = "flex";

    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
  }
}

// Instantiate upon DOM load
window.addEventListener("DOMContentLoaded", () => {
  window.edgeUnit = new GartikaMobileEdgeUnit();
});
