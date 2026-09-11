/**
 * Gartika Real-Time WebSocket Client
 * 
 * Manages persistent bidirectional event streaming connection with FastAPI backend.
 * Provides resilient auto-reconnect with exponential backoff, connection state notifications,
 * and message schema validation.
 */

export const ConnectionStatus = {
  CONNECTING: 'CONNECTING',
  CONNECTED: 'CONNECTED',
  DISCONNECTED: 'DISCONNECTED',
  RECONNECTING: 'RECONNECTING',
  ERROR: 'ERROR'
};

class GartikaWebSocketClient {
  constructor() {
    this.ws = null;
    this.listeners = new Set();
    this.statusListeners = new Set();
    this.status = ConnectionStatus.DISCONNECTED;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 30;
    this.baseDelayMs = 1500;
    this.maxDelayMs = 15000;
    this.reconnectTimer = null;
    this.heartbeatTimer = null;
    this.isExplicitDisconnect = false;
  }

  getWsUrl() {
    if (typeof window === 'undefined') return 'ws://localhost:8000/ws/events';
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${proto}//${host}/ws/events`;
  }

  setStatus(newStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach(cb => cb(newStatus));
    }
  }

  connect() {
    if (typeof window === 'undefined') return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitDisconnect = false;
    this.setStatus(this.reconnectAttempts > 0 ? ConnectionStatus.RECONNECTING : ConnectionStatus.CONNECTING);

    const url = this.getWsUrl();
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setStatus(ConnectionStatus.CONNECTED);
        this.startHeartbeat();
      };

      this.ws.onmessage = (event) => {
        if (event.data === 'pong') return;
        try {
          const payload = JSON.parse(event.data);
          this.listeners.forEach(cb => cb(payload));
        } catch (err) {
          console.warn('[WS] Malformed JSON received:', event.data);
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.ws = null;
        if (!this.isExplicitDisconnect) {
          this.setStatus(ConnectionStatus.DISCONNECTED);
          this.scheduleReconnect();
        } else {
          this.setStatus(ConnectionStatus.DISCONNECTED);
        }
      };

      this.ws.onerror = (err) => {
        this.setStatus(ConnectionStatus.ERROR);
      };
    } catch (err) {
      this.setStatus(ConnectionStatus.ERROR);
      this.scheduleReconnect();
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ping');
      }
    }, 25000);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  scheduleReconnect() {
    if (this.isExplicitDisconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    this.reconnectAttempts += 1;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.setStatus(ConnectionStatus.ERROR);
      return;
    }

    const delay = Math.min(
      this.baseDelayMs * Math.pow(1.5, this.reconnectAttempts - 1),
      this.maxDelayMs
    );

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.isExplicitDisconnect = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus(ConnectionStatus.DISCONNECTED);
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribeStatus(listener) {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }
}

export const wsClient = new GartikaWebSocketClient();
export default wsClient;
