/**
 * Central Mobile Sensor Controller for Gartika Edge Sensing Unit.
 * 
 * Coordinates:
 * - Camera capture lifecycle
 * - GPS / GNSS tracking
 * - 3-Axis IMU motion & vibration sensing
 * - Offline-first IndexedDB queueing & exponential backoff sync
 * - Connection manager (Network, Backend Health, WebSocket)
 * - Temporal sensor alignment & telemetry batch dispatch
 */

class MobileSensorController {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || window.location.origin;
    this.wsUrl = options.wsUrl || ((window.location.protocol === "https:" ? "wss:" : "ws:") + "//" + window.location.host + "/ws/events");
    this.busId = options.busId || "BUS-101";
    this.deviceId = options.deviceId || ("EDG-" + Math.random().toString(36).substr(2, 6).toUpperCase());
    
    this.isSensing = false;
    this.isPaused = false;
    
    // Performance & telemetry metrics
    this.metrics = {
      framesCaptured: 0,
      framesUploaded: 0,
      framesDropped: 0,
      telemetrySent: 0,
      telemetryQueued: 0,
      detectionsCount: 0,
      failedUploads: 0,
      lastTelemetryTime: 0,
      lastFrameTime: 0
    };

    // Subsystems
    this.queue = new OfflineQueue({ maxRetries: 5 });
    this.conn = new ConnectionManager(this.baseUrl, this.wsUrl, {
      onStateChange: (net) => this.handleNetworkStateChange(net),
      onBackendRestored: () => this.flushQueue()
    });
    
    this.gps = new GpsSensorManager({
      onLocationUpdate: (loc) => this.handleLocationUpdate(loc),
      onStateChange: (state, detail) => this.onSensorStateChange("GPS", state, detail),
      onError: (err) => this.log(err, "error")
    });

    this.imu = new ImuSensorManager({
      onReading: (r) => this.handleImuReading(r),
      onShockDetected: (shock) => this.handleImuShock(shock),
      onStateChange: (state, detail) => this.onSensorStateChange("IMU", state, detail),
      onError: (err) => this.log(err, "error")
    });

    this.camera = null; // initialized with video DOM element
    this.telemetryInterval = null;
    
    // UI Callbacks
    this.onStatusUpdate = options.onStatusUpdate || (() => {});
    this.onLog = options.onLog || (() => {});
  }

  setVideoElement(videoEl) {
    this.camera = new CameraManager(videoEl, {
      aiCaptureIntervalMs: 1500,
      onFrameCaptured: (blob, meta) => this.handleFrameCaptured(blob, meta),
      onStateChange: (state, detail) => this.onSensorStateChange("CAMERA", state, detail),
      onError: (err) => this.log(err, "warn")
    });
  }

  setBusId(id) {
    this.busId = (id || "BUS-101").trim().toUpperCase();
    this.log(`Bus identifier updated to ${this.busId}`, "info");
    this.notifyStatus();
  }

  log(msg, type = "info") {
    this.onLog(msg, type);
  }

  onSensorStateChange(sensor, state, detail) {
    this.notifyStatus();
  }

  handleNetworkStateChange(net) {
    this.notifyStatus();
  }

  handleLocationUpdate(loc) {
    this.notifyStatus();
  }

  handleImuReading(r) {
    this.notifyStatus();
  }

  handleImuShock(shock) {
    this.log(`⚠️ Mechanical Road Shock Detected! Vertical Δz: ${shock.gravity_compensated_z} m/s² (Score: ${shock.shock_score})`, "warn");
    // Trigger immediate visual frame capture to pair with shock anomaly
    if (this.camera && this.isSensing && !this.isPaused) {
      this.camera.captureFrame();
    }
  }

  async startSensing() {
    if (this.isSensing) return;
    this.isSensing = true;
    this.isPaused = false;
    this.log(`Initiating mobile edge sensing subsystem for ${this.busId}...`, "info");

    // 1. Start network monitoring & WebSocket
    this.conn.start();

    // 2. Start GPS
    this.gps.start();

    // 3. Start IMU
    await this.imu.start();

    // 4. Start Camera Stream & Capture
    if (this.camera) {
      await this.camera.start();
    }

    // 5. Start Telemetry Loop (1.0 Hz)
    if (this.telemetryInterval) clearInterval(this.telemetryInterval);
    this.telemetryInterval = setInterval(() => this.dispatchTelemetry(), 1000);

    this.notifyStatus();
    this.log(`✅ Mobile Sensing Active on ${this.busId}. Forward road monitoring engaged.`, "info");
  }

  pauseSensing() {
    if (!this.isSensing || this.isPaused) return;
    this.isPaused = true;
    if (this.camera) this.camera.pause();
    this.imu.pause();
    this.log("⏸️ Sensing paused.", "warn");
    this.notifyStatus();
  }

  resumeSensing() {
    if (!this.isSensing || !this.isPaused) return;
    this.isPaused = false;
    if (this.camera) this.camera.resume();
    this.imu.resume();
    this.log("▶️ Sensing resumed.", "info");
    this.notifyStatus();
  }

  stopSensing() {
    if (!this.isSensing) return;
    this.isSensing = false;
    this.isPaused = false;

    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }

    if (this.camera) this.camera.stop();
    this.gps.stop();
    this.imu.stop();
    this.conn.stop();

    this.log("🛑 Sensing halted. All hardware streams released.", "warn");
    this.notifyStatus();
  }

  async dispatchTelemetry() {
    if (!this.isSensing || this.isPaused) return;

    const gpsReading = this.gps.getReading();
    const imuReading = this.imu.getReading();
    const nowMs = Date.now();

    const payload = {
      bus_id: this.busId,
      device_id: this.deviceId,
      latitude: gpsReading ? gpsReading.latitude : null,
      longitude: gpsReading ? gpsReading.longitude : null,
      accuracy: gpsReading ? gpsReading.accuracy : null,
      speed: gpsReading ? gpsReading.speed : 0.0,
      heading: gpsReading ? gpsReading.heading : null,
      ax: imuReading ? imuReading.ax : 0.0,
      ay: imuReading ? imuReading.ay : 0.0,
      az: imuReading ? imuReading.az : 9.81,
      gravity_compensated_z: imuReading ? imuReading.gravity_compensated_z : 0.0,
      timestamp: new Date().toISOString()
    };

    this.metrics.lastTelemetryTime = nowMs;

    // Fast-path HTTP POST if online, otherwise enqueue offline
    if (this.conn.backendOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/telemetry`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          this.metrics.telemetrySent++;
        } else {
          await this.queue.enqueue("/api/v1/telemetry", payload);
          this.metrics.telemetryQueued++;
        }
      } catch (err) {
        await this.queue.enqueue("/api/v1/telemetry", payload);
        this.metrics.telemetryQueued++;
      }
    } else {
      await this.queue.enqueue("/api/v1/telemetry", payload);
      this.metrics.telemetryQueued++;
    }

    this.notifyStatus();
  }

  async handleFrameCaptured(blob, meta) {
    if (!this.isSensing || this.isPaused) return;

    this.metrics.framesCaptured++;
    const gpsReading = this.gps.getReading();
    const formData = new FormData();
    formData.append("file", blob, `frame_${Date.now()}.jpg`);
    formData.append("bus_id", this.busId);
    formData.append("device_id", this.deviceId);

    if (gpsReading && !gpsReading.is_stale) {
      formData.append("latitude", gpsReading.latitude.toString());
      formData.append("longitude", gpsReading.longitude.toString());
      formData.append("accuracy", gpsReading.accuracy.toString());
    }

    if (this.conn.backendOnline) {
      try {
        const res = await fetch(`${this.baseUrl}/api/v1/stream/frame`, {
          method: "POST",
          body: formData
        });
        if (res.ok) {
          this.metrics.framesUploaded++;
          const data = await res.json();
          if (data.defects_detected > 0) {
            this.metrics.detectionsCount += data.defects_detected;
            this.log(`🎯 ${data.defects_detected} Road Defect(s) Detected by Server AI!`, "info");
          }
        } else {
          this.metrics.failedUploads++;
        }
      } catch (e) {
        this.metrics.failedUploads++;
      }
    } else {
      this.metrics.framesDropped++;
    }

    this.notifyStatus();
  }

  async uploadManualPhoto(file) {
    if (!file) return;
    this.log(`Uploading manual high-res hazard photo (${(file.size / 1024).toFixed(1)} KB)...`, "info");

    const gpsReading = this.gps.getReading();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("bus_id", this.busId);
    formData.append("device_id", this.deviceId);

    if (gpsReading) {
      formData.append("latitude", gpsReading.latitude.toString());
      formData.append("longitude", gpsReading.longitude.toString());
      formData.append("accuracy", gpsReading.accuracy.toString());
    }

    try {
      const res = await fetch(`${this.baseUrl}/api/v1/stream/frame`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        this.metrics.detectionsCount += (data.defects_detected || 0);
        this.log(`✅ Manual photo processed successfully! Defects found: ${data.defects_detected || 0}`, "info");
        this.notifyStatus();
        return true;
      } else {
        this.log("Upload failed: server returned error.", "warn");
        return false;
      }
    } catch (err) {
      this.log("Upload failed: server unreachable.", "error");
      return false;
    }
  }

  async flushQueue() {
    const counts = await this.queue.getCounts();
    if (counts.pending === 0) return;

    this.log(`🔄 Flushing ${counts.pending} offline-queued telemetry packets...`, "info");
    const result = await this.queue.flush(this.baseUrl, (flushed, total) => {
      this.notifyStatus();
    });

    if (result.flushed > 0) {
      this.log(`✅ Synchronized ${result.flushed} offline telemetry packets.`, "info");
    }
    this.notifyStatus();
  }

  async getStatus() {
    const queueCounts = await this.queue.getCounts();
    return {
      isSensing: this.isSensing,
      isPaused: this.isPaused,
      busId: this.busId,
      deviceId: this.deviceId,
      cameraState: this.camera ? this.camera.state : "UNAVAILABLE",
      gpsState: this.gps.state,
      gpsReading: this.gps.getReading(),
      imuState: this.imu.state,
      imuReading: this.imu.getReading(),
      network: {
        internetOnline: this.conn.internetOnline,
        backendOnline: this.conn.backendOnline,
        wsConnected: this.conn.wsConnected,
        rttMs: this.conn.rttMs
      },
      queue: {
        pending: queueCounts.pending,
        failed: queueCounts.failed,
        total: queueCounts.total,
        isFlushing: this.queue.isFlushing
      },
      metrics: { ...this.metrics }
    };
  }

  async notifyStatus() {
    const status = await this.getStatus();
    this.onStatusUpdate(status);
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MobileSensorController };
}
