/**
 * Connection Manager for Gartika Mobile Edge.
 * 
 * Features:
 * - Distinct tracking of:
 *   - Internet (navigator.onLine)
 *   - Backend Reachability (HTTP /health probe & RTT latency)
 *   - WebSocket Connection (/ws/events state)
 * - Single-timer exponential backoff reconnect without duplicate interval storms.
 * - Automatic queue flush trigger on backend recovery.
 */

class ConnectionManager {
  constructor(baseUrl, wsUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.wsUrl = wsUrl;
    this.onStateChange = options.onStateChange || (() => {});
    this.onBackendRestored = options.onBackendRestored || (() => {});
    
    this.internetOnline = navigator.onLine;
    this.backendOnline = false;
    this.wsConnected = false;
    this.rttMs = null;
    this.reconnectAttempts = 0;
    this.maxReconnectDelayMs = 15000;
    
    this.ws = null;
    this.reconnectTimer = null;
    this.healthCheckTimer = null;

    this.bindWindowEvents();
  }

  bindWindowEvents() {
    window.addEventListener("online", () => {
      this.internetOnline = true;
      this.checkHealth();
      this.notifyState();
    });

    window.addEventListener("offline", () => {
      this.internetOnline = false;
      this.backendOnline = false;
      this.wsConnected = false;
      this.notifyState();
    });
  }

  notifyState() {
    let overallState = "ONLINE";
    if (!this.internetOnline) overallState = "OFFLINE";
    else if (!this.backendOnline) overallState = "RECONNECTING";
    else if (!this.wsConnected) overallState = "CONNECTING";

    this.onStateChange({
      state: overallState,
      internetOnline: this.internetOnline,
      backendOnline: this.backendOnline,
      wsConnected: this.wsConnected,
      rttMs: this.rttMs
    });
  }

  async checkHealth() {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/health`, { 
        cache: "no-store", 
        headers: { "Accept": "application/json" } 
      });
      if (res.ok) {
        this.rttMs = Date.now() - start;
        const wasOffline = !this.backendOnline;
        this.backendOnline = true;
        this.reconnectAttempts = 0;
        this.notifyState();

        if (wasOffline) {
          this.onBackendRestored();
        }
        return true;
      } else {
        this.backendOnline = false;
        this.notifyState();
        return false;
      }
    } catch (e) {
      this.backendOnline = false;
      this.rttMs = null;
      this.notifyState();
      return false;
    }
  }

  start() {
    this.checkHealth();
    this.connectWebSocket();

    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    this.healthCheckTimer = setInterval(() => {
      this.checkHealth();
    }, 5000);
  }

  connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      this.ws = new WebSocket(this.wsUrl);

      this.ws.onopen = () => {
        this.wsConnected = true;
        this.reconnectAttempts = 0;
        this.notifyState();
      };

      this.ws.onclose = () => {
        this.wsConnected = false;
        this.notifyState();
        this.scheduleReconnect();
      };

      this.ws.onerror = () => {
        this.wsConnected = false;
        this.notifyState();
      };
    } catch (e) {
      this.wsConnected = false;
      this.notifyState();
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimer) return; // Single-timer protection

    this.reconnectAttempts++;
    const delay = Math.min(this.maxReconnectDelayMs, Math.floor(1000 * Math.pow(1.5, this.reconnectAttempts)));
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.checkHealth();
      this.connectWebSocket();
    }, delay);
  }

  stop() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.wsConnected = false;
    this.notifyState();
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { ConnectionManager };
}
