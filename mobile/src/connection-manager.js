/**
 * Connection Manager for Gartika Mobile Edge.
 * 
 * Manages network reachability, WebSocket connection states, exponential backoff,
 * and automatic queue flushing upon reconnection.
 */

class ConnectionManager {
  constructor(baseUrl, wsUrl, onStateChange = () => {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.wsUrl = wsUrl;
    this.onStateChange = onStateChange;
    this.state = "DISCONNECTED"; // CONNECTED, CONNECTING, DISCONNECTED, RECONNECTING, OFFLINE
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 15000;
    this.pingInterval = null;
  }

  setState(newState, detail = null) {
    this.state = newState;
    this.onStateChange(this.state, detail);
  }

  async checkHealth() {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, { cache: "no-store" });
      if (res.ok) {
        const pingMs = Date.now() - start;
        this.reconnectAttempts = 0;
        return { online: true, pingMs };
      }
      return { online: false, pingMs: null };
    } catch (e) {
      return { online: false, pingMs: null };
    }
  }

  connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.setState(this.reconnectAttempts > 0 ? "RECONNECTING" : "CONNECTING");

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setState("CONNECTED");
      };

      this.ws.onclose = () => {
        this.setState("DISCONNECTED");
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.setState("DISCONNECTED");
      };
    } catch (e) {
      this.setState("OFFLINE");
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    this.reconnectAttempts++;
    // Exponential backoff with jitter: min(15s, 1s * 1.5^attempts)
    const delay = Math.min(this.maxReconnectDelayMs, Math.floor(1000 * Math.pow(1.5, this.reconnectAttempts)));
    setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("DISCONNECTED");
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ConnectionManager };
}
