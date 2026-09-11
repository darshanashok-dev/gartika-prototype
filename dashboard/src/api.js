/**
 * API Client Service for Gartika Command Center Dashboard.
 */

class GartikaApiClient {
  constructor(baseUrl = window.location.origin) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  async fetchHealth() {
    try {
      const res = await fetch(`${this.baseUrl}/health`);
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  async fetchStats() {
    try {
      const res = await fetch(`${this.baseUrl}/stats/summary`);
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  async fetchEvents(limit = 50) {
    try {
      const res = await fetch(`${this.baseUrl}/events?limit=${limit}`);
      return res.ok ? await res.json() : [];
    } catch (e) {
      return [];
    }
  }

  async fetchDefects(limit = 50) {
    try {
      const res = await fetch(`${this.baseUrl}/defects?limit=${limit}`);
      return res.ok ? await res.json() : [];
    } catch (e) {
      return [];
    }
  }

  async fetchDefectDetails(defectId) {
    try {
      const res = await fetch(`${this.baseUrl}/defects/${defectId}`);
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  async fetchWorkOrders() {
    try {
      const res = await fetch(`${this.baseUrl}/work-orders`);
      return res.ok ? await res.json() : [];
    } catch (e) {
      return [];
    }
  }

  async fetchLatestTelemetry(busId = "BUS-101") {
    try {
      const res = await fetch(`${this.baseUrl}/telemetry/latest?bus_id=${busId}`);
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  async createWorkOrder(payload) {
    const res = await fetch(`${this.baseUrl}/work-orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.ok ? await res.json() : null;
  }

  async updateWorkOrderStatus(woId, newStatus) {
    const res = await fetch(`${this.baseUrl}/work-orders/${woId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    return res.ok ? await res.json() : null;
  }

  async verifyRepair(defectId, busId = "BUS-101", isRepaired = true) {
    const res = await fetch(`${this.baseUrl}/defects/${defectId}/verify-repair?verified_by_bus_id=${busId}&is_repaired=${isRepaired}`, {
      method: "POST"
    });
    return res.ok ? await res.json() : null;
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { GartikaApiClient };
}
