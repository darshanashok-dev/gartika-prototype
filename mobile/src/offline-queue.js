/**
 * Offline-First IndexedDB Event & Telemetry Queue for Gartika Mobile Edge.
 * 
 * Features:
 * - Async readiness promise (await queue.ready()) to prevent startup race conditions.
 * - Monotonic sequence persistence across page reloads.
 * - Concurrency flush locking (single active flush process).
 * - Exponential backoff retry with configurable max retries and dead-letter queue.
 * - Unique idempotency keys per event.
 */

class OfflineQueue {
  constructor(options = {}) {
    this.dbName = options.dbName || "GartikaEdgeQueue";
    this.storeName = options.storeName || "pending_events";
    this.maxRetries = options.maxRetries || 5;
    this.maxItems = options.maxItems || 1000;
    this.db = null;
    this.isFlushing = false;
    this.isReady = false;
    
    // Persistent sequence counter initialized from localStorage or safe fallback
    const savedSeq = parseInt(localStorage.getItem("gartika_last_sequence") || "1000", 10);
    this.sequenceNumber = isNaN(savedSeq) ? 1000 : savedSeq;

    this._readyPromise = this.init();
  }

  async ready() {
    await this._readyPromise;
    return this.isReady;
  }

  async init() {
    return new Promise((resolve) => {
      if (!window.indexedDB) {
        console.warn("[Gartika Queue] IndexedDB not available in this environment.");
        this.isReady = false;
        resolve(null);
        return;
      }

      const request = indexedDB.open(this.dbName, 2);
      
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: "event_id" });
          store.createIndex("timestamp", "timestamp", { unique: false });
          store.createIndex("sequence_number", "sequence_number", { unique: false });
          store.createIndex("status", "status", { unique: false });
        }
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        this.isReady = true;
        resolve(this.db);
      };

      request.onerror = (e) => {
        console.warn("[Gartika Queue] IndexedDB open failed:", e);
        this.isReady = false;
        resolve(null);
      };
    });
  }

  getNextSequenceNumber() {
    this.sequenceNumber++;
    try {
      localStorage.setItem("gartika_last_sequence", this.sequenceNumber.toString());
    } catch (_) {}
    return this.sequenceNumber;
  }

  async enqueue(endpoint, payload, isBlob = false) {
    await this.ready();
    const seq = this.getNextSequenceNumber();
    const eventId = `EVT-Q-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

    const item = {
      event_id: eventId,
      endpoint: endpoint,
      payload: { ...payload, sequence_number: seq },
      sequence_number: seq,
      timestamp: new Date().toISOString(),
      retry_count: 0,
      next_retry_at: Date.now(),
      status: "PENDING",
      created_at: Date.now()
    };

    if (!this.db) {
      return item;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readwrite");
        const store = tx.objectStore(this.storeName);
        store.put(item);
        tx.oncomplete = () => resolve(item);
        tx.onerror = () => resolve(item);
      } catch (e) {
        resolve(item);
      }
    });
  }

  async getPending() {
    await this.ready();
    if (!this.db) return [];
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readonly");
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          const now = Date.now();
          // Filter items ready for retry and not dead-lettered
          const eligible = all.filter(item => item.status === "PENDING" && item.next_retry_at <= now);
          resolve(eligible);
        };
        req.onerror = () => resolve([]);
      } catch (e) {
        resolve([]);
      }
    });
  }

  async getCounts() {
    await this.ready();
    if (!this.db) return { pending: 0, failed: 0, total: 0 };
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readonly");
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          const pending = all.filter(i => i.status === "PENDING").length;
          const failed = all.filter(i => i.status === "FAILED").length;
          resolve({ pending, failed, total: all.length });
        };
        req.onerror = () => resolve({ pending: 0, failed: 0, total: 0 });
      } catch (e) {
        resolve({ pending: 0, failed: 0, total: 0 });
      }
    });
  }

  async remove(eventId) {
    await this.ready();
    if (!this.db) return false;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readwrite");
        const store = tx.objectStore(this.storeName);
        store.delete(eventId);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async markFailedOrBackoff(item) {
    await this.ready();
    if (!this.db) return;
    
    item.retry_count = (item.retry_count || 0) + 1;
    if (item.retry_count >= this.maxRetries) {
      item.status = "FAILED";
    } else {
      // Exponential backoff: 1.5s * 2^retries + jitter (max 30s)
      const delayMs = Math.min(30000, Math.floor(1500 * Math.pow(2, item.retry_count) + Math.random() * 500));
      item.next_retry_at = Date.now() + delayMs;
    }

    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readwrite");
        const store = tx.objectStore(this.storeName);
        store.put(item);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch (e) {
        resolve(false);
      }
    });
  }

  async flush(apiBaseUrl, onProgress = () => {}) {
    if (this.isFlushing) {
      return { status: "already_flushing", flushed: 0 };
    }

    await this.ready();
    const pending = await this.getPending();
    if (!pending || pending.length === 0) {
      return { status: "empty", flushed: 0 };
    }

    this.isFlushing = true;
    let flushedCount = 0;

    try {
      for (const item of pending) {
        try {
          const res = await fetch(`${apiBaseUrl.replace(/\/$/, "")}${item.endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(item.payload)
          });

          if (res.ok || res.status === 409) { // 409 Conflict = already received (idempotent)
            await this.remove(item.event_id);
            flushedCount++;
            onProgress(flushedCount, pending.length);
          } else {
            await this.markFailedOrBackoff(item);
          }
        } catch (netErr) {
          await this.markFailedOrBackoff(item);
          break; // Stop flushing this round if network is unreachable
        }
      }
    } finally {
      this.isFlushing = false;
    }

    return { status: "done", flushed: flushedCount };
  }

  async clearFailed() {
    await this.ready();
    if (!this.db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readwrite");
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          let cleared = 0;
          for (const item of all) {
            if (item.status === "FAILED") {
              store.delete(item.event_id);
              cleared++;
            }
          }
          tx.oncomplete = () => resolve(cleared);
        };
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }

  async retryFailed() {
    await this.ready();
    if (!this.db) return 0;
    return new Promise((resolve) => {
      try {
        const tx = this.db.transaction([this.storeName], "readwrite");
        const store = tx.objectStore(this.storeName);
        const req = store.getAll();
        req.onsuccess = () => {
          const all = req.result || [];
          let retried = 0;
          for (const item of all) {
            if (item.status === "FAILED") {
              item.status = "PENDING";
              item.retry_count = 0;
              item.next_retry_at = Date.now();
              store.put(item);
              retried++;
            }
          }
          tx.oncomplete = () => resolve(retried);
        };
        req.onerror = () => resolve(0);
      } catch (e) {
        resolve(0);
      }
    });
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { OfflineQueue };
}
