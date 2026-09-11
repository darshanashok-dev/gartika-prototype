import React from 'react';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  Search, 
  Download, 
  RefreshCw, 
  Clock,
  ShieldCheck,
  Server,
  QrCode
} from 'lucide-react';
import { ConnectionStatus } from '../services/websocket';

export function TopNav({ 
  wsStatus, 
  backendHealthy, 
  searchQuery, 
  setSearchQuery, 
  onRefresh, 
  isRefreshing, 
  onExportCsv,
  isDemoMode,
  onOpenMobileModal
}) {
  const getWsBadge = () => {
    switch (wsStatus) {
      case ConnectionStatus.CONNECTED:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium bg-emerald-950/60 text-emerald-400 border border-emerald-800/60">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-subtle"></span>
            LIVE WS
          </span>
        );
      case ConnectionStatus.RECONNECTING:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium bg-amber-950/60 text-amber-400 border border-amber-800/60">
            <RefreshCw className="w-3 h-3 animate-spin" />
            RECONNECTING
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono font-medium bg-zinc-800 text-zinc-400 border border-zinc-700">
            <WifiOff className="w-3 h-3" />
            POLLING
          </span>
        );
    }
  };

  return (
    <header className="h-14 border-b border-zinc-800/80 bg-zinc-900/90 backdrop-blur px-4 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Search Bar */}
      <div className="flex-1 max-w-md relative">
        <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter defects, buses, routes (/ to focus)..."
          className="w-full bg-zinc-950/80 border border-zinc-800 rounded px-3 py-1.5 pl-9 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 font-mono transition-colors"
        />
      </div>

      {/* Center Status Indicators */}
      <div className="hidden md:flex items-center gap-3">
        {isDemoMode && (
          <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            DEMO MODE
          </span>
        )}

        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono border-l border-r border-zinc-800 px-3">
          <Server className="w-3.5 h-3.5 text-zinc-400" />
          <span>API:</span>
          {backendHealthy ? (
            <span className="text-emerald-400 font-medium">ONLINE</span>
          ) : (
            <span className="text-rose-400 font-medium">UNREACHABLE</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {getWsBadge()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMobileModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors font-mono"
        >
          <QrCode className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Pair Mobile</span>
        </button>

        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh telemetry & defects"
          className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border border-zinc-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-amber-400' : ''}`} />
        </button>

        <button
          onClick={onExportCsv}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Export CSV</span>
        </button>
      </div>
    </header>
  );
}
