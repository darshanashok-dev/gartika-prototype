import React, { useState } from 'react';
import { 
  ClipboardList, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  ChevronRight, 
  ShieldCheck, 
  RefreshCw,
  Plus
} from 'lucide-react';
import { api } from '../services/api';

export function WorkOrdersPage({ workOrders, onRefresh, onOpenCreateModal }) {
  const [updatingId, setUpdatingId] = useState(null);

  const handleStatusTransition = async (woId, newStatus) => {
    setUpdatingId(woId);
    try {
      await api.updateWorkOrder(woId, { status: newStatus });
      onRefresh?.();
    } catch (err) {
      alert(`Failed to update status: ${err.message}`);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>MUNICIPAL WORK ORDER DISPATCH</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Maintenance ticketing, repair contractor assignments, and closed-loop re-transit sensor verification.
          </p>
        </div>

        <button
          onClick={onOpenCreateModal}
          className="px-3 py-1.5 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>New Work Order</span>
        </button>
      </div>

      {/* Work Orders Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="bg-zinc-950/60 text-zinc-400 border-b border-zinc-800 text-[11px]">
                <th className="p-3 font-medium">ORDER ID</th>
                <th className="p-3 font-medium">DEFECT REF</th>
                <th className="p-3 font-medium">PRIORITY</th>
                <th className="p-3 font-medium">STATUS</th>
                <th className="p-3 font-medium">ASSIGNED CREW</th>
                <th className="p-3 font-medium">DISPATCHED AT</th>
                <th className="p-3 font-medium text-right">STAGE TRANSITION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {workOrders.length > 0 ? (
                workOrders.map((wo) => {
                  const isPending = updatingId === wo.id || updatingId === wo.work_order_id;
                  const currentStatus = wo.status?.toUpperCase() || 'OPEN';

                  return (
                    <tr key={wo.id || wo.work_order_id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3 font-bold text-amber-400">
                        #{wo.id || wo.work_order_id}
                      </td>

                      <td className="p-3 text-zinc-300">
                        Defect #{wo.defect_id || 'DEF-01'}
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          wo.priority === 'CRITICAL'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800'
                            : wo.priority === 'HIGH'
                            ? 'bg-amber-950/80 text-amber-300 border border-amber-800'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}>
                          {wo.priority || 'HIGH'}
                        </span>
                      </td>

                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                          currentStatus === 'COMPLETED' || currentStatus === 'CLOSED'
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800'
                            : currentStatus === 'IN_PROGRESS'
                            ? 'bg-sky-950/80 text-sky-300 border border-sky-800'
                            : currentStatus === 'REPAIR_PENDING' || currentStatus === 'REPAIRED'
                            ? 'bg-purple-950/80 text-purple-300 border border-purple-800'
                            : 'bg-amber-950/80 text-amber-300 border border-amber-800'
                        }`}>
                          {currentStatus}
                        </span>
                      </td>

                      <td className="p-3 text-zinc-300">
                        {wo.assigned_to || 'Central Maintenance Crew'}
                      </td>

                      <td className="p-3 text-zinc-400">
                        {wo.created_at ? new Date(wo.created_at).toLocaleString() : 'Recent'}
                      </td>

                      <td className="p-3 text-right">
                        {currentStatus === 'OPEN' && (
                          <button
                            onClick={() => handleStatusTransition(wo.id || wo.work_order_id, 'IN_PROGRESS')}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded bg-sky-950 hover:bg-sky-900 text-sky-300 border border-sky-800 text-[11px] font-medium transition-colors"
                          >
                            Mark In Progress
                          </button>
                        )}

                        {currentStatus === 'IN_PROGRESS' && (
                          <button
                            onClick={() => handleStatusTransition(wo.id || wo.work_order_id, 'REPAIR_PENDING')}
                            disabled={isPending}
                            className="px-2.5 py-1 rounded bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-800 text-[11px] font-medium transition-colors"
                          >
                            Mark Repaired (Awaiting Verification)
                          </button>
                        )}

                        {(currentStatus === 'REPAIR_PENDING' || currentStatus === 'REPAIRED') && (
                          <div className="inline-flex items-center gap-1.5 text-[10px] text-amber-400 font-mono">
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            <span>Awaiting Bus Re-transit</span>
                          </div>
                        )}

                        {(currentStatus === 'COMPLETED' || currentStatus === 'CLOSED') && (
                          <div className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Verified Closed</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400">
                    No active municipal work orders found. Issue a work order from the Defects catalog.
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
