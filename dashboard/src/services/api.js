/**
 * REST API Client Service for Gartika Urban Intelligence Dashboard.
 * 
 * Centralizes all HTTP asynchronous requests to the FastAPI backend
 * for querying system health, telemetry statistics, events, buses, and work orders.
 */

const API_BASE = window.location.origin;

export const api = {
  /**
   * Check backend health and microservice connectivity status.
   * @returns {Promise<Object>} System health report.
   */
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  /**
   * Retrieve high-level summary KPIs (active buses, defects count, bandwidth savings).
   * @returns {Promise<Object>} Aggregated metrics object.
   */
  async getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },

  /**
   * Fetch recent AI detected events with optional pagination limit.
   * @param {number} limit - Maximum number of event records to fetch (default: 50).
   * @returns {Promise<Array<Object>>} List of event objects.
   */
  async getEvents(limit = 50) {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    return res.json();
  },

  /**
   * Retrieve single event details by its event_id.
   * @param {string} id - Event identifier.
   * @returns {Promise<Object>} Event record.
   */
  async getEvent(id) {
    const res = await fetch(`${API_BASE}/events/${id}`);
    return res.json();
  },

  /**
   * Partially update an event's status or severity.
   * @param {string} id - Event identifier.
   * @param {Object} data - Update payload (e.g. { status: 'RESOLVED' }).
   * @returns {Promise<Object>} Updated event record.
   */
  async updateEvent(id, data) {
    const res = await fetch(`${API_BASE}/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  /**
   * Fetch all registered transit sensing buses.
   * @returns {Promise<Array<Object>>} List of bus objects.
   */
  async getBuses() {
    const res = await fetch(`${API_BASE}/buses`);
    return res.json();
  },

  /**
   * Fetch all municipal maintenance work orders.
   * @returns {Promise<Array<Object>>} List of work order items.
   */
  async getWorkOrders() {
    const res = await fetch(`${API_BASE}/work-orders`);
    return res.json();
  },

  /**
   * Create and dispatch a new road repair work order.
   * @param {Object} data - Work order creation payload.
   * @returns {Promise<Object>} Created work order entity.
   */
  async createWorkOrder(data) {
    const res = await fetch(`${API_BASE}/work-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  /**
   * Update work order progress status or assigned team.
   * @param {string} id - Work order identifier.
   * @param {Object} data - Update fields (e.g. { status: 'IN PROGRESS' }).
   * @returns {Promise<Object>} Updated work order entity.
   */
  async updateWorkOrder(id, data) {
    const res = await fetch(`${API_BASE}/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};
