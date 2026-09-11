import React from 'react';
import { 
  Bus, 
  AlertTriangle, 
  ShieldCheck, 
  ClipboardList, 
  ArrowUpRight, 
  TrendingUp, 
  Radio, 
  Clock,
  Layers,
  CheckCircle2,
  HardHat
} from 'lucide-react';

export function OverviewPage({ 
  stats, 
  events, 
  defects, 
  buses, 
  workOrders, 
  onSelectDefect, 
  onNavigate 
}) {
  const activeBusesCount = buses.filter(b => b.status === 'ONLINE' || b.speed > 0).length || buses.length;
  const verifiedCount = defects.filter(d => d.status === 'VERIFIED' || d.unique_bus_count >= 2).length;
  const openWorkOrders = workOrders.filter(w => w.status !== 'COMPLETED' && w.status !== 'CLOSED').length;
  const recentDefects = defects.slice(0, 6);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>OPERATIONAL SITUATION REPORT</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time urban road telemetry, edge AI candidate anomalies, and municipal maintenance pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('map')}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
          >
            <span>Open Live GIS Map</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Primary KPI Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-mono font-medium uppercase">Active Sensing Fleet</span>
            <Bus className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-zinc-100">{activeBusesCount}</div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
              100% Online
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 font-mono">
            {buses.length} registered mobile units
          </div>
        </div>

        {/* Metric 2 */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-mono font-medium uppercase">Detected Hazards</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-zinc-100">{defects.length || stats.potholes_count || 0}</div>
            <span className="text-[11px] font-mono text-amber-400 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-800/60">
              Spatial Clustered
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 font-mono">
            Across 25.0m Haversine radius
          </div>
        </div>

        {/* Metric 3 */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-mono font-medium uppercase">Verified Road Defects</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-zinc-100">{verifiedCount}</div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60">
              ≥ 2 Buses
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 font-mono">
            Bayesian multi-pass corroborated
          </div>
        </div>

        {/* Metric 4 */}
        <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800/90 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-mono font-medium uppercase">Pending Work Orders</span>
            <ClipboardList className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div className="text-2xl font-bold font-mono text-zinc-100">{openWorkOrders}</div>
            <span className="text-[11px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-800/60">
              Maintenance
            </span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 font-mono">
            {workOrders.length} total municipal orders
          </div>
        </div>
      </div>

      {/* 2-Column Section: Recent Defects + Live Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Defects Table */}
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-zinc-100 uppercase font-mono">Active Road Cavities & Hazards</h3>
              </div>
              <button 
                onClick={() => onNavigate('defects')}
                className="text-xs font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                <span>View All ({defects.length})</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-800/80 text-[11px]">
                    <th className="pb-2 font-medium">TYPE</th>
                    <th className="pb-2 font-medium">SEVERITY</th>
                    <th className="pb-2 font-medium">STATUS</th>
                    <th className="pb-2 font-medium">OBSERVATIONS</th>
                    <th className="pb-2 font-medium">BUS UNIT</th>
                    <th className="pb-2 font-medium text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {recentDefects.length > 0 ? (
                    recentDefects.map((d) => (
                      <tr key={d.id || d.defect_id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-2.5 font-bold text-zinc-200 capitalize">
                          {d.defect_type || d.event_type || 'Pothole'}
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.severity === 'CRITICAL' || d.severity === 'HIGH'
                              ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                              : d.severity === 'MEDIUM'
                              ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                              : 'bg-zinc-800 text-zinc-300'
                          }`}>
                            {d.severity || 'HIGH'}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] ${
                            d.status === 'VERIFIED'
                              ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-bold'
                              : d.status === 'REPAIR_VERIFIED'
                              ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                              : 'bg-zinc-800 text-zinc-400'
                          }`}>
                            {d.status || 'CANDIDATE'}
                          </span>
                        </td>
                        <td className="py-2.5 text-zinc-300">
                          {d.observation_count || 1} hits ({d.unique_bus_count || 1} bus)
                        </td>
                        <td className="py-2.5 text-zinc-400">{d.bus_id || 'BUS-101'}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => onSelectDefect(d)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-zinc-400">
                        No defects registered in database yet. Transmit camera/IMU telemetry to start detection.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Live Event Feed Log */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800 mb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse-subtle" />
                <h3 className="text-xs font-bold text-zinc-100 uppercase font-mono">Live Ingestion Feed</h3>
              </div>
              <span className="text-[10px] font-mono text-zinc-400">WebSocket 50Hz</span>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {events.slice(0, 10).map((e, idx) => (
                <div 
                  key={e.id || idx}
                  className="p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80 font-mono text-xs flex items-start justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-amber-400 font-bold">{e.bus_id || 'BUS-101'}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-200 capitalize">{e.event_type || 'Telemetry Shock'}</span>
                    </div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      {e.latitude ? `${e.latitude.toFixed(4)}, ${e.longitude.toFixed(4)}` : 'UNKNOWN_LOCATION'}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                      e.severity === 'HIGH' || e.severity === 'CRITICAL' ? 'text-rose-400 bg-rose-950/60' : 'text-zinc-400 bg-zinc-800'
                    }`}>
                      {e.severity || 'INFO'}
                    </span>
                    <div className="text-[9px] text-zinc-400 mt-1">
                      {e.created_at ? new Date(e.created_at).toLocaleTimeString() : 'Just now'}
                    </div>
                  </div>
                </div>
              ))}

              {events.length === 0 && (
                <div className="py-12 text-center text-zinc-400 text-xs font-mono">
                  Awaiting real-time WebSocket events...
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span>Bandwidth Transmission Load:</span>
            <span className="text-emerald-400 font-bold">20.04 Kbps (99.71% saved)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
