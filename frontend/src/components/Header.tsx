'use client';

import React from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { Smartphone, Wifi } from 'lucide-react';

export default function TopBar() {
  const { connectionMode, activeTab, roomId, hostName, connectedRemotes, localIp, syncStatus } = useRobotStore();

  const modeLabel = connectionMode === 'usb' ? 'Connected' : connectionMode === 'wifi' ? 'WiFi' : 'Disconnected';

  return (
    <header className="flex items-center justify-between px-3 md:px-5 py-2 md:py-3 border-b border-[var(--color-robo-border)] bg-[var(--color-robo-card)] shrink-0">
      <div className="flex items-center gap-2 md:gap-3">
        <button className="text-[var(--color-robo-text-dim)] hover:text-[var(--color-robo-text)] text-xl">☰</button>
        <div>
          <h1 className="text-sm md:text-base font-bold tracking-wide text-[var(--color-robo-text)] uppercase md:normal-case">Robo-Link</h1>
          <div className="flex items-center gap-1.5">
            <span className={`status-dot ${connectionMode !== 'disconnected' ? 'status-dot-green' : 'status-dot-red'}`}></span>
            <span className={`text-[10px] md:text-xs font-medium ${connectionMode !== 'disconnected' ? 'text-[var(--color-robo-accent)]' : 'text-[var(--color-robo-red)]'}`}>{modeLabel}</span>
          </div>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-1">
        <span className="text-sm font-medium text-[var(--color-robo-text-dim)] capitalize">{activeTab === 'io' ? 'I/O' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
        <span className="text-[var(--color-robo-text-muted)] text-xs">▼</span>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* Room Info Pill */}
        {roomId && (
          <div className="flex items-center gap-2 bg-[var(--color-robo-accent-glow)] border border-[var(--color-robo-accent-dim)] rounded-lg px-2 md:px-3 py-1 md:py-1.5">
            <Smartphone size={12} className="text-[var(--color-robo-accent)]" />
            <div className="text-right hidden xs:block">
              <div className="text-[8px] text-[var(--color-robo-text-muted)] leading-tight font-black uppercase truncate max-w-[60px] md:max-w-[80px]">{hostName || 'HOST'}</div>
              <div className="text-[10px] md:text-xs font-black text-[var(--color-robo-accent)] tracking-[0.1em]">{roomId}</div>
            </div>
          </div>
        )}

        <div className="hidden sm:flex items-center gap-2 bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded-lg px-3 py-1.5">
          <div className="w-8 h-4 rounded-sm border border-[var(--color-robo-accent)] relative overflow-hidden">
            <div className="absolute inset-0 bg-[var(--color-robo-accent)]" style={{ width: '86%' }}></div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-[var(--color-robo-text-muted)] leading-tight">Arm Battery</div>
            <div className="text-xs font-bold text-[var(--color-robo-text)]">86%</div>
          </div>
        </div>
        <button className="text-[var(--color-robo-text-dim)] hover:text-[var(--color-robo-text)] text-lg">⚙</button>
      </div>
    </header>
  );
}
