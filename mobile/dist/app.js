/**
 * Gartika Edge Unit — Live Mobile Sensing Application.
 * 
 * Runs on smartphones to capture real hardware camera frames,
 * physical GPS coordinates, and native device motion (accelerometer/gyroscope) readings.
 * 
 * Strict LIVE Mode: No synthetic road animations or fake GPS simulation are used.
 */
class GartikaMobileEdgeUnit {
  /**
   * Initializes real mobile sensor state and UI element bindings.
   */
  constructor() {
    this.busId = "BUS-101";
    this.isSensing = false;
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/events`;
    
    // Live Hardware Telemetry State
    this.currentLat = null;
    this.currentLon = null;
    this.accuracy = null;
    this.speed = 0.0;
    this.imu = { ax: 0.0, ay: 0.0, az: 9.81 };
    this.packetCount = 0;
    
    // Hardware Timers & Stream Handles
    this.telemetryTimer = null;
    this.frameTimer = null;
    this.gpsWatchId = null;
    this.videoStream = null;
    this.ws = null;
    
    // Off-screen canvas for capturing camera frames before network transmission
    this.canvas = document.createElement("canvas");
    this.canvasCtx = this.canvas.getContext("2d");

    this.initElements();
    this.bindEvents();
    this.initWebSocket();
    this.checkNetwork();
  }

  /**
   * Cache DOM element handles for sensors, HUD indicators, buttons, and logs.
   */
  initElements() {
    this.busIdInput = document.getElementById("busIdInput");
    this.camStatus = document.getElementById("camStatus");
    this.gpsStatus = document.getElementById("gpsStatus");
    this.netStatus = document.getElementById("netStatus");
    this.cameraPreview = document.getElementById("cameraPreview");
    this.camFallbackMsg = document.getElementById("camFallbackMsg");
    this.camNoticeText = document.getElementById("camNoticeText");
    this.ingestMode = document.getElementById("ingestMode");
    this.hudPackets = document.getElementById("hudPackets");
    this.hudPing = document.getElementById("hudPing");
    this.latVal = document.getElementById("latVal");
    this.lonVal = document.getElementById("lonVal");
    this.accVal = document.getElementById("accVal");
    this.speedVal = document.getElementById("speedVal");
    this.imuVal = document.getElementById("imuVal");
    this.toggleBtn = document.getElementById("toggleBtn");
    this.snapInput = document.getElementById("snapInput");
    this.logStream = document.getElementById("logStream");
    this.btnClearLog = document.getElementById("btnClearLog");
    this.connectionTarget = document.getElementById("connectionTarget");
    
    if (this.connectionTarget) {
      this.connectionTarget.innerText = `Host: ${this.backendUrl}`;
    }
  }

  /**
   * Bind event listeners for UI buttons, file upload inputs, and bus ID updates.
   */
  bindEvents() {
    this.busIdInput?.addEventListener("change", (e) => {
      this.busId = e.target.value.trim().toUpperCase() || "BUS-101";
      this.log(`Bus ID updated to ${this.busId}`, "info");
    });

    this.toggleBtn?.addEventListener("click", () => this.toggleSensing());
    this.snapInput?.addEventListener("change", (e) => this.handleNativePhotoSnap(e));
    this.btnClearLog?.addEventListener("click", () => {
      if (this.logStream) this.logStream.innerHTML = '';
    });
  }

  /**
   * Append a timestamped message to the mobile edge log stream HUD.
   * @param {string} msg - Message text.
   * @param {string} type - Message classification ('info', 'success', 'warn', 'bump').
   */
  log(msg, type = "info") {
    if (!this.logStream) return;
    const el = document.createElement("div");
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.className = `log-line ${type}`;
    el.innerText = `[${ts}] ${msg}`;
    this.logStream.appendChild(el);
    this.logStream.scrollTop = this.logStream.scrollHeight;
  }

  /**
   * Establish WebSocket connection to backend event stream.
   */
  initWebSocket() {
    try {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => {
        this.netStatus?.classList.add("online");
        this.log("WebSocket connected to backend", "success");
      };
      this.ws.onclose = () => {
        this.netStatus?.classList.remove("online");
        setTimeout(() => this.initWebSocket(), 4000);
      };
      this.ws.onerror = () => {
        this.netStatus?.classList.remove("online");
      };
    } catch (e) {
      this.netStatus?.classList.remove("online");
    }
  }

  /**
   * Ping backend health endpoint to measure network latency and confirm reachability.
   */
  async checkNetwork() {
    const startT = Date.now();
    try {
      const res = await fetch(`${this.backendUrl}/health`);
      if (res.ok) {
        const ping = Date.now() - startT;
        if (this.hudPing) this.hudPing.innerText = `${ping}ms`;
        this.netStatus?.classList.add("online");
        this.log(`Backend connection verified (${ping}ms)`, "success");
      }
    } catch (e) {
      this.netStatus?.classList.remove("online");
      this.log("Backend offline or unreachable.", "warn");
    }
  }

  /**
   * Toggle sensor pipeline between active sensing and standby mode.
   */
  async toggleSensing() {
    if (!this.isSensing) {
      await this.startSensing();
    } else {
      this.stopSensing();
    }
  }

  /**
   * Activate hardware camera stream, GPS tracking, IMU listeners, and periodic telemetry uploads.
   */
  async startSensing() {
    this.isSensing = true;
    if (this.toggleBtn) {
      this.toggleBtn.classList.add("active");
      this.toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>
        <span>Stop Sensing</span>
      `;
    }
    if (this.ingestMode) this.ingestMode.innerText = "ACTIVE";
    this.log(`Started live sensing on ${this.busId}`, "success");

    // Request iOS Motion Permissions if required
    await this.requestMotionPermissions();

    // Start Live Hardware Camera
    await this.startCamera();

    // Start Physical Hardware GPS Tracking
    this.startGps();

    // Start Telemetry reporting interval (every 1.5s)
    this.telemetryTimer = setInterval(() => this.sendTelemetry(), 1500);

    // Start frame snapshot upload interval (every 1.0s)
    this.frameTimer = setInterval(() => this.captureAndSendFrame(), 1000);
  }

  /**
   * Stop active hardware camera, GPS watch, and clear recurring network upload timers.
   */
  stopSensing() {
    this.isSensing = false;
    if (this.toggleBtn) {
      this.toggleBtn.classList.remove("active");
      this.toggleBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
        <span>Start Sensing</span>
      `;
    }
    if (this.ingestMode) this.ingestMode.innerText = "STANDBY";
    this.log(`Sensing pipeline stopped`, "warn");

    // Stop Camera
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
      if (this.cameraPreview) this.cameraPreview.srcObject = null;
    }
    this.camStatus?.classList.remove("online");
    if (this.camFallbackMsg) this.camFallbackMsg.style.display = "flex";

    // Stop GPS
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    this.gpsStatus?.classList.remove("online");

    // Clear timers
    if (this.telemetryTimer) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
    if (this.frameTimer) {
      clearInterval(this.frameTimer);
      this.frameTimer = null;
    }
  }

  /**
   * Request motion accelerometer permission on iOS Safari / WebKit devices.
   */
  async requestMotionPermissions() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          window.addEventListener("devicemotion", (e) => this.handleDeviceMotion(e), false);
          this.log("Physical accelerometer access granted", "success");
        }
      } else if (window.DeviceMotionEvent) {
        window.addEventListener("devicemotion", (e) => this.handleDeviceMotion(e), false);
        this.log("Physical accelerometer active", "success");
      }
    } catch (e) {
      console.warn("Motion permission:", e);
    }
  }

  /**
   * Open physical hardware rear-facing camera.
   */
  async startCamera() {
    try {
      const navMedia = navigator.mediaDevices;
      if (!navMedia || !navMedia.getUserMedia) {
        throw new Error(
          window.location.protocol === "http:"
            ? "Browser requires HTTPS for continuous camera stream (use https://<IP>:8000/mobile or snap button below)"
            : "MediaDevices not supported in this browser"
        );
      }

      let stream = null;
      // Try 1: Back environment camera
      try {
        stream = await navMedia.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 }
          },
          audio: false
        });
      } catch (e1) {
        // Try 2: Any available hardware camera
        stream = await navMedia.getUserMedia({
          video: true,
          audio: false
        });
      }

      this.videoStream = stream;
      if (this.cameraPreview) {
        this.cameraPreview.srcObject = stream;
        await this.cameraPreview.play().catch(() => {});
      }
      this.camStatus?.classList.add("online");
      if (this.camFallbackMsg) this.camFallbackMsg.style.display = "none";
      this.log("Live physical camera stream active", "success");
    } catch (err) {
      this.camStatus?.classList.remove("online");
      if (this.camFallbackMsg) {
        this.camFallbackMsg.style.display = "flex";
        if (this.camNoticeText) {
          this.camNoticeText.innerHTML = `Live Camera: ${err.message}. Use the "Snap & Send Road Photo" button for one-tap native camera capture.`;
        }
      }
      this.log(`Camera status: ${err.message}`, "warn");
    }
  }

  /**
   * Capture a single frame from live video element, convert to JPEG blob, and upload to backend.
   */
  captureAndSendFrame() {
    try {
      if (!this.videoStream || !this.cameraPreview || !this.cameraPreview.videoWidth) {
        return;
      }

      const vw = this.cameraPreview.videoWidth || 640;
      const vh = this.cameraPreview.videoHeight || 480;
      this.canvas.width = 640;
      this.canvas.height = Math.round((640 / vw) * vh);
      this.canvasCtx.drawImage(this.cameraPreview, 0, 0, this.canvas.width, this.canvas.height);
      
      this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("bus_id", this.busId);
        formData.append("frame", blob, "live_mobile_frame.jpg");
        try {
          await fetch(`${this.backendUrl}/stream/frame`, {
            method: "POST",
            body: formData
          });
        } catch (e) {}
      }, "image/jpeg", 0.75);
    } catch (e) {}
  }

  /**
   * Handle photo capture from standard HTML5 native camera input.
   * @param {Event} e - Input change event.
   */
  handleNativePhotoSnap(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.log(`Live photo captured (${(file.size / 1024).toFixed(1)} KB), uploading for AI evaluation...`, "info");
    const formData = new FormData();
    formData.append("bus_id", this.busId);
    formData.append("frame", file, "live_road_snap.jpg");

    fetch(`${this.backendUrl}/stream/frame`, {
      method: "POST",
      body: formData
    }).then(async (res) => {
      if (res.ok) {
        const data = await res.json();
        this.log(`Photo analyzed! Defects detected: ${data.defects_detected || 0}, Vehicles: ${data.vehicles_detected || 0}`, "success");
      }
    }).catch(() => {
      this.log("Upload failed. Check server connection.", "warn");
    });
  }

  /**
   * Subscribe to physical GPS Geolocation updates from device hardware.
   */
  startGps() {
    if ("geolocation" in navigator) {
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.currentLat = pos.coords.latitude;
          this.currentLon = pos.coords.longitude;
          this.accuracy = pos.coords.accuracy || 5.0;
          this.speed = (pos.coords.speed !== null && pos.coords.speed !== undefined) 
            ? pos.coords.speed * 3.6 
            : 0.0;
          this.updateDisplay();
          this.gpsStatus?.classList.add("online");
        },
        (err) => {
          this.gpsStatus?.classList.remove("online");
          this.log(`GPS error: ${err.message}. Please enable Location Services in phone settings.`, "warn");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
      );
    } else {
      this.log("Geolocation is not supported by this device/browser.", "warn");
    }
  }

  /**
   * Handle physical device motion sensor events from the phone accelerometer.
   * @param {DeviceMotionEvent} e - Device motion event.
   */
  handleDeviceMotion(e) {
    if (e.accelerationIncludingGravity) {
      this.imu.ax = parseFloat((e.accelerationIncludingGravity.x || 0).toFixed(2));
      this.imu.ay = parseFloat((e.accelerationIncludingGravity.y || 0).toFixed(2));
      this.imu.az = parseFloat((e.accelerationIncludingGravity.z || 9.81).toFixed(2));
      this.updateDisplay();

      // Check physical bump shock threshold (> 13.5 m/s² vertical acceleration or delta > 4.0 m/s²)
      const deltaZ = Math.abs(this.imu.az - 9.81);
      if (this.imu.az > 13.5 || deltaZ > 4.0) {
        this.log(`Real road bump shock detected! (${this.imu.az.toFixed(2)} m/s²)`, "bump");
        this.sendTelemetry();
      }
    }
  }

  /**
   * Update mobile screen HUD with latest live telemetry values.
   */
  updateDisplay() {
    if (this.latVal) this.latVal.innerText = this.currentLat !== null ? this.currentLat.toFixed(6) : "--";
    if (this.lonVal) this.lonVal.innerText = this.currentLon !== null ? this.currentLon.toFixed(6) : "--";
    if (this.accVal) this.accVal.innerText = this.accuracy !== null ? `±${this.accuracy.toFixed(1)} m` : "--";
    if (this.speedVal) this.speedVal.innerText = `${this.speed.toFixed(1)} km/h`;
    if (this.imuVal) this.imuVal.innerText = `${this.imu.az.toFixed(2)} m/s²`;
  }

  /**
   * Package current GPS, speed, and IMU data and transmit JSON payload to /telemetry.
   */
  async sendTelemetry() {
    // Only send telemetry if real GPS lock has been acquired
    if (this.currentLat === null || this.currentLon === null) {
      return;
    }

    const payload = {
      bus_id: this.busId,
      latitude: this.currentLat,
      longitude: this.currentLon,
      accuracy: this.accuracy || 5.0,
      speed: this.speed || 0.0,
      ax: this.imu.ax,
      ay: this.imu.ay,
      az: this.imu.az,
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(`${this.backendUrl}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        this.packetCount++;
        if (this.hudPackets) this.hudPackets.innerText = this.packetCount;
        this.netStatus?.classList.add("online");
      }
    } catch (e) {
      this.netStatus?.classList.remove("online");
    }
  }
}

// Instantiate mobile application upon DOM content loaded
window.addEventListener("DOMContentLoaded", () => {
  window.edgeUnit = new GartikaMobileEdgeUnit();
});
