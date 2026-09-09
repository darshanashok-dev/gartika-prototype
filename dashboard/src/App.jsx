/**
 * Root React Application Component for Gartika Urban Intelligence Dashboard.
 * 
 * Manages central dashboard state (statistics, events feed, active buses, work orders),
 * handles periodic data synchronization with the backend REST API, and renders top layout views.
 */

import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { MetricsBar } from './components/MetricsBar';
import { BusCard } from './components/BusCard';
import { WorkOrdersList } from './components/WorkOrdersList';
import { api } from './services/api';

/**
 * Main App functional component.
 */
export function App() {
  const [stats, setStats] = useState({});
  const [events, setEvents] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [bus, setBus] = useState({ bus_id: 'BUS-101', latitude: null, longitude: null, speed: 0.0 });
  const [sourceMode, setSourceMode] = useState('LIVE');

  /**
   * Set up initial data fetch and periodic synchronization timer upon component mount.
   */
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3500);
    return () => clearInterval(interval);
  }, []);

  /**
   * Query backend endpoints in parallel to refresh stats, events, work orders, and bus position.
   */
  const loadData = async () => {
    try {
      const [s, e, wo, b] = await Promise.all([
        api.getStats(),
        api.getEvents(25),
        api.getWorkOrders(),
        api.getBuses()
      ]);
      setStats(s);
      setEvents(e);
      setWorkOrders(wo);
      if (b && b.length > 0) setBus(b[0]);
    } catch (err) {
      console.warn('Dashboard poll error:', err);
    }
  };

  /**
   * Handle work order status transition (e.g. from OPEN to RESOLVED).
   * @param {string} woId - Unique work order identifier.
   * @param {string} newStatus - New status string.
   */
  const handleStatusChange = async (woId, newStatus) => {
    try {
      await api.updateWorkOrder(woId, { status: newStatus });
      loadData();
    } catch (err) {
      alert(`Error updating work order: ${err.message}`);
    }
  };

  /**
   * Post a synthetic high-severity pothole event for demo and testing purposes.
   */
  const handleSeed = async () => {
    await fetch(`${window.location.origin}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bus_id: 'BUS-101',
        event_type: 'POTHOLE',
        confidence: 0.93,
        latitude: 12.972854,
        longitude: 77.601243,
        severity: 'HIGH',
        location_name: 'Trinity Circle'
      })
    });
    loadData();
  };

  return (
    <div className="dashboard-layout">
      <Header 
        onOpenPhoneModal={() => {}} 
        onSeedData={handleSeed}
        sourceMode={sourceMode}
        setSourceMode={setSourceMode}
      />
      <MetricsBar stats={stats} />
      <div className="main-grid">
        <aside className="left-sidebar">
          <BusCard bus={bus} sourceMode={sourceMode} setSourceMode={setSourceMode} />
          <WorkOrdersList workOrders={workOrders} onStatusChange={handleStatusChange} />
        </aside>
      </div>
    </div>
  );
}

export default App;
