import React from 'react';

export const Header = ({ onOpenPhoneModal, onSeedData, sourceMode, setSourceMode }) => {
  return (
    <header className="top-nav">
      <div className="nav-left">
        <div className="logo-mark">
          <span className="logo-icon">▲</span>
        </div>
        <div className="brand-titles">
          <div className="brand-name">GARTIKA <span className="badge-sih">SIH 2026</span></div>
          <div className="brand-tagline">AI-Powered Mobile Urban Intelligence Platform • <em>Sense. Analyze. Predict. Act.</em></div>
        </div>
      </div>

      <div className="nav-center">
        <div className="system-status-pills">
          <div className="sys-pill online">
            <span className="pulse-dot"></span>
            <span>EDGE UNIT: <strong>ONLINE</strong></span>
          </div>
          <div className="sys-pill online">
            <span className="pulse-dot"></span>
            <span>BACKEND: <strong>ONLINE</strong></span>
          </div>
          <div className="sys-pill online">
            <span className="pulse-dot"></span>
            <span>AI ENGINE: <strong>ONLINE</strong></span>
          </div>
          <div className="sys-pill online">
            <span className="pulse-dot"></span>
            <span>GPS: <strong>ACTIVE</strong></span>
          </div>
        </div>
      </div>

      <div className="nav-right">
        <div className="source-toggle-badge">
          <span className="source-icon">📡</span>
          <span className="source-text">SOURCE: <strong>{sourceMode === 'LIVE' ? 'LIVE PHONE' : 'DEMO VIDEO'}</strong></span>
        </div>
        <button className="btn-action-sm" onClick={onOpenPhoneModal}>
          📱 Connect Phone
        </button>
        <button className="btn-action-sm primary" onClick={onSeedData}>
          ⚡ Seed Demo Data
        </button>
      </div>
    </header>
  );
};
