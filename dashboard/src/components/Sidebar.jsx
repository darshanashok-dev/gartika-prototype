import React from 'react';
import { 
  LayoutDashboard, 
  Map as MapIcon, 
  AlertTriangle, 
  Bus, 
  ClipboardList, 
  BarChart3, 
  Settings,
  Radio,
  Smartphone
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Live GIS Map', icon: MapIcon },
  { id: 'defects', label: 'Defects', icon: AlertTriangle },
  { id: 'fleet', label: 'Fleet Registry', icon: Bus },
  { id: 'work-orders', label: 'Work Orders', icon: ClipboardList },
  { id: 'analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { id: 'settings', label: 'System & Health', icon: Settings },
];

export function Sidebar({ activeTab, setActiveTab, defectCount, busCount, pendingWorkOrders, onOpenMobileModal }) {
  return (
    <aside className="w-56 border-r border-zinc-800/80 bg-zinc-900/60 flex flex-col justify-between shrink-0 select-none">
      <div>
        {/* Brand Header */}
        <div className="h-14 px-4 flex items-center gap-2.5 border-b border-zinc-800/80 bg-zinc-900/90">
          <div className="w-7 h-7 rounded bg-amber-500 flex items-center justify-center text-zinc-950 font-black text-sm shadow-sm shadow-amber-500/30">
            G
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-zinc-100 flex items-center gap-1.5 font-mono">
              GARTIKA
              <span className="text-[10px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400 font-normal">v1.1</span>
            </div>
            <div className="text-[10px] text-zinc-400 tracking-wide uppercase">Urban Intelligence</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-2 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded text-xs font-medium transition-colors ${
                  isActive 
                    ? 'bg-zinc-800/90 text-amber-400 font-semibold border-l-2 border-amber-400' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-amber-400' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                </div>

                {/* Counter Badges */}
                {item.id === 'defects' && defectCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300">
                    {defectCount}
                  </span>
                )}
                {item.id === 'fleet' && busCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-zinc-800 text-zinc-300">
                    {busCount}
                  </span>
                )}
                {item.id === 'work-orders' && pendingWorkOrders > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {pendingWorkOrders}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer / Mobile Sensing Link */}
      <div className="p-3 border-t border-zinc-800/80 bg-zinc-950/40 space-y-2">
        <button
          onClick={onOpenMobileModal}
          className="w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono font-medium text-zinc-200 bg-zinc-850 hover:bg-zinc-800 border border-zinc-700 transition-colors shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>Mobile Sensing</span>
          </div>
          <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
            QR CODE
          </span>
        </button>

        <div className="text-[10px] text-zinc-400 font-mono text-center">
          SIH 2026 • PS 26124
        </div>
      </div>
    </aside>
  );
}
