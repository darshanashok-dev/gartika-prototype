/**
 * GIS Map Markers for Defect Hazards and Traffic Clusters.
 */

class MarkerManager {
  constructor(mapInstance, onInspectDefect = () => {}) {
    this.map = mapInstance;
    this.onInspectDefect = onInspectDefect;
    this.markers = {};
  }

  addOrUpdateDefectMarker(defect) {
    if (!this.map || !defect.latitude || !defect.longitude) return;
    const key = defect.defect_id || defect.event_id;
    if (this.markers[key]) return;

    const isVerified = defect.status === "VERIFIED" || defect.status === "HIGH_CONFIDENCE";
    const isRepaired = defect.status === "CLOSED" || defect.repair_status === "REPAIR_VERIFIED";
    const isTraffic = defect.event_type === "VEHICLE_COUNT" || defect.event_type === "TRAFFIC";

    let color = "#ef4444"; // Red for unverified/active pothole
    if (isRepaired) color = "#10b981"; // Green for verified repaired
    else if (isVerified) color = "#8b5cf6"; // Purple for multi-bus verified
    else if (isTraffic) color = "#f59e0b"; // Amber for traffic flow

    const icon = L.divIcon({
      className: "custom-event-icon",
      html: `<div class="marker-defect-dot" style="background: ${color};"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });

    const marker = L.marker([defect.latitude, defect.longitude], { icon }).addTo(this.map);
    const busCount = defect.unique_bus_count || 1;
    const statusText = defect.status || "NEW";

    marker.bindPopup(`
      <div style="font-size: 12px; padding: 4px; font-family: sans-serif;">
        <strong style="color: ${color};">${defect.defect_type || defect.event_type}</strong><br>
        Status: <strong>${statusText}</strong><br>
        Confirming Buses: <strong>${busCount} Unit(s)</strong><br>
        <a href="javascript:void(0)" onclick="window.gartikaApp.openEventModal('${key}')" style="color: #3b82f6; text-decoration: underline; font-weight: 600;">Inspect Defect</a>
      </div>
    `);

    this.markers[key] = marker;
  }

  clearAll() {
    Object.values(this.markers).forEach((m) => {
      if (this.map) this.map.removeLayer(m);
    });
    this.markers = {};
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { MarkerManager };
}
