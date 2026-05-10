'use client';

import React, { useState } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, X, Check, Wifi, Monitor } from 'lucide-react';

export default function RemoteConnect() {
  const { roomId, localIp, isRemote } = useRobotStore();
  const [isOpen, setIsOpen] = useState(false);

  if (isRemote) return null; // Don't show on mobile

  const joinUrl = roomId && localIp 
    ? `${window.location.origin}/join?room=${roomId}&host=${localIp}`
    : '';

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition-all ${isOpen ? 'bg-[var(--color-robo-accent)] text-[#0b0f1a] shadow-[0_0_15px_var(--color-robo-accent-glow)]' : 'bg-black/40 border border-[var(--color-robo-border)] text-[var(--color-robo-text-muted)] hover:border-[var(--color-robo-accent)] hover:text-[var(--color-robo-text)]'}`}
      >
        <Smartphone size={12} />
        {roomId ? `REMOTE: ${roomId}` : 'MOBILE SYNC'}
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 robo-card z-50 animate-fadeIn border-[var(--color-robo-accent-dim)] shadow-[0_10px_40px_rgba(0,0,0,0.8)]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Mobile Remote Access</span>
            <X size={14} className="cursor-pointer hover:text-[var(--color-robo-red)]" onClick={() => setIsOpen(false)} />
          </div>

          {!roomId ? (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="w-8 h-8 rounded-full border-2 border-[var(--color-robo-border)] border-t-[var(--color-robo-accent)] animate-spin"></div>
              <span className="text-[10px] text-[var(--color-robo-text-muted)]">Initializing secure room...</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 p-4 bg-white rounded-xl shadow-inner">
                <QRCodeSVG value={joinUrl} size={140} level="H" />
              </div>

              <div className="bg-black/30 rounded-lg p-3 space-y-2 border border-[var(--color-robo-border)]">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[var(--color-robo-text-muted)] font-bold uppercase">Room ID</span>
                  <span className="text-sm font-black text-[var(--color-robo-accent)] tracking-[0.2em]">{roomId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[var(--color-robo-text-muted)] font-bold uppercase">Local IP</span>
                  <span className="text-[10px] font-bold text-[var(--color-robo-text)] mono">{localIp}</span>
                </div>
              </div>

              <div className="text-[9px] text-[var(--color-robo-text-muted)] text-center leading-relaxed">
                Connect your phone to <span className="text-[var(--color-robo-text)] font-bold">SAME WI-FI</span> network and scan the QR code to start controlling.
              </div>

              <div className="flex items-center justify-center gap-4 pt-2 border-t border-[var(--color-robo-border)]">
                <div className="flex items-center gap-1">
                  <Wifi size={10} className="text-[var(--color-robo-accent)]" />
                  <span className="text-[8px] font-bold uppercase">Local Link</span>
                </div>
                <div className="flex items-center gap-1">
                  <Monitor size={10} className="text-[var(--color-robo-accent)]" />
                  <span className="text-[8px] font-bold uppercase">Active Host</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
