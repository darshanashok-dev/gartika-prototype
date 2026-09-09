// Gartika Edge Unit — Resilient Mobile Sensing Application
class GartikaMobileEdgeUnit {
  constructor() {
    this.busId = "BUS-101";
    this.isSensing = false;
    this.simulatingGps = false;
    this.backendUrl = window.location.origin;
    this.wsUrl = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/events`;
    
    // Telemetry State
    this.currentLat = 12.971598;
    this.currentLon = 77.594562;
    this.accuracy = 3.5;
    this.speed = 28.4;
    this.imu = { ax: 0.1, ay: 0.2, az: 9.81 };
    this.packetCount = 0;
    
    // Route waypoints (Bangalore Transit Corridor)
    this.routeWaypoints = [
      [12.971598, 77.594562], // MG Road Metro
      [12.972854, 77.601243], // Trinity Circle
      [12.975412, 77.615234], // Halasuru Lake
      [12.978120, 77.632410], // Indiranagar 100ft Rd
      [12.981045, 77.641200]  // CMH Road Junction
    ];
    this.waypointIdx = 0;
    
    // Timers & Streams
    this.telemetryTimer = null;
    this.frameTimer = null;
    this.gpsWatchId = null;
    this.videoStream = null;
    this.ws = null;
    
    this.canvas = document.createElement("canvas");
    this.canvasCtx = this.canvas.getContext("2d");
    
    this.simCanvas = document.getElementById("simCanvas");
    this.simCtx = this.simCanvas ? this.simCanvas.getContext("2d") : null;
    this.simRoadOffset = 0;

    this.initElements();
    this.bindEvents();
    this.initWebSocket();
    this.checkNetwork();
  }

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
    this.simGpsBtn = document.getElementById("simGpsBtn");
    this.triggerBumpBtn = document.getElementById("triggerBumpBtn");
    this.snapInput = document.getElementById("snapInput");
    this.logStream = document.getElementById("logStream");
    this.btnClearLog = document.getElementById("btnClearLog");
    this.connectionTarget = document.getElementById("connectionTarget");
    
    if (this.connectionTarget) {
      this.connectionTarget.innerText = `Host: ${this.backendUrl}`;
    }
  }

  bindEvents() {
    this.busIdInput?.addEventListener("change", (e) => {
      this.busId = e.target.value.trim().toUpperCase() || "BUS-101";
      this.log(`Bus ID updated to ${this.busId}`, "info");
    });

    this.toggleBtn?.addEventListener("click", () => this.toggleSensing());
    this.simGpsBtn?.addEventListener("click", () => this.toggleGpsSimulation());
    this.triggerBumpBtn?.addEventListener("click", () => this.triggerRoadBump());

    this.snapInput?.addEventListener("change", (e) => this.handleNativePhotoSnap(e));
    this.btnClearLog?.addEventListener("click", () => {
      if (this.logStream) this.logStream.innerHTML = '';
    });
  }

  log(msg, type = "info") {
    if (!this.logStream) return;
    const el = document.createElement("div");
    const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    el.className = `log-line ${type}`;
    el.innerText = `[${ts}] ${msg}`;
    this.logStream.appendChild(el);
    this.logStream.scrollTop = this.logStream.scrollHeight;
  }

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

  async toggleSensing() {
    if (!this.isSensing) {
      await this.startSensing();
    } else {
      this.stopSensing();
    }
  }

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
    this.log(`Started sensing pipeline on ${this.busId}`, "success");

    // Request iOS Motion Permissions if required
    await this.requestMotionPermissions();

    // Start Camera Stream or Synthetic Fallback
    await this.startCamera();

    // Start GPS Location Tracking
    this.startGps();

    // Start Telemetry reporting interval (every 1.5s)
    this.telemetryTimer = setInterval(() => this.sendTelemetry(), 1500);
    this.sendTelemetry();

    // Start frame snapshot upload interval (every 1.2s)
    this.frameTimer = setInterval(() => this.captureAndSendFrame(), 1200);
  }

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
    if (this.simCanvas) this.simCanvas.style.display = "none";
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

  async requestMotionPermissions() {
    try {
      if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
        const response = await DeviceMotionEvent.requestPermission();
        if (response === 'granted') {
          window.addEventListener("devicemotion", (e) => this.handleDeviceMotion(e), false);
          this.log("Accelerometer access granted", "success");
        }
      } else if (window.DeviceMotionEvent) {
        window.addEventListener("devicemotion", (e) => this.handleDeviceMotion(e), false);
      }
    } catch (e) {
      console.warn("Motion permission:", e);
    }
  }

  async startCamera() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        this.videoStream = stream;
        if (this.cameraPreview) this.cameraPreview.srcObject = stream;
        this.camStatus?.classList.add("online");
        if (this.camFallbackMsg) this.camFallbackMsg.style.display = "none";
        this.log("Live mobile camera active", "success");
      } else {
        throw new Error("Camera API restricted over HTTP");
      }
    } catch (err) {
      this.camStatus?.classList.remove("online");
      if (this.camFallbackMsg) {
        this.camFallbackMsg.style.display = "flex";
        if (this.camNoticeText) {
          this.camNoticeText.innerText = "HTTP Mode: Tap 'Snap & Send Road Photo' above or simulation active";
        }
      }
      this.log(`Camera notice: ${err.message}. Synthetic road stream active.`, "info");
      this.startSyntheticRoadStream();
    }
  }

  startSyntheticRoadStream() {
    if (!this.simCanvas || !this.simCtx) return;
    this.simCanvas.style.display = "block";
    this.simCanvas.width = 480;
    this.simCanvas.height = 360;

    const render = () => {
      if (!this.isSensing || this.videoStream) return;
      this.simRoadOffset = (this.simRoadOffset + 8) % 60;
      
      const ctx = this.simCtx;
      const w = 480;
      const h = 360;

      // Horizon & Road
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, w, h * 0.45);
      ctx.fillStyle = "#334155";
      ctx.fillRect(0, h * 0.45, w, h * 0.55);

      // Yellow dashed lane lines
      ctx.strokeStyle = "#fbbf24";
      ctx.lineWidth = 4;
      ctx.setLineDash([20, 20]);
      ctx.lineDashOffset = -this.simRoadOffset;
      ctx.beginPath();
      ctx.moveTo(w / 2, h * 0.45);
      ctx.lineTo(w / 2 - 30, h);
      ctx.stroke();

      // Boundary lines
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(w * 0.2, h * 0.45);
      ctx.lineTo(20, h);
      ctx.moveTo(w * 0.8, h * 0.45);
      ctx.lineTo(w - 20, h);
      ctx.stroke();

      requestAnimationFrame(render);
    };

    render();
  }

  captureAndSendFrame() {
    try {
      let sourceEl = null;
      if (this.videoStream && this.cameraPreview && this.cameraPreview.videoWidth) {
        sourceEl = this.cameraPreview;
      } else if (this.simCanvas && this.simCanvas.style.display !== "none") {
        sourceEl = this.simCanvas;
      }

      if (!sourceEl) return;

      this.canvas.width = 480;
      this.canvas.height = 360;
      this.canvasCtx.drawImage(sourceEl, 0, 0, 480, 360);
      
      this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("bus_id", this.busId);
        formData.append("frame", blob, "mobile_frame.jpg");
        try {
          await fetch(`${this.backendUrl}/stream/frame`, {
            method: "POST",
            body: formData
          });
        } catch (e) {}
      }, "image/jpeg", 0.7);
    } catch (e) {}
  }

  handleNativePhotoSnap(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    this.log(`Photo captured (${(file.size / 1024).toFixed(1)} KB), uploading...`, "info");
    const formData = new FormData();
    formData.append("bus_id", this.busId);
    formData.append("frame", file, "road_snap.jpg");

    fetch(`${this.backendUrl}/stream/frame`, {
      method: "POST",
      body: formData
    }).then(res => {
      if (res.ok) {
        this.log("Road photo uploaded and AI evaluated", "success");
      }
    }).catch(() => {
      this.log("Upload failed. Check server link.", "warn");
    });
  }

  startGps() {
    if ("geolocation" in navigator && !this.simulatingGps) {
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.currentLat = pos.coords.latitude;
          this.currentLon = pos.coords.longitude;
          this.accuracy = pos.coords.accuracy || 3.5;
          this.speed = (pos.coords.speed || 8.0) * 3.6; // m/s to km/h
          this.updateDisplay();
          this.gpsStatus?.classList.add("online");
        },
        (err) => {
          this.log("Physical GPS fallback to simulated corridor.", "warn");
          this.toggleGpsSimulation(true);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
      );
    } else {
      this.toggleGpsSimulation(true);
    }
  }

  toggleGpsSimulation(force = null) {
    if (force !== null) {
      this.simulatingGps = force;
    } else {
      this.simulatingGps = !this.simulatingGps;
    }

    if (this.simulatingGps) {
      if (this.simGpsBtn) {
        this.simGpsBtn.classList.add("active");
        this.simGpsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg>
          <span>Route GPS (Active)</span>
        `;
      }
      this.gpsStatus?.classList.add("online");
      this.log("Transit route simulation active", "info");
      this.stepSimulatedGps();
    } else {
      if (this.simGpsBtn) {
        this.simGpsBtn.classList.remove("active");
        this.simGpsBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon></svg>
          <span>Simulate Route GPS</span>
        `;
      }
      this.log("Route simulation disabled", "info");
    }
  }

  stepSimulatedGps() {
    const p = this.routeWaypoints[this.waypointIdx];
    const jLat = (Math.random() - 0.5) * 0.0001;
    const jLon = (Math.random() - 0.5) * 0.0001;
    this.currentLat = parseFloat((p[0] + jLat).toFixed(6));
    this.currentLon = parseFloat((p[1] + jLon).toFixed(6));
    this.accuracy = 3.2;
    this.speed = parseFloat((26.0 + Math.random() * 8.0).toFixed(1));
    this.updateDisplay();

    this.waypointIdx = (this.waypointIdx + 1) % this.routeWaypoints.length;
  }

  handleDeviceMotion(e) {
    if (e.accelerationIncludingGravity) {
      this.imu.ax = parseFloat((e.accelerationIncludingGravity.x || 0).toFixed(2));
      this.imu.ay = parseFloat((e.accelerationIncludingGravity.y || 0).toFixed(2));
      this.imu.az = parseFloat((e.accelerationIncludingGravity.z || 9.81).toFixed(2));
      this.updateDisplay();

      // Check physical bump shock
      const totalAccel = Math.abs(this.imu.ax) + Math.abs(this.imu.ay) + Math.abs(this.imu.az - 9.81);
      if (totalAccel > 12.0) {
        this.triggerRoadBump();
      }
    }
  }

  triggerRoadBump() {
    this.imu.az = 17.4;
    if (this.imuVal) {
      this.imuVal.innerText = `${this.imu.az.toFixed(2)} m/s² (Shock)`;
      this.imuVal.style.color = "#ef4444";
    }
    this.log(`Road shock injected (17.4 m/s²)`, "bump");

    this.sendTelemetry();

    setTimeout(() => {
      this.imu.az = 9.81;
      if (this.imuVal) {
        this.imuVal.style.color = "#fff";
        this.updateDisplay();
      }
    }, 1500);
  }

  updateDisplay() {
    if (this.latVal) this.latVal.innerText = this.currentLat.toFixed(6);
    if (this.lonVal) this.lonVal.innerText = this.currentLon.toFixed(6);
    if (this.accVal) this.accVal.innerText = `±${this.accuracy.toFixed(1)} m`;
    if (this.speedVal) this.speedVal.innerText = `${this.speed.toFixed(1)} km/h`;
    if (this.imuVal) this.imuVal.innerText = `${this.imu.az.toFixed(2)} m/s²`;
  }

  async sendTelemetry() {
    if (this.simulatingGps) {
      this.stepSimulatedGps();
    }

    const payload = {
      bus_id: this.busId,
      latitude: this.currentLat,
      longitude: this.currentLon,
      accuracy: this.accuracy,
      speed: this.speed,
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

// Instantiate upon load
window.addEventListener("DOMContentLoaded", () => {
  window.edgeUnit = new GartikaMobileEdgeUnit();
});
