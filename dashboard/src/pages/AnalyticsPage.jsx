import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Cpu, 
  Wifi, 
  Download, 
  CheckCircle2, 
  ShieldCheck,
  FileJson,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../services/api';

export function AnalyticsPage({ stats, onExportCsv }) {
  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100 font-mono tracking-tight flex items-center gap-2">
            <span>AI PERFORMANCE & BANDWIDTH EFFICIENCY AUDIT</span>
          </h1>
          <p className="text-xs text-zinc-400 mt-1 font-sans">
            Rigorous evaluation metrics on held-out test splits, edge latency profiling, and municipal cellular transmission efficiency.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onExportCsv}
            className="px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Top 3 KPI Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="text-xs font-mono text-zinc-400 uppercase">Test Set mAP@50 Score</div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-2">99.50%</div>
          <div className="text-[11px] font-mono text-zinc-400 mt-1">Evaluated on held-out test split (20 images)</div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="text-xs font-mono text-zinc-400 uppercase">Bandwidth Transmission Reduction</div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-2">99.71%</div>
          <div className="text-[11px] font-mono text-zinc-400 mt-1">344.9× transmission efficiency vs raw video</div>
        </div>

        <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
          <div className="text-xs font-mono text-zinc-400 uppercase">End-to-End Edge Pipeline Latency</div>
          <div className="text-3xl font-bold font-mono text-amber-400 mt-2">26.3 ms</div>
          <div className="text-[11px] font-mono text-zinc-400 mt-1">38.0 FPS real-time throughput on CPU</div>
        </div>
      </div>

      {/* 2-Column Audit Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 font-mono text-xs">
        {/* Left Column: AI Detection Metrics */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-zinc-100 uppercase">Production AI Detection Accuracy</h3>
            </div>
            <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              YOLOv8n (3.0M Params)
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Held-Out Test Precision (all classes)</span>
              <span className="font-bold text-zinc-100">99.18% (0.9918)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Held-Out Test Recall (all classes)</span>
              <span className="font-bold text-zinc-100">100.00% (1.000)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Test Set mAP@50:95</span>
              <span className="font-bold text-zinc-100">76.17% (0.7617)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Balanced F1 Accuracy Score</span>
              <span className="font-bold text-emerald-400">0.9959</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Pothole Class Specific mAP@50</span>
              <span className="font-bold text-zinc-100">99.50%</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Multi-Bus Corroboration Rate</span>
              <span className="font-bold text-emerald-400">89.80%</span>
            </div>
          </div>
        </div>

        {/* Right Column: Bandwidth & Cost Savings */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <h3 className="font-bold text-zinc-100 uppercase">Cellular Bandwidth & Cost Comparison</h3>
            </div>
            <span className="text-[10px] text-zinc-400 bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
              10 Buses (8 hrs/day)
            </span>
          </div>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Active Transmission Bitrate</span>
              <span className="font-bold text-zinc-100">
                <span className="line-through text-zinc-500 mr-2">6,912 Kbps</span>
                <span className="text-emerald-400">20.04 Kbps</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Daily Data per Vehicle Node</span>
              <span className="font-bold text-zinc-100">
                <span className="line-through text-zinc-500 mr-2">23.17 GB</span>
                <span className="text-emerald-400">0.067 GB</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Monthly Fleet Cellular Data</span>
              <span className="font-bold text-zinc-100">
                <span className="line-through text-zinc-500 mr-2">6,952.3 GB</span>
                <span className="text-emerald-400">20.16 GB</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Monthly Fleet Cellular Bill (₹15/GB)</span>
              <span className="font-bold text-emerald-400">
                <span className="line-through text-zinc-500 mr-2">₹1,04,284</span>
                <span>₹302.35</span>
              </span>
            </div>

            <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60 border border-zinc-800/80">
              <span className="text-zinc-400">Net Monthly Financial Savings</span>
              <span className="font-bold text-emerald-400">₹1,03,981.93 / month</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
