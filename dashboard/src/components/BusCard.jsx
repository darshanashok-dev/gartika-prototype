import React from 'react';

export const BusCard = ({ bus, sourceMode, setSourceMode }) => {
  return (
    <div className="panel-card bus-panel">
      <div className="panel-header">
        <div className="panel-title">MOBILE SENSING UNIT</div>
        <span className="status-chip active">ACTIVE</span>
      </div>
      
      <div className="bus-hero">
        <div className="bus-id-large">{bus.bus_id || 'BUS-101'}</div>
        <div className="bus-name">{bus.name || 'BMTC Urban Sense (Electric)'}</div>
        <div className="bus-route">{bus.route_name || 'Route 335E: Majestic ➔ Whitefield'}</div>
      </div>

      <div className="bus-details-grid">
        <div className="bus-detail-item">
          <span className="b-label">LATITUDE</span>
          <span className="b-val">{bus.latitude ? bus.latitude.toFixed(6) : '12.971598'}</span>
        </div>
        <div className="bus-detail-item">
          <span className="b-label">LONGITUDE</span>
          <span className="b-val">{bus.longitude ? bus.longitude.toFixed(6) : '77.594562'}</span>
        </div>
        <div className="bus-detail-item">
          <span className="b-label">SPEED</span>
          <span className="b-val">{(bus.speed || 31.2).toFixed(1)} km/h</span>
        </div>
        <div className="bus-detail-item">
          <span className="b-label">LAST SEEN</span>
          <span className="b-val">Just now</span>
        </div>
      </div>

      <div className="video-mode-selector">
        <div className="v-mode-label">AI INGESTION SOURCE:</div>
        <div className="v-mode-buttons">
          <button 
            className={`v-btn ${sourceMode === 'DEMO' ? 'active' : ''}`}
            onClick={() => setSourceMode('DEMO')}
          >
            DEMO ROAD VIDEO
          </button>
          <button 
            className={`v-btn ${sourceMode === 'LIVE' ? 'active' : ''}`}
            onClick={() => setSourceMode('LIVE')}
          >
            LIVE PHONE CAMERA
          </button>
        </div>
      </div>
    </div>
  );
};
