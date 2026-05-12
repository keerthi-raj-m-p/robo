'use client';

import React, { useState, useRef } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, X, Wifi, Monitor, Copy, Check, Clock, Activity } from 'lucide-react';

export default function RemoteConnect() {
  const {
    roomId, localIp, hostName, isRemote, connectedRemotes, syncStatus,
    connectedDevices, remoteLogs
  } = useRobotStore();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  if (isRemote) return null;

  const joinUrl = roomId && localIp
    ? `http://${localIp}:3000/mobile?room=${roomId}&host=${localIp}`
    : '';

  const handleCopy = () => {
    if (joinUrl) {
      navigator.clipboard.writeText(joinUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour12: false });
  };

  const timeSince = (ts: number) => {
    const seconds = Math.floor((Date.now() - ts) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ago`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black tracking-widest transition-all relative ${isOpen ? 'bg-[var(--color-robo-accent)] text-[#0b0f1a] shadow-[0_0_15px_var(--color-robo-accent-glow)]' : 'bg-black/40 border border-[var(--color-robo-border)] text-[var(--color-robo-text-muted)] hover:border-[var(--color-robo-accent)] hover:text-[var(--color-robo-text)]'}`}
      >
        <Smartphone size={12} />
        {roomId ? `REMOTE: ${roomId}` : 'MOBILE SYNC'}
        {connectedRemotes > 0 && !isOpen && (
          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--color-robo-accent)] text-[#0b0f1a] text-[8px] font-black rounded-full flex items-center justify-center shadow-[0_0_8px_var(--color-robo-accent-glow)] animate-pulse">
            {connectedRemotes}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-3 w-85 robo-card z-50 animate-fadeIn border-[var(--color-robo-accent-dim)] shadow-[0_10px_60px_rgba(0,0,0,0.9)] max-h-[85vh] overflow-y-auto overflow-x-hidden p-0">
          {/* Header Section */}
          <div className="p-5 border-b border-[var(--color-robo-border)] bg-black/20">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[var(--color-robo-accent)] shadow-[0_0_8px_var(--color-robo-accent)]"></div>
                <span className="text-[10px] font-black text-[var(--color-robo-text)] uppercase tracking-[0.2em]">Live Sync Active</span>
              </div>
              <X size={16} className="cursor-pointer text-[var(--color-robo-text-muted)] hover:text-[var(--color-robo-red)] transition-colors" onClick={() => setIsOpen(false)} />
            </div>
            <h2 className="text-sm font-black text-[var(--color-robo-text-dim)]">MOBILE REMOTE PAIRING</h2>
          </div>

          {!roomId ? (
            <div className="py-12 flex flex-col items-center gap-4 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-[var(--color-robo-border)] border-t-[var(--color-robo-accent)] animate-spin"></div>
              <span className="text-[10px] font-bold text-[var(--color-robo-text-muted)] uppercase tracking-widest">Generating Secure Room...</span>
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* QR Code Container */}
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-[var(--color-robo-accent)] to-[var(--color-robo-blue)] rounded-2xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
                <div className="relative flex flex-col items-center gap-4 p-6 bg-white rounded-xl shadow-2xl">
                  <QRCodeSVG value={joinUrl} size={180} level="H" includeMargin={true} />
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black text-black/40 uppercase tracking-widest">Scan to Connect</span>
                    <span className="text-[8px] font-bold text-black/20 uppercase tracking-widest">Local WiFi Required</span>
                  </div>
                </div>
              </div>

              {/* Host Information */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <Monitor size={12} className="text-[var(--color-robo-accent)]" />
                  <span className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Host Terminal</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/30 rounded-lg p-3 border border-[var(--color-robo-border)]">
                    <span className="text-[8px] text-[var(--color-robo-text-muted)] font-black uppercase block mb-1">Hostname</span>
                    <span className="text-[10px] font-bold text-[var(--color-robo-text)] truncate block">{hostName || 'Unknown'}</span>
                  </div>
                  <div className="bg-black/30 rounded-lg p-3 border border-[var(--color-robo-border)]">
                    <span className="text-[8px] text-[var(--color-robo-text-muted)] font-black uppercase block mb-1">Room ID</span>
                    <span className="text-[10px] font-black text-[var(--color-robo-accent)] tracking-widest block">{roomId}</span>
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg p-3 border border-[var(--color-robo-border)] flex items-center justify-between">
                   <div>
                    <span className="text-[8px] text-[var(--color-robo-text-muted)] font-black uppercase block mb-0.5">LAN Interface</span>
                    <span className="text-[10px] font-bold text-[var(--color-robo-text-dim)] mono">{localIp}:3000</span>
                   </div>
                   <div className="flex items-center gap-2 bg-black/40 px-2 py-1 rounded border border-[var(--color-robo-border)]">
                      <Wifi size={10} className="text-[var(--color-robo-accent)]" />
                      <span className="text-[8px] font-black text-[var(--color-robo-accent)] uppercase">Online</span>
                   </div>
                </div>
              </div>

              {/* Quick Sync Button */}
              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-robo-accent-glow)] border border-[var(--color-robo-accent-dim)] rounded-xl text-[10px] font-black text-[var(--color-robo-accent)] hover:bg-[var(--color-robo-accent)] hover:text-[#0b0f1a] transition-all shadow-lg active:scale-95"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'LINK COPIED' : 'COPY JOIN LINK'}
              </button>

              {/* Connected Remotes */}
              {connectedDevices.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity size={12} className="text-[var(--color-robo-accent)]" />
                      <span className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Linked Nodes</span>
                    </div>
                    <span className="text-[9px] font-black text-[var(--color-robo-accent)]">{connectedDevices.length} ACTIVE</span>
                  </div>
                  <div className="space-y-2">
                    {connectedDevices.map((device) => (
                      <div key={device.id} className="flex items-center justify-between p-3 bg-black/40 rounded-xl border border-[var(--color-robo-border)] group hover:border-[var(--color-robo-accent-dim)] transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-black/40 rounded-lg border border-[var(--color-robo-border)] group-hover:border-[var(--color-robo-accent)] transition-colors">
                            <Smartphone size={12} className="text-[var(--color-robo-accent)]" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] font-bold text-[var(--color-robo-text)]">{device.label}</span>
                            <span className="text-[8px] text-[var(--color-robo-text-muted)] mono truncate max-w-[120px]">{device.userAgent.split(' ')[0]}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={10} className="text-[var(--color-robo-text-muted)]" />
                          <span className="text-[9px] text-[var(--color-robo-text-muted)] font-bold">{timeSince(device.lastSeen)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Console Logs */}
              {remoteLogs.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Network Events</span>
                  <div className="log-console max-h-[120px] bg-black/60 border-[var(--color-robo-border)]">
                    {remoteLogs.slice(-20).map((log, i) => (
                      <div key={i} className="log-line text-[9px] py-0.5">
                        <span className="log-time opacity-40">[{log.time}]</span>{' '}
                        <span className={log.level === 'critical' ? 'text-red-500' : log.level === 'warn' ? 'text-yellow-500' : 'text-blue-400'}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                </div>
              )}

              {/* Instructions */}
              <div className="p-4 bg-black/40 rounded-xl border border-dashed border-[var(--color-robo-border)] text-center">
                <p className="text-[9px] text-[var(--color-robo-text-muted)] leading-relaxed font-bold uppercase tracking-widest">
                  Ensure laptop and mobile are on the <span className="text-[var(--color-robo-accent)]">SAME WIFI NETWORK</span> for successful pairing.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
