/**
 * Defect Inspector & Work Order Creation Modal Component for Gartika Dashboard.
 */

class EventModal {
  constructor(apiClient, toastManager, onWorkOrderCreated = () => {}) {
    this.api = apiClient;
    this.toast = toastManager;
    this.onWorkOrderCreated = onWorkOrderCreated;
    this.modal = document.getElementById("eventModal");
    this.modalSeverityTag = document.getElementById("modalSeverityTag");
    this.modalEventTitle = document.getElementById("modalEventTitle");
    this.modalEventId = document.getElementById("modalEventId");
    this.modalEvidenceImg = document.getElementById("modalEvidenceImg");
    this.modalEvidenceFallback = document.getElementById("modalEvidenceFallback");
    this.modalEventType = document.getElementById("modalEventType");
    this.modalConfidence = document.getElementById("modalConfidence");
    this.modalBusId = document.getElementById("modalBusId");
    this.modalLocation = document.getElementById("modalLocation");
    this.modalTimestamp = document.getElementById("modalTimestamp");
    this.modalVibration = document.getElementById("modalVibration");
    this.btnCreateWorkOrder = document.getElementById("btnCreateWorkOrder");
    this.currentDefect = null;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById("modalCloseBtn")?.addEventListener("click", () => this.close());
    document.getElementById("modalDismissBtn")?.addEventListener("click", () => this.close());
    this.btnCreateWorkOrder?.addEventListener("click", () => this.dispatchWorkOrder());
  }

  open(defect) {
    if (!defect) return;
    this.currentDefect = defect;

    const type = defect.defect_type || defect.event_type || "POTHOLE";
    const id = defect.defect_id || defect.event_id;
    const severity = defect.severity || "MEDIUM";
    const conf = Math.round((defect.confidence || defect.best_confidence || 0.85) * 100);
    const busCount = defect.unique_bus_count || 1;
    const obsCount = defect.observation_count || 1;

    if (this.modalEventTitle) this.modalEventTitle.innerText = `${type} Hazard Inspection`;
    if (this.modalEventId) this.modalEventId.innerText = `${id} (${obsCount} Observations, ${busCount} Buses)`;
    if (this.modalEventType) this.modalEventType.innerText = type;
    if (this.modalConfidence) this.modalConfidence.innerText = `${conf}% (${defect.status || "UNVERIFIED"})`;
    if (this.modalBusId) this.modalBusId.innerText = defect.bus_id || (defect.verifying_buses ? defect.verifying_buses.join(", ") : "BUS-101");
    if (this.modalLocation) {
      this.modalLocation.innerText = (defect.latitude && defect.longitude)
        ? `${defect.latitude.toFixed(5)}, ${defect.longitude.toFixed(5)}`
        : "Awaiting GPS";
    }
    if (this.modalTimestamp) {
      this.modalTimestamp.innerText = defect.timestamp || defect.last_seen
        ? new Date(defect.timestamp || defect.last_seen).toLocaleString()
        : "Just now";
    }
    if (this.modalVibration) {
      const vib = defect.vibration_level || "NORMAL";
      this.modalVibration.innerText = vib === "HIGH" ? "IMU Shock Corroborated (HIGH)" : "Visual Perception Baseline";
    }
    if (this.modalSeverityTag) {
      this.modalSeverityTag.innerText = `${severity} SEVERITY • ${defect.status || "NEW"}`;
      this.modalSeverityTag.className = (severity === "HIGH" || severity === "CRITICAL") ? "badge badge-red" : "badge badge-amber";
    }

    const imgPath = defect.evidence_image_url || defect.evidence_path || defect.latest_evidence_path;
    if (this.modalEvidenceImg) {
      if (imgPath) {
        this.modalEvidenceImg.src = `${window.location.origin}${imgPath}`;
        this.modalEvidenceImg.style.display = "block";
        if (this.modalEvidenceFallback) this.modalEvidenceFallback.style.display = "none";
      } else {
        this.modalEvidenceImg.style.display = "none";
        if (this.modalEvidenceFallback) this.modalEvidenceFallback.style.display = "flex";
      }
    }

    if (this.modal) this.modal.classList.add("open");
  }

  close() {
    if (this.modal) this.modal.classList.remove("open");
    this.currentDefect = null;
  }

  async dispatchWorkOrder() {
    if (!this.currentDefect) return;
    const d = this.currentDefect;
    const type = d.defect_type || d.event_type || "POTHOLE";

    try {
      const payload = {
        event_id: d.event_id || null,
        defect_id: d.defect_id || null,
        title: `Civic Repair: ${type} (${d.status || "VERIFIED"})`,
        priority: d.severity || "HIGH",
        assigned_to: "BBMP Road Infrastructure Rapid Response",
        latitude: d.latitude,
        longitude: d.longitude,
        location_name: d.location_name || "Urban Transit Corridor"
      };

      const wo = await this.api.createWorkOrder(payload);
      if (wo) {
        this.toast.show("Repair work order dispatched successfully!", "success");
        this.close();
        this.onWorkOrderCreated(wo);
      } else {
        this.toast.show("Work order created / updated", "info");
        this.close();
      }
    } catch (e) {
      this.toast.show("Failed to dispatch work order", "warn");
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { EventModal };
}
