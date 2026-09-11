/**
 * Mobile Edge HUD & User Interface Handler for Gartika.
 */

class MobileUI {
  constructor() {
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
  }

  log(msg, type = "info") {
    if (!this.logStream) return;
    const el = document.createElement("div");
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    el.className = `log-line ${type}`;
    el.innerText = `[${ts}] ${msg}`;
    this.logStream.appendChild(el);
    this.logStream.scrollTop = this.logStream.scrollHeight;
  }

  updateConnectionState(state, pingMs = null) {
    if (this.netStatus) {
      if (state === "CONNECTED") {
        this.netStatus.className = "status-pill online";
      } else if (state === "CONNECTING" || state === "RECONNECTING") {
        this.netStatus.className = "status-pill";
      } else {
        this.netStatus.className = "status-pill";
      }
    }
    if (pingMs !== null && this.hudPing) {
      this.hudPing.innerText = `${pingMs}ms`;
    }
  }

  updateTelemetryDisplay(gps, imu, packetCount) {
    if (this.latVal) this.latVal.innerText = (gps && gps.latitude !== null) ? gps.latitude.toFixed(6) : "--";
    if (this.lonVal) this.lonVal.innerText = (gps && gps.longitude !== null) ? gps.longitude.toFixed(6) : "--";
    if (this.accVal) this.accVal.innerText = (gps && gps.accuracy !== null) ? `±${gps.accuracy.toFixed(1)} m` : "--";
    if (this.speedVal) this.speedVal.innerText = `${(gps ? gps.speed : 0.0).toFixed(1)} km/h`;
    if (this.imuVal) this.imuVal.innerText = `${(imu ? imu.az : 9.81).toFixed(2)} m/s²`;
    if (this.hudPackets) this.hudPackets.innerText = packetCount;
  }

  setSensingState(isActive) {
    if (this.toggleBtn) {
      if (isActive) {
        this.toggleBtn.classList.add("active");
        this.toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="6" y="6" width="12" height="12"></rect></svg>
          <span>Stop Sensing</span>
        `;
      } else {
        this.toggleBtn.classList.remove("active");
        this.toggleBtn.innerHTML = `
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Start Sensing</span>
        `;
      }
    }
    if (this.ingestMode) {
      this.ingestMode.innerText = isActive ? "ACTIVE" : "STANDBY";
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MobileUI };
}
