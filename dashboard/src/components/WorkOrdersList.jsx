import React from 'react';

export const WorkOrdersList = ({ workOrders, onStatusChange }) => {
  return (
    <div className="panel-card work-orders-panel">
      <div className="panel-header">
        <div className="panel-title">MAINTENANCE WORK ORDERS</div>
        <span className="count-badge">{workOrders.length}</span>
      </div>
      <div className="wo-list">
        {workOrders.length === 0 ? (
          <div className="empty-state">No work orders created yet. Click an event to dispatch maintenance.</div>
        ) : (
          workOrders.map((wo) => (
            <div key={wo.work_order_id} className="wo-card-item">
              <div className="wo-card-header">
                <span className="wo-id">{wo.work_order_id}</span>
                <select 
                  className={`wo-status-select ${wo.status}`}
                  value={wo.status}
                  onChange={(e) => onStatusChange(wo.work_order_id, e.target.value)}
                  style={{ background: '#1e293b', color: '#00f2fe', border: '1px solid #334155', borderRadius: '4px', fontSize: '9px', padding: '2px 4px' }}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>
              <div className="wo-title">{wo.title}</div>
              <div className="wo-loc">📍 {wo.location_name || 'Urban Zone'} • Assigned: {wo.assigned_to}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
