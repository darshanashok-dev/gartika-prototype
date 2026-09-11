import React, { useEffect, useRef, useState } from 'react';
import { 
  Bus as BusIcon, 
  AlertTriangle, 
  Layers, 
  Filter, 
  Compass, 
  Navigation,
  ShieldCheck,
  Maximize2
} from 'lucide-react';

export function LiveMapPage({ defects, buses, onSelectDefect, selectedDefect }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({ buses: {}, defects: {} });
  
  const [filterType, setFilterType] = useState('ALL');
  const [filterVerifiedOnly, setFilterVerifiedOnly] = useState(false);
  const [filterHighSeverityOnly, setFilterHighSeverityOnly] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    const L = window.L;
    if (!L) return;

    // Default center: Bengaluru area if defects exist, or fallback
    const firstDefectWithGps = defects.find(d => d.latitude && d.longitude);
    const firstBusWithGps = buses.find(b => b.latitude && b.longitude);
    const centerLat = firstDefectWithGps?.latitude || firstBusWithGps?.latitude || 12.9716;
    const centerLng = firstDefectWithGps?.longitude || firstBusWithGps?.longitude || 77.5946;

    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([centerLat, centerLng], 14);

    // Dark Matter tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update Markers on Map when defects, buses, or filters change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = window.L;
    if (!map || !L) return;

    // 1. Render Defects
    // Clear old defect markers
    Object.values(markersRef.current.defects).forEach(m => map.removeLayer(m));
    markersRef.current.defects = {};

    defects.forEach((d) => {
      if (!d.latitude || !d.longitude) return;

      // Filter checks
      if (filterType !== 'ALL' && (d.defect_type || d.event_type)?.toUpperCase() !== filterType) return;
      if (filterVerifiedOnly && d.status !== 'VERIFIED') return;
      if (filterHighSeverityOnly && (d.severity !== 'HIGH' && d.severity !== 'CRITICAL')) return;

      const isSelected = selectedDefect && (selectedDefect.id === d.id || selectedDefect.defect_id === d.defect_id);
      const isVerified = d.status === 'VERIFIED';
      const isCritical = d.severity === 'CRITICAL' || d.severity === 'HIGH';

      const color = isVerified 
        ? '#10b981' 
        : isCritical 
        ? '#f43f5e' 
        : d.severity === 'MEDIUM' 
        ? '#f59e0b' 
        : '#eab308';

      const marker = L.circleMarker([d.latitude, d.longitude], {
        radius: isSelected ? 11 : (isVerified ? 8 : 6),
        fillColor: color,
        color: isSelected ? '#ffffff' : '#09090b',
        weight: isSelected ? 3 : 1.5,
        opacity: 1,
        fillOpacity: 0.9
      }).addTo(map);

      marker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="font-size: 10px; font-family: monospace; color: #a1a1aa; text-transform: uppercase;">
            ${d.status || 'CANDIDATE'} • #${d.id || d.defect_id}
          </div>
          <div style="font-size: 13px; font-weight: bold; color: #f4f4f5; text-transform: capitalize; margin-top: 2px;">
            ${d.defect_type || d.event_type || 'Road Defect'}
          </div>
          <div style="font-size: 11px; color: ${color}; font-weight: 600; margin-top: 2px;">
            Severity: ${d.severity || 'HIGH'} • ${(d.confidence ? d.confidence * 100 : 85).toFixed(0)}% Conf
          </div>
          <div style="font-size: 10px; font-family: monospace; color: #71717a; margin-top: 4px;">
            ${d.latitude.toFixed(5)}, ${d.longitude.toFixed(5)}
          </div>
        </div>
      `);

      marker.on('click', () => {
        onSelectDefect(d);
      });

      markersRef.current.defects[d.id || d.defect_id] = marker;
    });

    // 2. Render Buses
    Object.values(markersRef.current.buses).forEach(m => map.removeLayer(m));
    markersRef.current.buses = {};

    buses.forEach((b) => {
      if (!b.latitude || !b.longitude) return;

      const busIconHtml = `
        <div style="background: #f59e0b; color: #09090b; width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-family: monospace; font-size: 11px; border: 2px solid #ffffff; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.4);">
          🚌
        </div>
      `;

      const busIcon = L.divIcon({
        html: busIconHtml,
        className: 'bus-marker-custom',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const busMarker = L.marker([b.latitude, b.longitude], { icon: busIcon }).addTo(map);
      busMarker.bindPopup(`
        <div style="font-family: 'Plus Jakarta Sans', sans-serif;">
          <div style="font-size: 10px; font-family: monospace; color: #f59e0b; font-weight: bold;">
            ${b.bus_id} (ONLINE)
          </div>
          <div style="font-size: 12px; color: #f4f4f5; font-weight: 600; margin-top: 2px;">
            ${b.name || 'Mobile Sensing Unit'}
          </div>
          <div style="font-size: 11px; color: #a1a1aa; font-family: monospace; margin-top: 2px;">
            Speed: ${(b.speed || 0).toFixed(1)} km/h • Heading: ${b.heading || 0}°
          </div>
        </div>
      `);

      markersRef.current.buses[b.bus_id] = busMarker;
    });

  }, [defects, buses, filterType, filterVerifiedOnly, filterHighSeverityOnly, selectedDefect]);

  // Center map on selected bus or defect
  const handleFocusBus = (bus) => {
    if (mapInstanceRef.current && bus.latitude && bus.longitude) {
      mapInstanceRef.current.flyTo([bus.latitude, bus.longitude], 16, { duration: 1 });
      setSelectedBusId(bus.bus_id);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] bg-zinc-950 flex flex-col">
      {/* Top Floating Map Controls Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Filter Badges */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg p-1.5 flex items-center gap-1 shadow-lg pointer-events-auto">
          <button
            onClick={() => setFilterType('ALL')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
              filterType === 'ALL' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            ALL
          </button>
          <button
            onClick={() => setFilterType('POTHOLE')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
              filterType === 'POTHOLE' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            POTHOLES
          </button>
          <button
            onClick={() => setFilterType('ROAD_CRACK')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
              filterType === 'ROAD_CRACK' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            CRACKS
          </button>
          <button
            onClick={() => setFilterType('SPEED_BREAKER')}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors ${
              filterType === 'SPEED_BREAKER' ? 'bg-amber-500 text-zinc-950 font-bold' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            SPEED BREAKERS
          </button>

          <div className="w-[1px] h-4 bg-zinc-750 mx-1"></div>

          <button
            onClick={() => setFilterVerifiedOnly(!filterVerifiedOnly)}
            className={`px-2.5 py-1 rounded text-xs font-mono font-medium transition-colors flex items-center gap-1 ${
              filterVerifiedOnly ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            VERIFIED ONLY
          </button>
        </div>

        {/* Bus Follow Quick Select */}
        <div className="bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg p-1.5 flex items-center gap-2 shadow-lg pointer-events-auto">
          <BusIcon className="w-3.5 h-3.5 text-amber-400 ml-1" />
          <span className="text-[11px] font-mono text-zinc-400">Fleet:</span>
          {buses.map((b) => (
            <button
              key={b.bus_id}
              onClick={() => handleFocusBus(b)}
              className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
                selectedBusId === b.bus_id ? 'bg-zinc-800 text-amber-400 font-bold border border-zinc-700' : 'text-zinc-300 hover:bg-zinc-800/60'
              }`}
            >
              {b.bus_id}
            </button>
          ))}
        </div>
      </div>

      {/* Map Canvas */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full z-10" />

      {/* Bottom Floating Legend Bar */}
      <div className="absolute bottom-4 left-4 z-20 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-lg p-2.5 shadow-lg flex items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
          <span className="text-zinc-300 text-[11px]">Critical / High Hazard</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span className="text-zinc-300 text-[11px]">Moderate Defect</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span className="text-zinc-300 text-[11px]">Multi-Bus Verified</span>
        </div>
        <div className="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
          <span className="text-zinc-400 text-[11px]">Plotted: {defects.filter(d => d.latitude && d.longitude).length} coordinates</span>
        </div>
      </div>
    </div>
  );
}
