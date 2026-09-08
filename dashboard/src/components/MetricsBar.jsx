import React from 'react';

export const MetricsBar = ({ stats }) => {
  return (
    <section className="metrics-row">
      <div className="metric-card">
        <div className="metric-icon bus-icon">🚌</div>
        <div className="metric-info">
          <div className="metric-label">ACTIVE BUSES</div>
          <div className="metric-number">{stats.active_buses || 1}</div>
          <div className="metric-sub">Fleet Unit BUS-101</div>
        </div>
      </div>

      <div className="metric-card">
        <div className="metric-icon event-icon">⚡</div>
        <div className="metric-info">
          <div className="metric-label">EVENTS TODAY</div>
          <div className="metric-number">{stats.events_today || 0}</div>
          <div className="metric-sub">Geotagged AI detections</div>
        </div>
      </div>

      <div className="metric-card danger">
        <div className="metric-icon defect-icon">🕳️</div>
        <div className="metric-info">
          <div className="metric-label">ROAD DEFECTS</div>
          <div className="metric-number">{stats.road_defects || 0}</div>
          <div className="metric-sub">Potholes & Cracks</div>
        </div>
      </div>

      <div className="metric-card warning">
        <div className="metric-icon traffic-icon">🚗</div>
        <div className="metric-info">
          <div className="metric-label">VEHICLES DETECTED</div>
          <div className="metric-number">{stats.vehicles_detected || 0}</div>
          <div className="metric-sub">ByteTrack tracked IDs</div>
        </div>
      </div>

      <div className="metric-card critical">
        <div className="metric-icon priority-icon">🚨</div>
        <div className="metric-info">
          <div className="metric-label">HIGH PRIORITY</div>
          <div className="metric-number">{stats.high_priority_events || 0}</div>
          <div className="metric-sub">Action required</div>
        </div>
      </div>

      <div className="metric-card bandwidth-card">
        <div className="metric-icon data-icon">📉</div>
        <div className="metric-info">
          <div className="metric-label">BANDWIDTH SAVINGS</div>
          <div className="metric-number" style={{ color: '#00f2fe' }}>99.97%</div>
          <div className="metric-sub"><span className="estimate-tag">DESIGN ESTIMATE</span> ~0.035 vs 144 GB/day</div>
        </div>
      </div>
    </section>
  );
};
