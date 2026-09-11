/**
 * Fleet Manager & Real-Time Telemetry HUD for Gartika Dashboard.
 */

class BusManager {
  constructor() {
    this.metricActiveBuses = document.getElementById("metricActiveBuses");
    this.metricBusId = document.getElementById("metricBusId");
    this.metricBusBadge = document.getElementById("metricBusBadge");
    this.metricRoadDefects = document.getElementById("metricRoadDefects");
    this.metricVehicles = document.getElementById("metricVehicles");
    this.metricHighPriority = document.getElementById("metricHighPriority");

    this.teleLat = document.getElementById("teleLat");
    this.teleLon = document.getElementById("teleLon");
    this.teleSpeed = document.getElementById("teleSpeed");
    this.imuValStatus = document.getElementById("imuValStatus");
    this.hudBusTag = document.getElementById("hudBusTag");
  }

  updateStats(stats) {
    if (!stats) return;
    if (this.metricActiveBuses) this.metricActiveBuses.innerHTML = `${stats.active_buses || 0} <span class="metric-unit">Units</span>`;
    if (this.metricRoadDefects) this.metricRoadDefects.innerText = stats.road_defects || 0;
    if (this.metricHighPriority) {
      const verified = stats.verified_defects || 0;
      this.metricHighPriority.innerText = `${verified} Verified`;
    }
    if (this.metricVehicles) this.metricVehicles.innerHTML = `${stats.vehicles_detected || 0} <span class="metric-unit">Vehicles</span>`;
  }

  updateTelemetry(tel) {
    if (!tel) return;
    if (this.teleLat) this.teleLat.innerText = tel.latitude !== null && tel.latitude !== undefined ? tel.latitude.toFixed(4) : "--";
    if (this.teleLon) this.teleLon.innerText = tel.longitude !== null && tel.longitude !== undefined ? tel.longitude.toFixed(4) : "--";
    if (this.teleSpeed) this.teleSpeed.innerText = `${(tel.speed || 0.0).toFixed(1)} km/h`;

    const az = tel.az !== undefined ? tel.az : 9.81;
    if (this.imuValStatus) {
      if (Math.abs(az - 9.81) > 3.0 || az > 13.5) {
        this.imuValStatus.innerHTML = `<span style="color:var(--accent-red); font-weight:700;">${az.toFixed(2)} m/s² (Bump)</span>`;
      } else {
        this.imuValStatus.innerText = `${az.toFixed(2)} m/s²`;
      }
    }

    if (this.metricBusId) this.metricBusId.innerText = `${tel.bus_id || "BUS-101"} (Active)`;
    if (this.metricBusBadge) this.metricBusBadge.innerText = "Online";
    if (this.hudBusTag) this.hudBusTag.innerText = `${tel.bus_id || "BUS-101"} • Live Phone Feed`;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { BusManager };
}
