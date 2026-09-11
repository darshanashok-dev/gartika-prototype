/**
 * Gartika Mobile Edge Sensing Application Entrypoint.
 * 
 * Binds UI DOM elements to the central MobileSensorController,
 * manages status updates, handles camera permissions, user interactions,
 * manual photo capture, and engineering diagnostics.
 */

class GartikaMobileEdgeApp {
  constructor() {
    this.controller = new MobileSensorController({
      onStatusUpdate: (status) => this.renderStatus(status),
      onLog: (msg, type) => this.log(msg, type)
    });

    this.init();
  }

  init() {
    this.bindDOM();
    this.controller.setVideoElement(this.cameraPreview, this.virtualPreviewCanvas);
    this.bindEvents();
    this.updateHostTarget();
    this.controller.notifyStatus();
  }

  bindDOM() {
    this.busIdInput = document.getElementById("busIdInput");
    this.toggleBtn = document.getElementById("toggleBtn");
    this.toggleBtnText = document.getElementById("toggleBtnText");
    this.pauseBtn = document.getElementById("pauseBtn");
    this.pauseBtnText = document.getElementById("pauseBtnText");
    this.btnSwitchCam = document.getElementById("btnSwitchCam");
    
    this.sensingBanner = document.getElementById("sensingBanner");
    this.bannerStateText = document.getElementById("bannerStateText");
    this.bannerInstruction = document.getElementById("bannerInstruction");
    
    this.camStatus = document.getElementById("camStatus");
    this.camStatusText = document.getElementById("camStatusText");
    this.gpsStatus = document.getElementById("gpsStatus");
    this.gpsStatusText = document.getElementById("gpsStatusText");
    this.imuStatus = document.getElementById("imuStatus");
    this.imuStatusText = document.getElementById("imuStatusText");
    this.netStatus = document.getElementById("netStatus");
    this.netStatusText = document.getElementById("netStatusText");

    this.cameraPreview = document.getElementById("cameraPreview");
    this.virtualPreviewCanvas = document.getElementById("virtualPreviewCanvas");
    this.camFallbackMsg = document.getElementById("camFallbackMsg");
    this.camNoticeTitle = document.getElementById("camNoticeTitle");
    this.camNoticeText = document.getElementById("camNoticeText");
    this.btnRetryCamera = document.getElementById("btnRetryCamera");
    this.ingestMode = document.getElementById("ingestMode");
    this.hudPing = document.getElementById("hudPing");
    this.hudFps = document.getElementById("hudFps");

    this.offlineQueueBar = document.getElementById("offlineQueueBar");
    this.queueCount = document.getElementById("queueCount");
    this.btnSyncNow = document.getElementById("btnSyncNow");

    this.metricFrames = document.getElementById("metricFrames");
    this.metricTelemetry = document.getElementById("metricTelemetry");
    this.metricDetections = document.getElementById("metricDetections");
    this.metricQueued = document.getElementById("metricQueued");

    this.latVal = document.getElementById("latVal");
    this.lonVal = document.getElementById("lonVal");
    this.speedVal = document.getElementById("speedVal");
    this.imuVal = document.getElementById("imuVal");
    this.vibVal = document.getElementById("vibVal");
    this.gpsAccuracyBadge = document.getElementById("gpsAccuracyBadge");

    this.snapInput = document.getElementById("snapInput");
    this.logStream = document.getElementById("logStream");
    this.btnClearLog = document.getElementById("btnClearLog");
    this.btnDiagnostics = document.getElementById("btnDiagnostics");
    this.connectionTarget = document.getElementById("connectionTarget");

    // Modal
    this.diagModal = document.getElementById("diagModal");
    this.btnCloseDiag = document.getElementById("btnCloseDiag");
    this.diagDeviceId = document.getElementById("diagDeviceId");
    this.diagBusId = document.getElementById("diagBusId");
    this.diagCam = document.getElementById("diagCam");
    this.diagCamPerm = document.getElementById("diagCamPerm");
    this.diagCamRes = document.getElementById("diagCamRes");
    this.diagCamFps = document.getElementById("diagCamFps");
    this.diagFramesCap = document.getElementById("diagFramesCap");
    this.diagFramesDrop = document.getElementById("diagFramesDrop");
    this.diagGps = document.getElementById("diagGps");
    this.diagImu = document.getElementById("diagImu");
    this.diagHost = document.getElementById("diagHost");
    this.diagRtt = document.getElementById("diagRtt");
    this.diagLastUpload = document.getElementById("diagLastUpload");
    this.diagAiLatency = document.getElementById("diagAiLatency");
    this.diagQueue = document.getElementById("diagQueue");
    this.diagFailed = document.getElementById("diagFailed");
    this.btnDiagRetryCam = document.getElementById("btnDiagRetryCam");
    this.btnRetryFailed = document.getElementById("btnRetryFailed");
    this.btnClearFailed = document.getElementById("btnClearFailed");
  }

  bindEvents() {
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener("click", () => this.handleToggle());
    }

    if (this.pauseBtn) {
      this.pauseBtn.addEventListener("click", () => this.handlePause());
    }

    if (this.btnSwitchCam) {
      this.btnSwitchCam.addEventListener("click", async () => {
        if (this.controller.camera) {
          this.log("Switching camera facing mode...", "info");
          await this.controller.camera.switchCamera();
          this.controller.notifyStatus();
        }
      });
    }

    if (this.btnRetryCamera) {
      this.btnRetryCamera.addEventListener("click", async () => {
        this.log("Retrying camera initialization...", "info");
        if (this.controller.camera) {
          await this.controller.camera.retry();
          this.controller.notifyStatus();
        }
      });
    }

    if (this.btnDiagRetryCam) {
      this.btnDiagRetryCam.addEventListener("click", async () => {
        if (this.controller.camera) {
          await this.controller.camera.retry();
          this.openDiagnostics();
        }
      });
    }

    if (this.busIdInput) {
      this.busIdInput.addEventListener("change", () => {
        this.controller.setBusId(this.busIdInput.value);
      });
    }

    if (this.snapInput) {
      this.snapInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
          this.controller.uploadManualPhoto(file);
          this.snapInput.value = "";
        }
      });
    }

    if (this.btnSyncNow) {
      this.btnSyncNow.addEventListener("click", () => this.controller.flushQueue());
    }

    if (this.btnClearLog) {
      this.btnClearLog.addEventListener("click", () => {
        if (this.logStream) this.logStream.innerHTML = "";
      });
    }

    if (this.btnDiagnostics) {
      this.btnDiagnostics.addEventListener("click", () => this.openDiagnostics());
    }

    if (this.btnCloseDiag) {
      this.btnCloseDiag.addEventListener("click", () => this.closeDiagnostics());
    }

    if (this.btnRetryFailed) {
      this.btnRetryFailed.addEventListener("click", async () => {
        const count = await this.controller.queue.retryFailed();
        this.log(`Retrying ${count} failed events.`, "info");
        this.controller.flushQueue();
      });
    }

    if (this.btnClearFailed) {
      this.btnClearFailed.addEventListener("click", async () => {
        const count = await this.controller.queue.clearFailed();
        this.log(`Cleared ${count} failed events.`, "info");
        this.controller.notifyStatus();
      });
    }
  }

  updateHostTarget() {
    if (this.connectionTarget) {
      this.connectionTarget.textContent = `Server: ${window.location.host}`;
    }
  }

  async handleToggle() {
    if (this.controller.isSensing) {
      this.controller.stopSensing();
    } else {
      await this.controller.startSensing();
    }
  }

  handlePause() {
    if (!this.controller.isSensing) return;
    if (this.controller.isPaused) {
      this.controller.resumeSensing();
    } else {
      this.controller.pauseSensing();
    }
  }

  log(msg, type = "info") {
    if (!this.logStream) return;
    const line = document.createElement("div");
    line.className = `log-line ${type}`;
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    line.textContent = `[${ts}] ${msg}`;
    this.logStream.appendChild(line);
    this.logStream.scrollTop = this.logStream.scrollHeight;
  }

  renderStatus(st) {
    // 1. Banner & Controls
    if (st.isSensing) {
      if (st.isPaused) {
        this.sensingBanner.className = "sensing-status-banner paused";
        this.bannerStateText.textContent = "SENSING PAUSED";
        this.bannerInstruction.textContent = "Telemetry & camera capture paused. Tap Resume to continue.";
        this.ingestMode.textContent = "PAUSED";
        this.pauseBtn.disabled = false;
        this.pauseBtnText.textContent = "Resume";
      } else {
        this.sensingBanner.className = "sensing-status-banner sensing";
        this.bannerStateText.textContent = "ACTIVE SENSING";
        this.bannerInstruction.textContent = "Vehicle mounted facing forward. Streaming telemetry & dashcam.";
        this.ingestMode.textContent = "LIVE";
        this.pauseBtn.disabled = false;
        this.pauseBtnText.textContent = "Pause";
      }
      this.toggleBtn.classList.add("sensing");
      this.toggleBtnText.textContent = "Stop Sensing";
    } else {
      this.sensingBanner.className = "sensing-status-banner standby";
      this.bannerStateText.textContent = "STANDBY";
      this.bannerInstruction.textContent = "Mount phone firmly on windshield. Tap 'Start Sensing' to begin.";
      this.ingestMode.textContent = "STANDBY";
      this.toggleBtn.classList.remove("sensing");
      this.toggleBtnText.textContent = "Start Sensing";
      this.pauseBtn.disabled = true;
      this.pauseBtnText.textContent = "Pause";
    }

    // 2. Camera Status & Viewport Overlay
    const camRunning = st.cameraState === "RUNNING";
    const camError = ["PERMISSION_DENIED", "NO_CAMERA", "CAMERA_ERROR"].includes(st.cameraState);
    
    this.camStatusText.textContent = st.cameraState;
    this.camStatus.className = `status-pill ${camRunning ? "online" : (camError ? "error" : (st.cameraState === "PAUSED" ? "warn" : ""))}`;

    if (this.camFallbackMsg) {
      if (camRunning) {
        this.camFallbackMsg.classList.add("hidden");
        if (this.btnRetryCamera) this.btnRetryCamera.classList.add("hidden");
      } else {
        this.camFallbackMsg.classList.remove("hidden");
        if (camError) {
          if (st.cameraState === "PERMISSION_DENIED") {
            this.camNoticeTitle.textContent = "Camera Access Blocked";
            this.camNoticeText.textContent = "Allow camera permission in browser site settings, then press Retry.";
          } else if (st.cameraState === "NO_CAMERA") {
            this.camNoticeTitle.textContent = "No Camera Hardware";
            this.camNoticeText.textContent = "No camera was detected on this device.";
          } else {
            this.camNoticeTitle.textContent = "Camera Hardware Unavailable";
            this.camNoticeText.textContent = st.cameraStateDetail || "Unable to access video stream.";
          }
          if (this.btnRetryCamera) this.btnRetryCamera.classList.remove("hidden");
        } else {
          this.camNoticeTitle.textContent = "Windshield Camera Feed";
          this.camNoticeText.textContent = "Camera activates on 'Start Sensing'. Ensure phone faces road.";
          if (this.btnRetryCamera) this.btnRetryCamera.classList.add("hidden");
        }
      }
    }

    if (this.hudFps) {
      this.hudFps.textContent = st.cameraMetrics && st.cameraMetrics.measuredFps > 0
        ? `${st.cameraMetrics.measuredFps.toFixed(1)} FPS`
        : (camRunning ? "15.0 FPS" : "--");
    }

    // 3. GPS Status
    const gpsFixed = st.gpsState === "FIXED";
    this.gpsStatusText.textContent = st.gpsState;
    this.gpsStatus.className = `status-pill ${gpsFixed ? "online" : (st.gpsState === "STALE" ? "warn" : "")}`;

    if (st.gpsReading) {
      this.latVal.textContent = st.gpsReading.latitude !== null ? st.gpsReading.latitude.toFixed(6) : "--";
      this.lonVal.textContent = st.gpsReading.longitude !== null ? st.gpsReading.longitude.toFixed(6) : "--";
      this.speedVal.textContent = `${(st.gpsReading.speed || 0.0).toFixed(1)} km/h`;
      this.gpsAccuracyBadge.textContent = st.gpsReading.accuracy !== null ? `±${st.gpsReading.accuracy.toFixed(0)}m ACCURACY` : "-- m";
    } else {
      this.latVal.textContent = "--";
      this.lonVal.textContent = "--";
      this.speedVal.textContent = "0.0 km/h";
      this.gpsAccuracyBadge.textContent = "-- m ACCURACY";
    }

    // 4. IMU Status
    const imuActive = st.imuState === "ACTIVE";
    this.imuStatusText.textContent = st.imuState === "ACTIVE" ? "ACTIVE" : st.imuState;
    this.imuStatus.className = `status-pill ${imuActive ? "online" : ""}`;

    if (st.imuReading) {
      this.imuVal.textContent = `${st.imuReading.gravity_compensated_z.toFixed(2)} m/s²`;
      this.vibVal.textContent = st.imuReading.vibration_level;
      if (st.imuReading.vibration_level === "HIGH") {
        this.vibVal.className = "m-val font-mono text-rose-400";
      } else if (st.imuReading.vibration_level === "MEDIUM") {
        this.vibVal.className = "m-val font-mono text-amber-400";
      } else {
        this.vibVal.className = "m-val font-mono text-emerald-400";
      }
    }

    // 5. Network Status
    const netOnline = st.network.backendOnline;
    this.netStatusText.textContent = netOnline ? "ONLINE" : (st.network.internetOnline ? "CONN..." : "OFFLINE");
    this.netStatus.className = `status-pill ${netOnline ? "online" : (st.network.internetOnline ? "warn" : "error")}`;
    if (this.hudPing) {
      this.hudPing.textContent = st.network.rttMs !== null ? `${st.network.rttMs}ms` : "--";
    }

    // 6. Queue Bar
    if (st.queue.pending > 0) {
      this.offlineQueueBar.classList.remove("hidden");
      this.queueCount.textContent = st.queue.pending;
    } else {
      this.offlineQueueBar.classList.add("hidden");
    }

    // 7. Metrics
    this.metricFrames.textContent = st.metrics.framesUploaded;
    this.metricTelemetry.textContent = st.metrics.telemetrySent;
    this.metricDetections.textContent = st.metrics.detectionsCount;
    this.metricQueued.textContent = st.queue.pending;
  }

  async openDiagnostics() {
    const st = await this.controller.getStatus();
    const cm = st.cameraMetrics || {};

    if (this.diagDeviceId) this.diagDeviceId.textContent = st.deviceId;
    if (this.diagBusId) this.diagBusId.textContent = st.busId;
    if (this.diagCam) this.diagCam.textContent = `${st.cameraState} ${st.cameraStateDetail ? '(' + st.cameraStateDetail + ')' : ''}`;
    if (this.diagCamPerm) this.diagCamPerm.textContent = cm.permissionStatus || "UNKNOWN";
    if (this.diagCamRes) this.diagCamRes.textContent = cm.videoWidth ? `${cm.videoWidth} × ${cm.videoHeight}` : "--";
    if (this.diagCamFps) this.diagCamFps.textContent = cm.measuredFps ? `${cm.measuredFps} FPS` : "--";
    if (this.diagFramesCap) this.diagFramesCap.textContent = `${cm.framesCaptured || st.metrics.framesCaptured || 0}`;
    if (this.diagFramesDrop) this.diagFramesDrop.textContent = `${cm.framesDropped || st.metrics.framesDropped || 0}`;
    
    if (this.diagGps) this.diagGps.textContent = `${st.gpsState} (${st.gpsReading ? (st.gpsReading.accuracy ? `±${st.gpsReading.accuracy.toFixed(1)}m` : 'locked') : 'no fix'})`;
    const baseG = (st.imuReading && st.imuReading.baseline_g != null) ? st.imuReading.baseline_g : 9.81;
    if (this.diagImu) this.diagImu.textContent = `${st.imuState} (Base G: ${baseG} m/s²)`;
    if (this.diagHost) this.diagHost.textContent = this.controller.baseUrl;
    if (this.diagRtt) this.diagRtt.textContent = st.network.rttMs !== null ? `${st.network.rttMs} ms` : "Offline";
    if (this.diagLastUpload) this.diagLastUpload.textContent = `${st.metrics.lastUploadStatus} (${st.metrics.lastUploadLatencyMs}ms)`;
    if (this.diagAiLatency) this.diagAiLatency.textContent = st.metrics.aiLatencyMs ? `${st.metrics.aiLatencyMs} ms` : "--";
    if (this.diagQueue) this.diagQueue.textContent = `${st.queue.pending} pending / ${st.queue.total} total`;
    if (this.diagFailed) this.diagFailed.textContent = `${st.queue.failed} permanently failed`;

    if (this.diagModal) this.diagModal.classList.remove("hidden");
  }

  closeDiagnostics() {
    if (this.diagModal) this.diagModal.classList.add("hidden");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.gartikaMobileApp = new GartikaMobileEdgeApp();
});
