import React from 'react';
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
  Smartphone
} from 'lucide-react';

export function FleetPage({ buses, onSelectBus }) {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>TRANSIT SENSING FLEET REGISTRY</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Mobile sensing nodes, vehicle positioning telemetry, and edge camera status across the municipal transit network.
          </p>
        </div>

        <div className="flex items-center gap-2 font-mono text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-subtle"></span>
          <span>Fleet Size: {buses.length} Active Nodes</span>
        </div>
      </div>

      {/* Bus Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {buses.map((bus) => {
          const isOnline = bus.status === 'ONLINE' || bus.speed > 0;
          const hasGps = bus.latitude !== null && bus.latitude !== undefined && bus.longitude !== null && bus.longitude !== undefined;

          return (
            <div 
              key={bus.bus_id}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors font-mono text-xs"
            >
              {/* Bus Card Top Row */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                      🚌
                    </div>
                    <div>
                      <div className="font-bold text-sm text-zinc-100">{bus.bus_id}</div>
                      <div className="text-[10px] text-zinc-400">{bus.name || 'Mobile Sensing Unit'}</div>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    isOnline 
                      ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {isOnline ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>

                {/* Subsystem Readiness Indicators */}
                <div className="grid grid-cols-3 gap-2 py-3 border-b border-zinc-800/80 text-[10px] text-center">
                  <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">DASHCAM</span>
                    <span className="text-emerald-400 font-bold">ACTIVE</span>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">IMU (50Hz)</span>
                    <span className="text-emerald-400 font-bold">CALIBRATED</span>
                  </div>
                  <div className="p-1.5 rounded bg-zinc-950/60 border border-zinc-800">
                    <span className="text-zinc-500 block">GNSS / GPS</span>
                    <span className={hasGps ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                      {hasGps ? 'LOCKED' : 'SEARCHING'}
                    </span>
                  </div>
                </div>

                {/* Telemetry Metrics */}
                <div className="py-3 space-y-2 text-zinc-300">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5" /> Velocity:
                    </span>
                    <span className="font-bold text-zinc-100">{(bus.speed || 0).toFixed(1)} km/h</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" /> Heading:
                    </span>
                    <span className="text-zinc-200">{bus.heading ? `${bus.heading}°` : '0°'}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5" /> GPS Position:
                    </span>
                    <span className="text-zinc-300">
                      {hasGps ? `${bus.latitude.toFixed(4)}, ${bus.longitude.toFixed(4)}` : 'UNAVAILABLE'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> Last Telemetry:
                    </span>
                    <span className="text-zinc-400 text-[10px]">
                      {bus.last_seen ? new Date(bus.last_seen).toLocaleTimeString() : 'Just now'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400">
                <span>Route: {bus.route_name || 'Route 335E (Majestic)'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
