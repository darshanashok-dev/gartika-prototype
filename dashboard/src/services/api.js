const API_BASE = window.location.origin;

export const api = {
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    return res.json();
  },

  async getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    return res.json();
  },

  async getEvents(limit = 50) {
    const res = await fetch(`${API_BASE}/events?limit=${limit}`);
    return res.json();
  },

  async getEvent(id) {
    const res = await fetch(`${API_BASE}/events/${id}`);
    return res.json();
  },

  async updateEvent(id, data) {
    const res = await fetch(`${API_BASE}/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async getBuses() {
    const res = await fetch(`${API_BASE}/buses`);
    return res.json();
  },

  async getWorkOrders() {
    const res = await fetch(`${API_BASE}/work-orders`);
    return res.json();
  },

  async createWorkOrder(data) {
    const res = await fetch(`${API_BASE}/work-orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  },

  async updateWorkOrder(id, data) {
    const res = await fetch(`${API_BASE}/work-orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return res.json();
  }
};
