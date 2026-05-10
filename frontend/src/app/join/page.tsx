'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { useRouter, useSearchParams } from 'next/navigation';
import { Smartphone, Wifi, ArrowRight, ShieldCheck, Activity } from 'lucide-react';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState<'idle' | 'joining' | 'error'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    const room = searchParams.get('room');
    const host = searchParams.get('host');
    if (room && host) {
      // Auto-join if params present
      handleJoin(room, host);
    }
  }, [searchParams]);

  const handleJoin = (targetRoom: string, targetHost?: string) => {
    if (!targetRoom) return;
    setStatus('joining');
    
    // In a real app, we'd verify room exists here.
    // For now, we just redirect to main app with remote params.
    // useRemoteSync will handle the actual socket connection.
    
    setTimeout(() => {
      const host = targetHost || window.location.hostname;
      router.push(`/?room=${targetRoom.toUpperCase()}&host=${host}`);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-[var(--color-robo-bg)] flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm robo-card p-8 border-[var(--color-robo-accent-dim)] shadow-[0_0_50px_rgba(121,192,255,0.1)]">
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl bg-[var(--color-robo-accent-glow)] flex items-center justify-center border border-[var(--color-robo-accent-dim)] shadow-[0_0_20px_var(--color-robo-accent-glow)]">
            <Smartphone size={32} className="text-[var(--color-robo-accent)]" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-black text-[var(--color-robo-text)] tracking-tight">ROBO-LINK REMOTE</h1>
            <p className="text-[10px] text-[var(--color-robo-text-muted)] uppercase tracking-[0.2em] font-bold mt-1">Mobile Synchronization Hub</p>
          </div>
        </div>

        {status === 'joining' ? (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="relative w-12 h-12">
              <div className="absolute inset-0 rounded-full border-4 border-[var(--color-robo-border)]"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-[var(--color-robo-accent)] animate-spin"></div>
            </div>
            <span className="text-[10px] font-black tracking-widest text-[var(--color-robo-accent)] animate-pulse">ESTABLISHING ENCRYPTED LINK...</span>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest ml-1">Terminal ID (Room ID)</label>
              <div className="relative">
                <input 
                  type="text" 
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="ENTER 6-CHAR CODE"
                  maxLength={6}
                  className="w-full bg-black/40 border border-[var(--color-robo-border)] rounded-xl px-5 py-4 text-center text-xl font-black text-[var(--color-robo-accent)] tracking-[0.5em] outline-none focus:border-[var(--color-robo-accent)] focus:shadow-[0_0_15px_var(--color-robo-accent-glow)] transition-all placeholder:text-gray-700 placeholder:tracking-normal placeholder:text-xs"
                />
              </div>
            </div>

            <button 
              onClick={() => handleJoin(roomId)}
              disabled={roomId.length < 6}
              className="w-full bg-[var(--color-robo-accent)] text-[#0b0f1a] py-4 rounded-xl font-black tracking-[0.2em] flex items-center justify-center gap-3 hover:shadow-[0_0_30px_var(--color-robo-accent-glow)] active:scale-95 disabled:opacity-30 disabled:grayscale transition-all"
            >
              CONNECT TO HOST <ArrowRight size={18} />
            </button>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-[var(--color-robo-border)]">
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-black/20 border border-[var(--color-robo-border)]">
                <Wifi size={14} className="text-[var(--color-robo-accent)]" />
                <span className="text-[8px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Local Mesh</span>
              </div>
              <div className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-black/20 border border-[var(--color-robo-border)]">
                <Activity size={14} className="text-[var(--color-robo-accent)]" />
                <span className="text-[8px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Real-Time Sync</span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-[8px] text-[var(--color-robo-text-muted)] font-bold uppercase tracking-widest opacity-40">
              <ShieldCheck size={10} />
              Secure Local Wi-Fi Connection
            </div>
          </div>
        )}
      </div>

      <div className="mt-8 text-[9px] text-[var(--color-robo-text-muted)] font-bold uppercase tracking-widest animate-pulse">
        Waiting for Host Synchronization...
      </div>
    </div>
  );
}

export default function JoinRoom() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-robo-bg)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[var(--color-robo-border)] border-t-[var(--color-robo-accent)] animate-spin"></div>
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
