import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { 
  X, 
  Smartphone, 
  Copy, 
  Check, 
  ExternalLink, 
  Wifi, 
  Camera, 
  Compass, 
  Activity,
  QrCode,
  Radio
} from 'lucide-react';

export function MobileSensingModal({ isOpen, onClose, localIp }) {
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [selectedIpMode, setSelectedIpMode] = useState('LAN'); // 'LAN' or 'CURRENT'

  if (!isOpen) return null;

  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = typeof window !== 'undefined' ? window.location.port || '8000' : '8000';

  // Compute LAN URL vs Current URL
  const lanHost = localIp && localIp !== '127.0.0.1' ? `${localIp}:${port}` : currentHost;
  const lanUrl = `${protocol}//${lanHost}/mobile`;
  const currentUrl = `${protocol}//${currentHost}/mobile`;

  const activeUrl = selectedIpMode === 'LAN' && localIp && localIp !== '127.0.0.1' ? lanUrl : currentUrl;

  useEffect(() => {
    if (canvasRef.current && activeUrl) {
      QRCode.toCanvas(
        canvasRef.current,
        activeUrl,
        {
          width: 220,
          margin: 1.5,
          color: {
            dark: '#09090b',
            light: '#ffffff'
          }
        },
        (err) => {
          if (err) console.error('[QR] Error generating QR code:', err);
        }
      );
    }
  }, [activeUrl]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden font-sans">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 font-mono">
                PAIR MOBILE SENSING UNIT
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Transform smartphone into a mobile transit sensor node
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs">
          {/* QR Code Canvas Card */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-lg bg-zinc-950/80 border border-zinc-800">
            <div className="p-2 bg-white rounded-lg shadow-md shrink-0 flex items-center justify-center">
              <canvas ref={canvasRef} className="block w-[180px] h-[180px]" />
            </div>

            <div className="flex-1 space-y-3 text-left">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-3 h-3" />
                  Scan with Mobile Camera
                </span>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  Open your phone's camera app to scan this QR code and immediately launch the sensing web terminal.
                </p>
              </div>

              {/* IP Selection if LAN available */}
              {localIp && localIp !== '127.0.0.1' && (
                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    onClick={() => setSelectedIpMode('LAN')}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                      selectedIpMode === 'LAN'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'bg-zinc-850 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    Wi-Fi / LAN IP ({localIp})
                  </button>
                  <button
                    onClick={() => setSelectedIpMode('CURRENT')}
                    className={`px-2 py-1 rounded text-[11px] font-mono font-medium transition-colors ${
                      selectedIpMode === 'CURRENT'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'bg-zinc-850 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    Current Origin
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Copyable Link Bar */}
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 mb-1.5 uppercase">
              Direct Mobile Sensing Link:
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 rounded bg-zinc-950 border border-zinc-800 text-zinc-200 font-mono text-xs truncate select-all">
                {activeUrl}
              </div>

              <button
                onClick={handleCopy}
                className="px-3 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-mono text-xs font-medium border border-zinc-700 flex items-center gap-1.5 transition-colors shrink-0"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy'}</span>
              </button>

              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 font-mono text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0"
              >
                <span>Open</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Quick Setup Checklist */}
          <div className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/80 space-y-2 text-[11px] font-mono text-zinc-400">
            <div className="text-zinc-300 font-bold uppercase text-[10px] flex items-center gap-1.5 border-b border-zinc-800 pb-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse-subtle" />
              Sensor Setup Instructions:
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">1.</span>
                <span>Ensure phone is connected to the same Wi-Fi or laptop hotspot.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">2.</span>
                <span>Grant camera, GPS geolocation, and accelerometer (DeviceMotion) permissions.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">3.</span>
                <span>Mount phone on windshield facing road and tap <strong>'Start Live Sensing'</strong>.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
