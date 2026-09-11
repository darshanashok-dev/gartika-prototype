import React, { useState } from 'react';
import { X, ClipboardList, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';

export function CreateWorkOrderModal({ defect, onClose, onSuccess }) {
  const [priority, setPriority] = useState(defect?.severity || 'HIGH');
  const [assignedCrew, setAssignedCrew] = useState('Central Asphalt Division');
  const [notes, setNotes] = useState(`Repair physical cavitation at observed coordinates. Multi-bus corroboration indicates active road defect.`);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!defect) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const payload = {
        defect_id: defect.id || defect.defect_id,
        bus_id: defect.bus_id || 'BUS-101',
        priority: priority.toUpperCase(),
        assigned_to: assignedCrew,
        description: notes,
        latitude: defect.latitude,
        longitude: defect.longitude
      };

      await api.createWorkOrder(payload);
      setIsSubmitting(false);
      onSuccess?.();
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to create work order');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-zinc-100 font-mono">
              Issue Municipal Maintenance Work Order
            </h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs font-sans">
          {errorMsg && (
            <div className="p-3 rounded bg-rose-950/60 border border-rose-800 text-rose-300 flex items-center gap-2 font-mono">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="p-3 rounded bg-zinc-950/60 border border-zinc-800 flex items-center justify-between font-mono">
            <div>
              <span className="text-zinc-500 block text-[10px]">TARGET DEFECT</span>
              <span className="text-zinc-200 font-bold uppercase">{defect.defect_type || defect.event_type || 'Road Defect'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">ORIGIN UNIT</span>
              <span className="text-zinc-200 font-bold">{defect.bus_id || 'BUS-101'}</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px]">COORDINATES</span>
              <span className="text-zinc-300">
                {defect.latitude ? `${defect.latitude.toFixed(4)}, ${defect.longitude.toFixed(4)}` : 'UNLOCATED'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-zinc-400 font-mono text-[11px] mb-1">
              Priority Escalation Level
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
            >
              <option value="CRITICAL">CRITICAL — Immediate Transit Hazard</option>
              <option value="HIGH">HIGH — Structural Cavitation</option>
              <option value="MEDIUM">MEDIUM — Moderate Road Defect</option>
              <option value="LOW">LOW — Surface Fracture / Minor</option>
            </select>
          </div>

          <div>
            <label className="block text-zinc-400 font-mono text-[11px] mb-1">
              Assigned Contractor / Municipal Division
            </label>
            <input
              type="text"
              value={assignedCrew}
              onChange={(e) => setAssignedCrew(e.target.value)}
              required
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 font-mono text-xs focus:outline-none focus:border-zinc-600"
            />
          </div>

          <div>
            <label className="block text-zinc-400 font-mono text-[11px] mb-1">
              Work Instructions & Site Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-zinc-200 text-xs focus:outline-none focus:border-zinc-600 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs font-medium transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin"></div>
                  Dispatching...
                </>
              ) : (
                'Dispatch Work Order'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
