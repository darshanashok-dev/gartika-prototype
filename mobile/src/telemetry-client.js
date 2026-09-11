/**
 * Telemetry Ingestion Client for Gartika Mobile Edge.
 */

class TelemetryClient {
  constructor(baseUrl, offlineQueue) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.queue = offlineQueue;
    this.packetCount = 0;
  }

  async sendTelemetry(busId, gpsData, imuData) {
    if (!gpsData || gpsData.latitude === null || gpsData.longitude === null) {
      return false;
    }

    const payload = {
      bus_id: busId,
      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      accuracy: gpsData.accuracy || 5.0,
      speed: gpsData.speed || 0.0,
      heading: gpsData.heading || null,
      ax: imuData.ax || 0.0,
      ay: imuData.ay || 0.0,
      az: imuData.az || 9.81,
      timestamp: new Date().toISOString()
    };

    try {
      const res = await fetch(`${this.baseUrl}/telemetry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        this.packetCount++;
        // Attempt flushing any offline-queued items
        if (this.queue) {
          this.queue.flush(this.baseUrl);
        }
        return true;
      } else {
        // Enqueue offline if server returns error or client is disconnected
        if (this.queue) {
          await this.queue.enqueue("/telemetry", payload);
        }
        return false;
      }
    } catch (e) {
      // Enqueue offline during network drop
      if (this.queue) {
        await this.queue.enqueue("/telemetry", payload);
      }
      return false;
    }
  }

  async uploadFrame(busId, blob) {
    const formData = new FormData();
    formData.append("bus_id", busId);
    formData.append("frame", blob, `live_frame_${Date.now()}.jpg`);

    try {
      const res = await fetch(`${this.baseUrl}/stream/frame`, {
        method: "POST",
        body: formData
      });
      return res.ok;
    } catch (e) {
      return false;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TelemetryClient };
}
