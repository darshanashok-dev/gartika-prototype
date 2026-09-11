import React, { useEffect, useState } from 'react';
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
  Radio,
  Edit3,
  RefreshCw
} from 'lucide-react';

export function MobileSensingModal({ isOpen, onClose, localIp }) {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState(null);
  
  // Custom or detected IP
  const defaultHostname = localIp && localIp !== '127.0.0.1' ? localIp : (typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1');
  const [customHost, setCustomHost] = useState(defaultHostname);
  const [isEditingHost, setIsEditingHost] = useState(false);

  useEffect(() => {
    if (localIp && localIp !== '127.0.0.1') {
      setCustomHost(localIp);
    }
  }, [localIp]);

  const currentHost = typeof window !== 'undefined' ? window.location.host : 'localhost:8000';
  const protocol = typeof window !== 'undefined' ? window.location.protocol : 'http:';
  const port = typeof window !== 'undefined' ? (window.location.port || '8000') : '8000';

  // Construct final mobile sensing target URL
  const hostWithPort = customHost.includes(':') ? customHost : `${customHost}:${port}`;
  const activeUrl = `${protocol}//${hostWithPort}/mobile/`;

  // Generate QR Code as DataURL on any URL change
  useEffect(() => {
    if (!isOpen || !activeUrl) return;

    QRCode.toDataURL(
      activeUrl,
      {
        width: 320,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#09090b',
          light: '#ffffff'
        }
      }
    )
      .then((url) => {
        setQrDataUrl(url);
        setQrError(null);
      })
      .catch((err) => {
        console.error('[QR] Generation error:', err);
        setQrError('Failed to render QR Code');
      });
  }, [activeUrl, isOpen]);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden font-sans">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 font-mono">
                PAIR MOBILE SENSING UNIT
              </h3>
              <p className="text-[11px] text-zinc-400 font-mono">
                Scan QR Code with smartphone camera to launch sensing HUD
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 text-xs">
          
          {/* QR Code Presentation Box */}
          <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-lg bg-zinc-950/80 border border-zinc-800">
            <div className="p-2.5 bg-white rounded-lg shadow-lg shrink-0 flex items-center justify-center">
              {qrDataUrl ? (
                <img 
                  src={qrDataUrl} 
                  alt="Mobile Pairing QR Code" 
                  className="w-[180px] h-[180px] object-contain block"
                />
              ) : (
                <div className="w-[180px] h-[180px] flex items-center justify-center text-zinc-800 font-mono text-xs">
                  {qrError || 'Generating QR...'}
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3 text-left">
              <div className="space-y-1">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1">
                  <QrCode className="w-3.5 h-3.5" />
                  Instant Camera Pair
                </span>
                <p className="text-zinc-300 text-xs leading-relaxed">
                  Point your phone's native camera at this QR code. Tap the notification banner to open the transit sensing terminal.
                </p>
              </div>

              {/* IP Selection & Custom IP Toggle */}
              <div className="space-y-1.5 pt-1 font-mono text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {localIp && localIp !== '127.0.0.1' && (
                    <button
                      onClick={() => setCustomHost(localIp)}
                      className={`px-2 py-1 rounded transition-colors ${
                        customHost === localIp
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                          : 'bg-zinc-850 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                      }`}
                    >
                      LAN IP ({localIp})
                    </button>
                  )}

                  <button
                    onClick={() => setCustomHost(typeof window !== 'undefined' ? window.location.hostname : 'localhost')}
                    className={`px-2 py-1 rounded transition-colors ${
                      customHost === (typeof window !== 'undefined' ? window.location.hostname : 'localhost')
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'bg-zinc-850 text-zinc-400 border border-zinc-800 hover:text-zinc-200'
                    }`}
                  >
                    Current Host
                  </button>

                  <button
                    onClick={() => setIsEditingHost(!isEditingHost)}
                    className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3" />
                    <span>Edit IP</span>
                  </button>
                </div>

                {isEditingHost && (
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={customHost}
                      onChange={(e) => setCustomHost(e.target.value.trim())}
                      placeholder="e.g. 192.168.1.5"
                      className="flex-1 px-2.5 py-1 bg-zinc-950 border border-zinc-700 rounded text-amber-300 font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Direct Link & Action Bar */}
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 mb-1.5 uppercase">
              Target Sensing URL:
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

          {/* Checklist Instructions */}
          <div className="p-3 rounded-lg bg-zinc-950/40 border border-zinc-800/80 space-y-2 text-[11px] font-mono text-zinc-400">
            <div className="text-zinc-300 font-bold uppercase text-[10px] flex items-center gap-1.5 border-b border-zinc-800 pb-1">
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse-subtle" />
              Quick Setup Guidance:
            </div>
            <div className="space-y-1.5">
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">1.</span>
                <span>Connect your phone to the same Wi-Fi or laptop hotspot.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">2.</span>
                <span>Allow Camera, GPS Geolocation, and DeviceMotion sensor permissions.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-amber-400 font-bold">3.</span>
                <span>Mount phone facing forward and tap <strong>'Start Sensing'</strong>.</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
