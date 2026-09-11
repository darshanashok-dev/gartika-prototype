import React, { useState } from 'react';
import { 
  AlertTriangle, 
  Search, 
  Filter, 
  Download, 
  ShieldCheck, 
  MapPin, 
  Bus, 
  Eye, 
  ClipboardPlus 
} from 'lucide-react';

export function DefectsPage({ defects, onSelectDefect, onCreateWorkOrder, onExportCsv }) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  const [selectedSeverity, setSelectedSeverity] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState('ALL');

  const filteredDefects = defects.filter((d) => {
    const matchesSearch = 
      !search || 
      (d.id && String(d.id).toLowerCase().includes(search.toLowerCase())) ||
      (d.defect_type && d.defect_type.toLowerCase().includes(search.toLowerCase())) ||
      (d.bus_id && d.bus_id.toLowerCase().includes(search.toLowerCase())) ||
      (d.location_name && d.location_name.toLowerCase().includes(search.toLowerCase()));

    const matchesType = 
      selectedType === 'ALL' || 
      (d.defect_type || d.event_type)?.toUpperCase() === selectedType;

    const matchesSeverity = 
      selectedSeverity === 'ALL' || 
      d.severity?.toUpperCase() === selectedSeverity;

    const matchesStatus = 
      selectedStatus === 'ALL' || 
      d.status?.toUpperCase() === selectedStatus;

    return matchesSearch && matchesType && matchesSeverity && matchesStatus;
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>ROAD DEFECT CATALOG & INVENTORY</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Spatially deduplicated physical road hazards, cavitation volumes, and verification records.
          </p>
        </div>

        <button
          onClick={onExportCsv}
          className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Catalog (CSV)</span>
        </button>
      </div>

      {/* Filter Control Bar */}
      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ID, bus, location..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 font-mono focus:outline-none focus:border-zinc-600"
            />
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
          >
            <option value="ALL">All Defect Types</option>
            <option value="POTHOLE">Pothole (Cavitation)</option>
            <option value="ROAD_CRACK">Structural Road Crack</option>
            <option value="SPEED_BREAKER">Speed Breaker</option>
          </select>

          {/* Severity Filter */}
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
          >
            <option value="ALL">All Severities</option>
            <option value="CRITICAL">Critical Severity</option>
            <option value="HIGH">High Severity</option>
            <option value="MEDIUM">Medium Severity</option>
            <option value="LOW">Low Severity</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-1.5 text-xs text-zinc-300 font-mono focus:outline-none focus:border-zinc-600"
          >
            <option value="ALL">All Verification Statuses</option>
            <option value="CANDIDATE">Candidate (Single Bus)</option>
            <option value="VERIFIED">Verified (Multi-Bus)</option>
            <option value="REPAIR_PENDING">Repair Pending</option>
            <option value="REPAIR_VERIFIED">Repair Verified</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
      </div>

      {/* Defects Data Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 text-[11px]">
                <th className="p-3 font-medium">DEFECT ID</th>
                <th className="p-3 font-medium">TYPE</th>
                <th className="p-3 font-medium">SEVERITY</th>
                <th className="p-3 font-medium">STATUS</th>
                <th className="p-3 font-medium">COORDINATES</th>
                <th className="p-3 font-medium">OBSERVATIONS</th>
                <th className="p-3 font-medium">FIRST SEEN</th>
                <th className="p-3 font-medium text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {filteredDefects.length > 0 ? (
                filteredDefects.map((d) => (
                  <tr key={d.id || d.defect_id} className="hover:bg-zinc-800/40 transition-colors">
                    <td className="p-3 font-bold text-amber-400">
                      #{d.id || d.defect_id}
                    </td>
                    <td className="p-3 font-bold text-zinc-200 capitalize">
                      {d.defect_type || d.event_type || 'Pothole'}
                    </td>
                    <td className="p-3">
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
                    <td className="p-3">
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
                    <td className="p-3 text-zinc-300">
                      {d.latitude && d.longitude ? (
                        <span>{d.latitude.toFixed(5)}, {d.longitude.toFixed(5)}</span>
                      ) : (
                        <span className="text-rose-400">UNLOCATED</span>
                      )}
                    </td>
                    <td className="p-3 text-zinc-300">
                      {d.observation_count || 1} hits ({d.unique_bus_count || 1} bus)
                    </td>
                    <td className="p-3 text-zinc-400">
                      {d.created_at ? new Date(d.created_at).toLocaleTimeString() : 'Recent'}
                    </td>
                    <td className="p-3 text-right space-x-1.5">
                      <button
                        onClick={() => onSelectDefect(d)}
                        className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition-colors"
                      >
                        Inspect
                      </button>
                      <button
                        onClick={() => onCreateWorkOrder(d)}
                        title="Dispatch Work Order"
                        className="p-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 transition-colors"
                      >
                        <ClipboardPlus className="w-3.5 h-3.5 inline" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-zinc-400">
                    No defects match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
