/**
 * Gartika Centralized REST API Service Client
 * 
 * Provides unified HTTP methods for interacting with backend API v1 and compatibility endpoints.
 * Handles base URL derivation, request normalization, error propagation, and response parsing.
 */

const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000';

class ApiClient {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  /**
   * Generic fetch wrapper with timeout, JSON parsing, and unified error handling.
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const defaultHeaders = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const config = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    };

    // Remove Content-Type for FormData
    if (options.body instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) {
        let errorData = {};
        try {
          errorData = await response.json();
        } catch (_) {
          errorData = { detail: response.statusText || `HTTP ${response.status}` };
        }
        const message = errorData.detail || errorData.message || `Request failed with status ${response.status}`;
        const error = new Error(message);
        error.status = response.status;
        error.data = errorData;
        throw error;
      }

      // Handle 204 No Content
      if (response.status === 204) {
        return null;
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return await response.text();
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        const netErr = new Error('Backend server is unreachable. Please verify that FastAPI is running on port 8000.');
        netErr.status = 0;
        throw netErr;
      }
      throw err;
    }
  }

  // System & Telemetry
  async getHealth() {
    return this.request('/health');
  }

  async getStats() {
    return this.request('/api/v1/stats');
  }

  // Fleet Management
  async getBuses() {
    return this.request('/api/v1/buses');
  }

  async getBus(busId) {
    return this.request(`/api/v1/buses/${encodeURIComponent(busId)}`);
  }

  // Defects & AI Events
  async getEvents(params = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.skip) query.append('skip', params.skip);
    if (params.event_type) query.append('event_type', params.event_type);
    if (params.severity) query.append('severity', params.severity);
    if (params.bus_id) query.append('bus_id', params.bus_id);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/v1/events${qs}`);
  }

  async getEvent(eventId) {
    return this.request(`/api/v1/events/${encodeURIComponent(eventId)}`);
  }

  async updateEvent(eventId, updateData) {
    return this.request(`/api/v1/events/${encodeURIComponent(eventId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
  }

  async createEvent(eventData) {
    return this.request('/api/v1/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  }

  // Road Defects (Aggregated Entities)
  async getDefects(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.defect_type) query.append('defect_type', params.defect_type);
    if (params.severity) query.append('severity', params.severity);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/v1/defects${qs}`);
  }

  async getDefect(defectId) {
    return this.request(`/api/v1/defects/${encodeURIComponent(defectId)}`);
  }

  // Work Orders
  async getWorkOrders(params = {}) {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.priority) query.append('priority', params.priority);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/api/v1/work-orders${qs}`);
  }

  async getWorkOrder(workOrderId) {
    return this.request(`/api/v1/work-orders/${encodeURIComponent(workOrderId)}`);
  }

  async createWorkOrder(data) {
    return this.request('/api/v1/work-orders', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async updateWorkOrder(workOrderId, data) {
    return this.request(`/api/v1/work-orders/${encodeURIComponent(workOrderId)}`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  // Export URLs
  getExportCsvUrl() {
    return `${this.baseUrl}/api/v1/events/export/csv`;
  }
}

export const api = new ApiClient();
export default api;
