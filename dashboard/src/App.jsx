import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { TopNav } from './components/TopNav';
import { DefectDrawer } from './components/DefectDrawer';
import { CreateWorkOrderModal } from './components/CreateWorkOrderModal';
import { MobileSensingModal } from './components/MobileSensingModal';

import { OverviewPage } from './pages/OverviewPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { DefectsPage } from './pages/DefectsPage';
import { FleetPage } from './pages/FleetPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { SettingsPage } from './pages/SettingsPage';

import { api } from './services/api';
import { wsClient, ConnectionStatus } from './services/websocket';

export function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({});
  const [events, setEvents] = useState([]);
  const [defects, setDefects] = useState([]);
  const [buses, setBuses] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  
  const [selectedDefect, setSelectedDefect] = useState(null);
  const [workOrderModalDefect, setWorkOrderModalDefect] = useState(null);
  const [evidenceModalUrl, setEvidenceModalUrl] = useState(null);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [backendHealthy, setBackendHealthy] = useState(true);
  const [wsStatus, setWsStatus] = useState(ConnectionStatus.CONNECTING);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Fetch all dashboard data from REST API
  const refreshAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [healthRes, statsRes, eventsRes, defectsRes, busesRes, woRes] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getStats().catch(() => ({})),
        api.getEvents({ limit: 50 }).catch(() => []),
        api.getDefects().catch(() => []),
        api.getBuses().catch(() => []),
        api.getWorkOrders().catch(() => [])
      ]);

      setBackendHealthy(Boolean(healthRes));
      if (statsRes) {
        setStats(statsRes);
        if (statsRes.demo_mode !== undefined) setIsDemoMode(statsRes.demo_mode);
      }
      if (Array.isArray(eventsRes)) setEvents(eventsRes);
      if (Array.isArray(defectsRes)) setDefects(defectsRes);
      if (Array.isArray(busesRes)) setBuses(busesRes);
      if (Array.isArray(woRes)) setWorkOrders(woRes);
    } catch (err) {
      console.warn('[Gartika] Background poll error:', err);
      setBackendHealthy(false);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Initial mount & WebSocket subscription
  useEffect(() => {
    refreshAllData();

    // 1. Connect WebSocket
    wsClient.connect();
    const unsubStatus = wsClient.subscribeStatus(setWsStatus);
    const unsubEvents = wsClient.subscribe((msg) => {
      if (msg.type === 'NEW_EVENT' || msg.event === 'hazard') {
        const newEvt = msg.data || msg;
        setEvents((prev) => [newEvt, ...prev.slice(0, 49)]);
        // If defect payload included, update defects catalog
        if (newEvt.defect_id || newEvt.id) {
          setDefects((prev) => {
            const exists = prev.find(d => (d.id === newEvt.id || d.defect_id === newEvt.defect_id));
            if (exists) {
              return prev.map(d => (d.id === newEvt.id || d.defect_id === newEvt.defect_id) ? { ...d, ...newEvt } : d);
            }
            return [newEvt, ...prev];
          });
        }
      } else if (msg.type === 'TELEMETRY' || msg.bus_id) {
        // Update bus telemetry location in fleet state
        setBuses((prev) => {
          const busIdx = prev.findIndex(b => b.bus_id === msg.bus_id);
          if (busIdx >= 0) {
            const updated = [...prev];
            updated[busIdx] = { ...updated[busIdx], ...msg, last_seen: new Date().toISOString() };
            return updated;
          }
          return [...prev, { bus_id: msg.bus_id, status: 'ONLINE', ...msg }];
        });
      }
    });

    // 2. Periodic background synchronization (3.5s interval)
    const pollTimer = setInterval(refreshAllData, 3500);

    return () => {
      unsubStatus();
      unsubEvents();
      wsClient.disconnect();
      clearInterval(pollTimer);
    };
  }, [refreshAllData]);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="text"]');
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl(), '_blank');
  };

  const pendingWoCount = workOrders.filter(w => w.status !== 'COMPLETED' && w.status !== 'CLOSED').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        defectCount={defects.length}
        busCount={buses.length}
        pendingWorkOrders={pendingWoCount}
        onOpenMobileModal={() => setIsMobileModalOpen(true)}
      />

      {/* Main Content Pane */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header & Search Bar */}
        <TopNav
          wsStatus={wsStatus}
          backendHealthy={backendHealthy}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onRefresh={refreshAllData}
          isRefreshing={isRefreshing}
          onExportCsv={handleExportCsv}
          isDemoMode={isDemoMode}
          onOpenMobileModal={() => setIsMobileModalOpen(true)}
        />

        {/* Page Container */}
        <main className="flex-1 overflow-y-auto bg-zinc-950/60 relative">
          {activeTab === 'overview' && (
            <OverviewPage
              stats={stats}
              events={events}
              defects={defects}
              buses={buses}
              workOrders={workOrders}
              onSelectDefect={setSelectedDefect}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'map' && (
            <LiveMapPage
              defects={defects}
              buses={buses}
              selectedDefect={selectedDefect}
              onSelectDefect={setSelectedDefect}
            />
          )}

          {activeTab === 'defects' && (
            <DefectsPage
              defects={defects}
              onSelectDefect={setSelectedDefect}
              onCreateWorkOrder={setWorkOrderModalDefect}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === 'fleet' && (
            <FleetPage
              buses={buses}
              onSelectBus={(bus) => {
                setActiveTab('map');
              }}
            />
          )}

          {activeTab === 'work-orders' && (
            <WorkOrdersPage
              workOrders={workOrders}
              onRefresh={refreshAllData}
              onOpenCreateModal={() => {
                if (defects.length > 0) {
                  setWorkOrderModalDefect(defects[0]);
                } else {
                  alert('No defects available to issue work order for.');
                }
              }}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsPage
              stats={stats}
              onExportCsv={handleExportCsv}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              isDemoMode={isDemoMode}
            />
          )}
        </main>
      </div>

      {/* Slide-over Defect Details Drawer */}
      {selectedDefect && (
        <DefectDrawer
          defect={selectedDefect}
          onClose={() => setSelectedDefect(null)}
          onCreateWorkOrder={(d) => {
            setSelectedDefect(null);
            setWorkOrderModalDefect(d);
          }}
          onOpenEvidenceModal={setEvidenceModalUrl}
        />
      )}

      {/* Create Work Order Modal */}
      {workOrderModalDefect && (
        <CreateWorkOrderModal
          defect={workOrderModalDefect}
          onClose={() => setWorkOrderModalDefect(null)}
          onSuccess={() => {
            refreshAllData();
          }}
        />
      )}

      {/* Full-screen Evidence Photo Viewer Modal */}
      {evidenceModalUrl && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md animate-in fade-in duration-150"
          onClick={() => setEvidenceModalUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
            <img 
              src={evidenceModalUrl} 
              alt="Optical Evidence Full Resolution" 
              className="max-w-full max-h-[85vh] object-contain"
            />
            <div className="p-3 bg-zinc-900 border-t border-zinc-800 text-center font-mono text-xs text-zinc-300">
              High-Resolution Edge Dashcam Evidence Crop
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sensing QR Code Pairing Modal */}
      <MobileSensingModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
        localIp={stats.local_ip}
      />
    </div>
  );
}

export default App;
