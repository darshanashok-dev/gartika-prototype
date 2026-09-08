// Gartika Edge Unit - Mobile Sensing Application
class GartikaEdgeUnit {
  constructor() {
    this.busId = "BUS-101";
    this.isSensing = false;
    this.simulatingGps = false;
    this.backendUrl = window.location.origin;
    
    // Telemetry state
    this.currentLat = 12.971598;
    this.currentLon = 77.594562;
    this.accuracy = 4.0;
    this.speed = 30.5;
    this.imu = { ax: 0.1, ay: 0.2, az: 9.81 };
    
    // Route simulation waypoints (Bangalore transit corridor)
    this.routeWaypoints = [
      [12.971598, 77.594562], // MG Road Metro
      [12.972854, 77.601243], // Trinity Circle
      [12.975412, 77.615234], // Halasuru Lake
      [12.978120, 77.632410], // Indiranagar 100ft Rd
      [12.981045, 77.641200]  // CMH Road Junction
    ];
    this.waypointIdx = 0;
    
    // Interval timers
    this.telemetryTimer = null;
    this.frameTimer = null;
    this.gpsWatchId = null;
    this.videoStream = null;
    this.canvas = document.createElement("canvas");
    this.canvasCtx = this.canvas.getContext("2d");

    this.initElements();
    this.bindEvents();
    this.checkNetwork();
  }

  initElements() {
    this.busIdInput = document.getElementById("busIdInput");
    this.camStatus = document.getElementById("camStatus");
    this.gpsStatus = document.getElementById("gpsStatus");
    this.netStatus = document.getElementById("netStatus");
    this.cameraPreview = document.getElementById("cameraPreview");
    this.camFallbackMsg = document.getElementById("camFallbackMsg");
    this.latVal = document.getElementById("latVal");
    this.lonVal = document.getElementById("lonVal");
    this.accVal = document.getElementById("accVal");
    this.speedVal = document.getElementById("speedVal");
    this.imuVal = document.getElementById("imuVal");
    this.toggleBtn = document.getElementById("toggleBtn");
    this.simGpsBtn = document.getElementById("simGpsBtn");
    this.triggerBumpBtn = document.getElementById("triggerBumpBtn");
    this.logStream = document.getElementById("logStream");
    this.connectionTarget = document.getElementById("connectionTarget");
    
    this.connectionTarget.innerText = `Host: ${this.backendUrl}`;
  }

  bindEvents() {
    this.busIdInput.addEventListener("change", (e) => {
      this.busId = e.target.value.trim().toUpperCase() || "BUS-101";
      this.log(`Device ID configured to ${this.busId}`, "info");
    });

    this.toggleBtn.addEventListener("click", () => this.toggleSensing());
    this.simGpsBtn.addEventListener("click", () => this.toggleGpsSimulation());
    this.triggerBumpBtn.addEventListener("click", () => this.triggerRoadBump());

    // Listen for motion events on devices that support them
    if (window.DeviceMotionEvent) {
      window.addEventListener("devicemotion", (e) => this.handleDeviceMotion(e), false);
    }
  }

  log(msg, type = "info") {
    const el = document.createElement("div");
    const ts = new Date().toLocaleTimeString();
    el.className = `log-line ${type}`;
    el.innerText = `[${ts}] ${msg}`;
    this.logStream.appendChild(el);
    this.logStream.scrollTop = this.logStream.scrollHeight;
  }

  async checkNetwork() {
    try {
      const res = await fetch(`${this.backendUrl}/health`);
      if (res.ok) {
        this.netStatus.classList.add("online");
        this.log("Connected to Gartika Platform backend", "success");
      }
    } catch (e) {
      this.netStatus.classList.remove("online");
      this.log("Backend offline or unreachable. Retrying...", "warn");
    }
  }

  async toggleSensing() {
    if (!this.isSensing) {
      this.startSensing();
    } else {
      this.stopSensing();
    }
  }

  async startSensing() {
    this.isSensing = true;
    this.toggleBtn.classList.add("active");
    this.toggleBtn.innerHTML = `<span>⏹ STOP SENSING</span>`;
    this.log(`Started sensing pipeline on ${this.busId}`, "success");

    // Start Camera
    await this.startCamera();

    // Start GPS
    this.startGps();

    // Start Telemetry reporting interval (every 2s)
    this.telemetryTimer = setInterval(() => this.sendTelemetry(), 2000);
    this.sendTelemetry();

    // Start live frame snapshot streaming (every 1s)
    this.frameTimer = setInterval(() => this.captureAndSendFrame(), 1000);
  }

  stopSensing() {
    this.isSensing = false;
    this.toggleBtn.classList.remove("active");
    this.toggleBtn.innerHTML = `<span>⚡ START SENSING</span>`;
    this.log(`Sensing pipeline stopped`, "warn");

    // Stop Camera
    if (this.videoStream) {
      this.videoStream.getTracks().forEach((track) => track.stop());
      this.videoStream = null;
      this.cameraPreview.srcObject = null;
    }
    this.camStatus.classList.remove("online");
    this.camFallbackMsg.style.display = "block";

    // Stop GPS
    if (this.gpsWatchId !== null) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    this.gpsStatus.classList.remove("online");

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

  async startCamera() {
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        this.videoStream = stream;
        this.cameraPreview.srcObject = stream;
        this.camStatus.classList.add("online");
        this.camFallbackMsg.style.display = "none";
        this.log("Mobile camera feed active", "success");
      } else {
        throw new Error("Camera API unavailable in this browser context");
      }
    } catch (err) {
      this.camStatus.classList.remove("online");
      this.camFallbackMsg.style.display = "block";
      this.log(`Camera notice: ${err.message}. Using synthetic stream fallback.`, "warn");
    }
  }

  captureAndSendFrame() {
    if (!this.videoStream || !this.cameraPreview.videoWidth) return;
    try {
      this.canvas.width = 480;
      this.canvas.height = 360;
      this.canvasCtx.drawImage(this.cameraPreview, 0, 0, 480, 360);
      this.canvas.toBlob(async (blob) => {
        if (!blob) return;
        const formData = new FormData();
        formData.append("bus_id", this.busId);
        formData.append("frame", blob, "frame.jpg");
        try {
          await fetch(`${this.backendUrl}/stream/frame`, {
            method: "POST",
            body: formData
          });
        } catch (e) {}
      }, "image/jpeg", 0.7);
    } catch (e) {}
  }

  startGps() {
    if ("geolocation" in navigator && !this.simulatingGps) {
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          this.currentLat = pos.coords.latitude;
          this.currentLon = pos.coords.longitude;
          this.accuracy = pos.coords.accuracy || 5.0;
          this.speed = (pos.coords.speed || 8.5) * 3.6; // convert m/s to km/h
          this.updateDisplay();
          this.gpsStatus.classList.add("online");
        },
        (err) => {
          this.log(`GPS denied or indoor: Falling back to simulated route.`, "warn");
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
      this.simGpsBtn.classList.add("active");
      this.simGpsBtn.innerHTML = `<span>📍 SIM GPS (ACTIVE)</span>`;
      this.gpsStatus.classList.add("online");
      this.log("Route simulation active along Bangalore MG Rd corridor", "info");
      this.stepSimulatedGps();
    } else {
      this.simGpsBtn.classList.remove("active");
      this.simGpsBtn.innerHTML = `<span>📍 SIMULATE ROUTE GPS</span>`;
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
    this.speed = parseFloat((26.0 + Math.random() * 12.0).toFixed(1));
    this.updateDisplay();

    this.waypointIdx = (this.waypointIdx + 1) % this.routeWaypoints.length;
  }

  handleDeviceMotion(e) {
    if (e.accelerationIncludingGravity) {
      this.imu.ax = parseFloat((e.accelerationIncludingGravity.x || 0).toFixed(2));
      this.imu.ay = parseFloat((e.accelerationIncludingGravity.y || 0).toFixed(2));
      this.imu.az = parseFloat((e.accelerationIncludingGravity.z || 9.81).toFixed(2));
      this.updateDisplay();
    }
  }

  triggerRoadBump() {
    this.imu.az = 16.8;
    this.imuVal.innerText = `${this.imu.az.toFixed(2)} m/s² (SHOCK!)`;
    this.imuVal.style.color = "#ef4444";
    this.log(`💥 SIMULATED ROAD BUMP (Z-Shock: 16.8 m/s²)`, "bump");

    this.sendTelemetry();

    setTimeout(() => {
      this.imu.az = 9.81;
      this.imuVal.style.color = "#fff";
      this.updateDisplay();
    }, 1500);
  }

  updateDisplay() {
    this.latVal.innerText = this.currentLat.toFixed(6);
    this.lonVal.innerText = this.currentLon.toFixed(6);
    this.accVal.innerText = `±${this.accuracy.toFixed(1)} m`;
    this.speedVal.innerText = `${this.speed.toFixed(1)} km/h`;
    this.imuVal.innerText = `${this.imu.az.toFixed(2)} m/s²`;
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
        this.netStatus.classList.add("online");
      }
    } catch (e) {
      this.netStatus.classList.remove("online");
    }
  }
}

// Instantiate upon load
window.addEventListener("DOMContentLoaded", () => {
  window.edgeUnit = new GartikaEdgeUnit();
});
