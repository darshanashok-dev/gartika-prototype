/**
 * Real-Time Defect Event Feed Component for Gartika Dashboard.
 */

class EventFeed {
  constructor(containerId = "eventFeedScroll", onSelectEvent = () => {}) {
    this.container = document.getElementById(containerId);
    this.onSelectEvent = onSelectEvent;
    this.filter = "ALL";
    this.events = [];
    this.baseUrl = window.location.origin;
  }

  setFilter(filterName) {
    this.filter = filterName;
    this.render();
  }

  setEvents(eventsList) {
    this.events = eventsList || [];
    this.render();
  }

  addEvent(event) {
    this.events.unshift(event);
    if (this.events.length > 60) this.events.pop();
    this.render();
  }

  render() {
    if (!this.container) return;

    let list = this.events;
    if (this.filter === "POTHOLE") {
      list = list.filter((e) => (e.event_type || e.defect_type) === "POTHOLE" || (e.event_type || e.defect_type) === "ROAD_DEFECT" || (e.event_type || e.defect_type) === "CRACK");
    } else if (this.filter === "VEHICLE_COUNT") {
      list = list.filter((e) => e.event_type === "VEHICLE_COUNT" || e.event_type === "TRAFFIC");
    } else if (this.filter === "HIGH") {
      list = list.filter((e) => e.severity === "HIGH" || e.severity === "CRITICAL" || e.status === "VERIFIED");
    }

    if (list.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <p>Awaiting live detections from mobile camera stream...</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = list.map((evt) => {
      const type = evt.event_type || evt.defect_type || "POTHOLE";
      const isHigh = evt.severity === "HIGH" || evt.severity === "CRITICAL";
      const isVerified = evt.status === "VERIFIED" || evt.status === "HIGH_CONFIDENCE";
      const isRepaired = evt.status === "CLOSED" || evt.repair_status === "REPAIR_VERIFIED";

      let badgeCls = "badge-amber";
      if (isRepaired) badgeCls = "badge-green";
      else if (isVerified) badgeCls = "badge-purple";
      else if (isHigh) badgeCls = "badge-red";
      else if (type === "VEHICLE_COUNT") badgeCls = "badge-blue";

      const timeStr = evt.timestamp ? new Date(evt.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Live";
      const coordsStr = (evt.latitude && evt.longitude) ? `${evt.latitude.toFixed(4)}, ${evt.longitude.toFixed(4)}` : "GPS Ingesting";
      const thumb = evt.evidence_image_url || evt.evidence_path || evt.latest_evidence_path;
      const thumbUrl = thumb ? `${this.baseUrl}${thumb}` : 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%23222"><rect width="36" height="36"/></svg>';
      const confScore = Math.round((evt.confidence || evt.best_confidence || 0.85) * 100);
      const busCount = evt.unique_bus_count ? ` • ${evt.unique_bus_count} Buses` : "";
      const targetId = evt.defect_id || evt.event_id;

      return `
        <div class="event-card-item" onclick="window.gartikaApp.openEventModal('${targetId}')">
          <div class="event-item-left">
            <img class="event-thumb" src="${thumbUrl}" onerror="this.style.opacity=0.3" alt="Defect" />
            <div>
              <div class="event-title-line">
                <span class="badge ${badgeCls}">${type}</span>
                <span>${confScore}%</span>
                ${isVerified ? '<span class="badge-mini-verified">✓ Verified</span>' : ''}
              </div>
              <div class="event-sub-line font-mono">${coordsStr} • ${evt.bus_id || "BUS-101"}${busCount}</div>
            </div>
          </div>
          <div class="event-item-right font-mono text-muted" style="font-size: 0.68rem;">
            ${timeStr}
          </div>
        </div>
      `;
    }).join("");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EventFeed };
}
