'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Smartphone, Wifi, ArrowRight, ShieldCheck, Activity, Camera, X, AlertTriangle } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';

function JoinContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [roomId, setRoomId] = useState('');
  const [status, setStatus] = useState<'idle' | 'joining' | 'validating' | 'error' | 'scanning'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'scanning') {
      const scanner = new Html5QrcodeScanner("reader", { 
        fps: 10, 
        qrbox: { width: 250, height: 250 } 
      }, false);

      scanner.render((decodedText) => {
        scanner.clear();
        try {
          const url = new URL(decodedText);
          const room = url.searchParams.get('room');
          const host = url.searchParams.get('host');
          if (room && host) {
            handleJoin(room, host);
          } else {
            setError('Invalid QR code — missing room or host info');
            setStatus('error');
          }
        } catch {
          setError('Invalid QR code format');
          setStatus('error');
        }
      }, () => {
        // Scan error — ignore, keep scanning
      });

      return () => {
        scanner.clear().catch(() => {});
      };
    }
  }, [status]);

  useEffect(() => {
    const room = searchParams.get('room');
    const host = searchParams.get('host');
    if (room && host) {
      handleJoin(room, host);
    }
  }, [searchParams]);

  const validateRoom = async (targetRoom: string, targetHost: string): Promise<boolean> => {
    try {
      const res = await fetch(`http://${targetHost}:3001/api/room/${targetRoom}`, {
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        const data = await res.json();
        return data.valid === true;
      }
      return false;
    } catch (e) {
      // If validation fails (e.g. firewall block on 3001), 
      // proceed to socket connection which is more robust
      console.warn('[Join] Room validation timed out or failed, proceeding to direct link');
      return true;
    }
  };

  const handleJoin = async (targetRoom: string, targetHost?: string) => {
    if (!targetRoom || targetRoom.length < 6) {
      setError('Room ID must be 6 characters');
      setStatus('error');
      return;
    }

    setStatus('validating');
    setError('');

    const host = targetHost || window.location.hostname;
    const isValid = await validateRoom(targetRoom.toUpperCase(), host);

    if (!isValid) {
      setError('Room not found. Check the Room ID and make sure the host is running.');
      setStatus('error');
      return;
    }

    setStatus('joining');

    // Redirect to the dedicated mobile controller page
    setTimeout(() => {
      router.push(`/mobile?room=${targetRoom.toUpperCase()}&host=${host}`);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[var(--color-robo-bg)] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[var(--color-robo-accent-glow)] rounded-full blur-[120px] opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-robo-blue)] rounded-full blur-[120px] opacity-10 animate-pulse" style={{ animationDelay: '1s' }}></div>

      <div className="w-full max-w-sm robo-card p-10 border-[var(--color-robo-accent-dim)] shadow-[0_20px_80px_rgba(0,0,0,0.8)] relative z-10">
        <div className="flex flex-col items-center gap-6 mb-10">
          <div className="relative group">
            <div className="absolute -inset-2 bg-gradient-to-r from-[var(--color-robo-accent)] to-[var(--color-robo-blue)] rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
            <div className="relative w-20 h-20 rounded-2xl bg-black/40 flex items-center justify-center border border-[var(--color-robo-accent-dim)] backdrop-blur-xl">
              <Smartphone size={40} className="text-[var(--color-robo-accent)]" />
            </div>
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-[var(--color-robo-text)] tracking-tight">ROBO-LINK</h1>
            <p className="text-[10px] text-[var(--color-robo-accent)] uppercase tracking-[0.3em] font-black mt-2 bg-[var(--color-robo-accent-glow)] px-3 py-1 rounded-full border border-[var(--color-robo-accent-dim)]">Mobile Control Hub</p>
          </div>
        </div>

        {status === 'scanning' ? (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Align QR Code</span>
              <button 
                onClick={() => setStatus('idle')}
                className="p-2 hover:bg-white/5 rounded-full transition-colors"
              >
                <X size={20} className="text-[var(--color-robo-text-muted)]" />
              </button>
            </div>
            <div id="reader" className="overflow-hidden rounded-2xl border-2 border-[var(--color-robo-accent-dim)] bg-black/60 shadow-[0_0_40px_var(--color-robo-accent-glow)] aspect-square"></div>
            <p className="text-[9px] text-center text-[var(--color-robo-text-muted)] font-bold uppercase tracking-widest">
              Scanning for host terminal...
            </p>
          </div>
        ) : status === 'joining' || status === 'validating' ? (
          <div className="py-16 flex flex-col items-center gap-6">
            <div className="relative w-16 h-16">
              <div className="absolute inset-0 rounded-full border-4 border-white/5"></div>
              <div className="absolute inset-0 rounded-full border-4 border-t-[var(--color-robo-accent)] animate-spin shadow-[0_0_20px_var(--color-robo-accent-glow)]"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Wifi size={16} className="text-[var(--color-robo-accent)] animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <span className="text-[10px] font-black tracking-[0.2em] text-[var(--color-robo-accent)] uppercase block animate-pulse">
                {status === 'validating' ? 'Authenticating Room...' : 'Handshaking with Host...'}
              </span>
              <span className="text-[8px] font-bold text-[var(--color-robo-text-muted)] uppercase tracking-widest block">
                Establishing Secure Tunnel
              </span>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-fadeIn">
            {status === 'error' && error && (
              <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl animate-shake">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <span className="text-[11px] text-red-500 font-bold leading-relaxed">{error}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Terminal ID</label>
                <span className="text-[9px] font-bold text-[var(--color-robo-accent)] opacity-50">6 CHARACTERS</span>
              </div>
              <div className="relative group">
                <div className="absolute -inset-1 bg-[var(--color-robo-accent)] rounded-2xl blur opacity-0 group-focus-within:opacity-10 transition duration-500"></div>
                <input 
                  type="text" 
                  value={roomId}
                  onChange={(e) => { 
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                    setRoomId(val); 
                    if (status === 'error') setStatus('idle'); 
                  }}
                  placeholder="ID CODE"
                  maxLength={6}
                  className="w-full bg-black/40 border border-[var(--color-robo-border)] rounded-2xl px-5 py-4 text-center text-2xl font-black text-[var(--color-robo-accent)] outline-none focus:border-[var(--color-robo-accent)] transition-all placeholder:text-white/10 placeholder:text-sm uppercase"
                />
              </div>
            </div>

            <div className="space-y-4">
              <button 
                onClick={() => handleJoin(roomId)}
                disabled={roomId.length < 6 || status === 'validating' || status === 'joining'}
                className="w-full bg-[var(--color-robo-accent)] text-[#0b0f1a] py-5 rounded-2xl font-black tracking-widest flex items-center justify-center gap-3 hover:shadow-[0_0_40px_var(--color-robo-accent-glow)] active:scale-95 disabled:opacity-30 transition-all uppercase text-sm"
              >
                {status === 'validating' ? 'Checking...' : 'Connect to Robot'} <ArrowRight size={20} />
              </button>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[var(--color-robo-border)]"></div></div>
                <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.3em]"><span className="bg-[var(--color-robo-bg)] px-4 text-[var(--color-robo-text-muted)]">OR</span></div>
              </div>

              <button 
                onClick={() => setStatus('scanning')}
                className="w-full bg-white/5 border border-[var(--color-robo-border)] text-[var(--color-robo-text)] py-5 rounded-2xl font-black tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white/10 hover:border-[var(--color-robo-accent)] transition-all uppercase text-xs"
              >
                <Camera size={20} /> Scan QR Access
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 pt-6 border-t border-white/5">
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--color-robo-accent-glow)] border border-[var(--color-robo-accent-dim)]">
                  <Wifi size={14} className="text-[var(--color-robo-accent)]" />
                </div>
                <span className="text-[8px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Local Link</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--color-robo-accent-glow)] border border-[var(--color-robo-accent-dim)]">
                  <ShieldCheck size={14} className="text-[var(--color-robo-accent)]" />
                </div>
                <span className="text-[8px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Secure</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="p-2 rounded-lg bg-[var(--color-robo-accent-glow)] border border-[var(--color-robo-accent-dim)]">
                  <Activity size={14} className="text-[var(--color-robo-accent)]" />
                </div>
                <span className="text-[8px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Low Latency</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-12 text-[9px] text-[var(--color-robo-text-muted)] font-black uppercase tracking-[0.4em] opacity-40 animate-pulse">
        Waiting for Local Mesh Authentication...
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
