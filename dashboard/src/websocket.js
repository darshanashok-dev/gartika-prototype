/**
 * Real-Time WebSocket Client for Gartika Dashboard.
 */

class DashboardWebSocket {
  constructor(wsUrl, onMessage = () => {}, onStatusChange = () => {}) {
    this.wsUrl = wsUrl;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
    this.ws = null;
    this.reconnectTimer = null;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.onStatusChange("online");
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          this.onMessage(payload);
        } catch (e) {}
      };

      this.ws.onerror = () => {
        this.onStatusChange("offline");
      };

      this.ws.onclose = () => {
        this.onStatusChange("offline");
        this.reconnectTimer = setTimeout(() => this.connect(), 4000);
      };
    } catch (e) {
      this.onStatusChange("offline");
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { DashboardWebSocket };
}
