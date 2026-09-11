/**
 * Gartika Dashboard - Work Orders Module
 * Handles work order creation, list rendering, status updates, and lifecycle management.
 */

import { ApiClient } from '../api.js';
import { Toast } from '../ui/toast.js';

export class WorkOrderManager {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('workOrderList');
    this.badgeCount = options.badgeCount || document.getElementById('metricWorkOrders');
    this.onWorkOrderCreated = options.onWorkOrderCreated || null;
    this.onWorkOrderStatusChanged = options.onWorkOrderStatusChanged || null;
    this.workOrders = [];
  }

  async loadWorkOrders() {
    try {
      const orders = await ApiClient.getWorkOrders();
      this.workOrders = Array.isArray(orders) ? orders : [];
      this.render();
    } catch (err) {
      console.warn('Failed to load work orders:', err.message);
    }
  }

  async createWorkOrderFromEvent(event) {
    if (!event) return null;
    try {
      const payload = {
        event_id: event.id,
        defect_id: event.defect_id || null,
        title: `Repair: ${event.type || 'Pothole'} on Route`,
        description: `Automated dispatch for verified ${event.type || 'road defect'} detected with ${(event.confidence * 100).toFixed(0)}% confidence at lat: ${event.latitude.toFixed(5)}, lng: ${event.longitude.toFixed(5)}.`,
        priority: event.severity === 'high' || event.severity === 'critical' ? 'critical' : 'high',
        assigned_to: 'Urban Roads Rapid Response Team A',
        latitude: event.latitude,
        longitude: event.longitude,
        metadata: {
          bus_id: event.bus_id,
          verification_level: event.verification_level || 'VERIFIED',
          sensor_fusion: event.sensor_fusion || 'Visual + IMU Shock Corroborated'
        }
      };

      const result = await ApiClient.createWorkOrder(payload);
      Toast.success(`Work Order dispatched: ${result.title || result.id}`);
      await this.loadWorkOrders();
      if (this.onWorkOrderCreated) this.onWorkOrderCreated(result);
      return result;
    } catch (err) {
      Toast.error(`Failed to dispatch work order: ${err.message}`);
      return null;
    }
  }

  async updateStatus(orderId, status) {
    try {
      const updated = await ApiClient.updateWorkOrderStatus(orderId, status);
      Toast.info(`Work Order ${orderId} status changed to ${status}`);
      await this.loadWorkOrders();
      if (this.onWorkOrderStatusChanged) this.onWorkOrderStatusChanged(updated);
      return updated;
    } catch (err) {
      Toast.error(`Failed to update status: ${err.message}`);
      return null;
    }
  }

  render() {
    if (this.badgeCount) {
      const activeCount = this.workOrders.filter(w => w.status !== 'completed' && w.status !== 'closed').length;
      this.badgeCount.textContent = `${activeCount} Active`;
    }

    if (!this.container) return;

    if (this.workOrders.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>
          <p>No active work orders. Dispatched repair work will appear here.</p>
        </div>
      `;
      return;
    }

    this.container.innerHTML = this.workOrders.map(wo => {
      const statusClass = wo.status === 'completed' || wo.status === 'closed' ? 'badge-green' : wo.status === 'in_progress' ? 'badge-amber' : 'badge-red';
      const priorityClass = wo.priority === 'critical' ? 'priority-critical' : wo.priority === 'high' ? 'priority-high' : 'priority-medium';

      return `
        <div class="work-order-item" data-id="${wo.id}">
          <div class="wo-header">
            <span class="wo-id font-mono">#WO-${String(wo.id).slice(0, 8)}</span>
            <span class="badge ${statusClass}">${(wo.status || 'PENDING').toUpperCase()}</span>
          </div>
          <div class="wo-title">${wo.title || 'Road Repair'}</div>
          <div class="wo-meta">
            <span class="priority-tag ${priorityClass}">${(wo.priority || 'MEDIUM').toUpperCase()}</span>
            <span class="wo-team">${wo.assigned_to || 'Rapid Response'}</span>
          </div>
          <div class="wo-actions">
            ${wo.status === 'pending' || wo.status === 'open' ? `
              <button class="btn btn-xs btn-outline btn-start-wo" data-id="${wo.id}">Start Work</button>
            ` : ''}
            ${wo.status === 'in_progress' ? `
              <button class="btn btn-xs btn-success btn-complete-wo" data-id="${wo.id}">Mark Repaired</button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    // Attach button listeners
    this.container.querySelectorAll('.btn-start-wo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateStatus(btn.dataset.id, 'in_progress');
      });
    });

    this.container.querySelectorAll('.btn-complete-wo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.updateStatus(btn.dataset.id, 'completed');
      });
    });
  }
}
