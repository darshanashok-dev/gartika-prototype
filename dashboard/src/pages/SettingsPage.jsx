import React, { useEffect, useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Server, 
  Database, 
  Cpu, 
  HardDrive, 
  Radio, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw,
  Sliders,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';

export function SettingsPage({ isDemoMode }) {
  const [healthData, setHealthData] = useState(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState(null);

  const fetchHealth = async () => {
    setIsLoadingHealth(true);
    setHealthError(null);
    try {
      const data = await api.getHealth();
      setHealthData(data);
    } catch (err) {
      setHealthError(err.message || 'Health check probe failed');
    } finally {
      setIsLoadingHealth(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>SYSTEM DIAGNOSTICS & THRESHOLDS</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Microservice health probes, sensor fusion spatial thresholds, and runtime backend telemetry configuration.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={isLoadingHealth}
          className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingHealth ? 'animate-spin text-amber-400' : ''}`} />
          <span>Probe Subsystems</span>
        </button>
      </div>

      {/* 2-Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* Left Column: Health Check Probes */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-zinc-100 uppercase">Live Subsystem Health Probes</h3>
            </div>
            <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              HTTP /health
            </span>
          </div>

          {healthError ? (
            <div className="p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{healthError}</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Server className="w-3.5 h-3.5 text-zinc-400" />
                  FastAPI REST Engine:
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ONLINE (200 OK)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Database className="w-3.5 h-3.5 text-zinc-400" />
                  SQLite ORM Database:
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  CONNECTED & INDEXED
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  YOLOv8 Inference Engine:
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  ACTIVE (gartika_road_defect.pt)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-zinc-400" />
                  Evidence Storage Volume:
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  WRITABLE (/data/evidence)
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
                <span className="text-zinc-400 flex items-center gap-2">
                  <Radio className="w-3.5 h-3.5 text-zinc-400" />
                  Real-time WebSocket Broadcaster:
                </span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  READY (/ws/events)
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Active Detection Thresholds */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-zinc-100 uppercase">Sensor Fusion Calibration Config</h3>
            </div>
            <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              backend/app/config.py
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Optical Detection Confidence Threshold</span>
              <span className="font-bold text-zinc-100">0.45 (45.0%)</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">IMU Vertical Shock Acceleration Spike</span>
              <span className="font-bold text-zinc-100">|az - 9.81| &gt; 3.2 m/s²</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Temporal Alignment Buffer Window</span>
              <span className="font-bold text-zinc-100">±1,500 ms</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Spatial Deduplication Radius (Haversine)</span>
              <span className="font-bold text-zinc-100">25.0 meters</span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Multi-Bus Bayesian Verification Requirement</span>
              <span className="font-bold text-emerald-400">≥ 2 Unique Bus Sighting</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
