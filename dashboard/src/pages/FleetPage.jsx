import React, { useState } from 'react';
import { 
  Bus, 
  Wifi, 
  Camera, 
  Activity, 
  Compass, 
  Gauge, 
  Clock,
  Radio,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Smartphone,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  Layers
} from 'lucide-react';

export function FleetPage({ buses = [], onSelectBus }) {
  const [filter, setFilter] = useState('ALL'); // ALL, ONLINE, OFFLINE, STALE, GPS_ALERT
  const [selectedBusId, setSelectedBusId] = useState(buses.length > 0 ? buses[0].bus_id : 'BUS-101');
  const [streamCacheBuster, setStreamCacheBuster] = useState(Date.now());
  const [hasFrame, setHasFrame] = useState(true);

  // Poll live camera frame every 1200ms
  React.useEffect(() => {
    const timer = setInterval(() => {
      setStreamCacheBuster(Date.now());
    }, 1200);
    return () => clearInterval(timer);
  }, []);

  const selectedBus = buses.find(b => b.bus_id === selectedBusId) || buses[0] || null;

  // Compute node status
  const now = Date.now();
  const enhancedBuses = buses.map(bus => {
    const lastSeenMs = bus.last_seen ? new Date(bus.last_seen).getTime() : 0;
    const ageSeconds = lastSeenMs > 0 ? Math.floor((now - lastSeenMs) / 1000) : 9999;
    const isOnline = ageSeconds < 60;
    const isStale = ageSeconds >= 60 && ageSeconds < 300;
    const isOffline = ageSeconds >= 300;
    const hasGps = bus.latitude !== null && bus.latitude !== undefined && bus.longitude !== null && bus.longitude !== undefined;

    return {
      ...bus,
      ageSeconds,
      isOnline,
      isStale,
      isOffline,
      hasGps,
      cameraStatus: isOnline ? 'READY' : 'OFFLINE',
      imuStatus: isOnline ? 'ACTIVE' : 'OFFLINE',
      gpsState: hasGps ? (isOnline ? 'FIXED' : 'STALE') : 'NO_LOCK',
      aiState: isOnline ? 'READY' : 'STANDBY'
    };
  });

  const filteredBuses = enhancedBuses.filter(bus => {
    if (filter === 'ONLINE') return bus.isOnline;
    if (filter === 'OFFLINE') return bus.isOffline;
    if (filter === 'STALE') return bus.isStale;
    if (filter === 'GPS_ALERT') return !bus.hasGps;
    return true;
  });

  const onlineCount = enhancedBuses.filter(b => b.isOnline).length;
  const staleCount = enhancedBuses.filter(b => b.isStale).length;
  const offlineCount = enhancedBuses.filter(b => b.isOffline).length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>TRANSIT SENSING FLEET & SENSOR HEALTH</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time status of bus-mounted smartphones acting as autonomous edge road-sensing units.
          </p>
        </div>

        {/* Global Node Health Badges */}
        <div className="flex items-center gap-3 font-mono text-xs">
          <div className="flex items-center gap-1.5 bg-emerald-950/60 border border-emerald-800 px-3 py-1 rounded text-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>{onlineCount} Online</span>
          </div>
          {staleCount > 0 && (
            <div className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800 px-3 py-1 rounded text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400"></span>
              <span>{staleCount} Stale</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-zinc-400">
            <span>{offlineCount} Offline</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <div className="flex items-center gap-2">
          {['ALL', 'ONLINE', 'STALE', 'OFFLINE', 'GPS_ALERT'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-colors ${
                filter === f
                  ? 'bg-amber-500 text-zinc-950 font-bold'
                  : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200 border border-zinc-800'
              }`}
            >
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>

        <button 
          onClick={() => setStreamCacheBuster(Date.now())}
          className="flex items-center gap-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh Feeds</span>
        </button>
      </div>

      {/* Main Grid: Fleet Health Table (Left) + Selected Node Telemetry & Stream (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Fleet Sensor Health Table */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between font-mono text-xs">
            <span className="font-bold text-zinc-300 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-400" />
              SENSING NODE DIRECTORY ({filteredBuses.length})
            </span>
            <span className="text-[10px] text-zinc-500">Click node to inspect sensors</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-zinc-950/80 border-b border-zinc-800 text-[10px] text-zinc-400 uppercase">
                <tr>
                  <th className="p-3">Node / Bus</th>
                  <th className="p-3">Camera</th>
                  <th className="p-3">GPS / GNSS</th>
                  <th className="p-3">IMU</th>
                  <th className="p-3">Speed</th>
                  <th className="p-3">Last Seen</th>
                  <th className="p-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredBuses.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-zinc-500 font-mono text-xs">
                      No transit sensing nodes match filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredBuses.map((bus) => {
                    const isSelected = selectedBus && selectedBus.bus_id === bus.bus_id;
                    return (
                      <tr
                        key={bus.bus_id}
                        onClick={() => {
                          setSelectedBusId(bus.bus_id);
                          if (onSelectBus) onSelectBus(bus);
                        }}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-amber-500/10 border-l-2 border-l-amber-500' : 'hover:bg-zinc-800/40'
                        }`}
                      >
                        <td className="p-3 font-bold text-zinc-200">
                          <div className="flex items-center gap-2">
                            <span>🚌</span>
                            <div>
                              <div>{bus.bus_id}</div>
                              <div className="text-[10px] text-zinc-500 font-normal">{bus.name || 'Mobile Unit'}</div>
                            </div>
                          </div>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            bus.cameraStatus === 'READY'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {bus.cameraStatus}
                          </span>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            bus.gpsState === 'FIXED'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : bus.gpsState === 'STALE'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              : 'bg-rose-950/80 text-rose-300 border border-rose-800'
                          }`}>
                            {bus.gpsState}
                          </span>
                        </td>

                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            bus.imuStatus === 'ACTIVE'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {bus.imuStatus}
                          </span>
                        </td>

                        <td className="p-3 text-zinc-300">
                          {(bus.speed || 0).toFixed(1)} km/h
                        </td>

                        <td className="p-3 text-zinc-400 text-[11px]">
                          {bus.ageSeconds < 60 ? `${bus.ageSeconds}s ago` : `${Math.floor(bus.ageSeconds / 60)}m ago`}
                        </td>

                        <td className="p-3 text-right">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            bus.isOnline
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : bus.isStale
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {bus.isOnline ? 'LIVE' : (bus.isStale ? 'STALE' : 'OFFLINE')}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Node Telemetry & Edge Stream Inspection */}
        {selectedBus && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col gap-4 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <span className="text-[10px] text-amber-400 font-bold block">INSPECTING SENSING NODE</span>
                <span className="text-base font-bold text-zinc-100">{selectedBus.bus_id}</span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                selectedBus.status === 'ONLINE' || (selectedBus.speed || 0) > 0
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : 'bg-zinc-800 text-zinc-400'
              }`}>
                {selectedBus.status || 'ONLINE'}
              </span>
            </div>

            {/* Live Camera Snapshot Preview */}
            <div>
              <div className="text-[10px] text-zinc-400 uppercase mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-zinc-400" />
                  FORWARD DASHCAM FEED (LIVE)
                </span>
                <span className="text-[10px] text-emerald-400">HTTP Snapshot</span>
              </div>

              <div className="relative aspect-video bg-zinc-950 rounded border border-zinc-800 overflow-hidden flex items-center justify-center">
                <img
                  key={streamCacheBuster}
                  src={`/api/v1/stream/latest-frame?bus_id=${selectedBus.bus_id}&t=${streamCacheBuster}`}
                  alt={`Live feed from ${selectedBus.bus_id}`}
                  className={`w-full h-full object-cover transition-opacity duration-200 ${hasFrame ? 'opacity-100' : 'opacity-0'}`}
                  onLoad={() => setHasFrame(true)}
                  onError={() => setHasFrame(false)}
                />
                {!hasFrame && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/90 text-zinc-500 text-[11px] p-4 text-center">
                    <Camera className="w-6 h-6 text-zinc-600 mb-1.5 animate-pulse" />
                    <span>Awaiting live dashcam frame...</span>
                    <span className="text-[9px] text-zinc-600 mt-0.5">Start Sensing on mobile to stream</span>
                  </div>
                )}
              </div>
            </div>

            {/* Subsystem Telemetry Details */}
            <div className="space-y-2 bg-zinc-950/60 p-3 rounded border border-zinc-800">
              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500 flex items-center gap-1.5"><Gauge className="w-3.5 h-3.5" /> Velocity:</span>
                <span className="font-bold text-zinc-100">{(selectedBus.speed || 0).toFixed(1)} km/h</span>
              </div>

              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500 flex items-center gap-1.5"><Compass className="w-3.5 h-3.5" /> Heading:</span>
                <span className="text-zinc-200">{selectedBus.heading ? `${selectedBus.heading.toFixed(1)}°` : '0.0°'}</span>
              </div>

              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500 flex items-center gap-1.5"><Radio className="w-3.5 h-3.5" /> GPS Coordinates:</span>
                <span className="text-zinc-200">
                  {selectedBus.latitude !== null && selectedBus.longitude !== null
                    ? `${selectedBus.latitude.toFixed(5)}, ${selectedBus.longitude.toFixed(5)}`
                    : 'UNAVAILABLE'}
                </span>
              </div>

              <div className="flex items-center justify-between text-zinc-300">
                <span className="text-zinc-500 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Last Telemetry:</span>
                <span className="text-zinc-400">
                  {selectedBus.last_seen ? new Date(selectedBus.last_seen).toLocaleTimeString() : 'Just now'}
                </span>
              </div>
            </div>

            <div className="text-[11px] text-zinc-500">
              Assigned Route: <strong className="text-zinc-300">{selectedBus.route_name || 'Route 335E (Majestic — ITPL)'}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
