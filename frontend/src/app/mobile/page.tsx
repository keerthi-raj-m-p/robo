'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { useRemoteSync } from '@/hooks/useRemoteSync';
import MobileJoystick from '@/components/MobileJoystick';
import {
  Wifi, WifiOff, Smartphone, Activity, Zap,
  ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Hand, Gauge, Shield, Maximize, Minimize, Radio
} from 'lucide-react';

function MobileControllerContent() {
  const {
    jointAngles, targetAngles, setSingleJoint, setTargetAngles,
    speed, setSpeed, roomId, hostName, isRemote, syncStatus, remoteLatency,
    emergencyStopActive, telemetry, connectionMode
  } = useRobotStore();

  const lastSendRef = useRef(0);
  const jogRepeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeSection, setActiveSection] = useState<'joystick' | 'servos'>('joystick');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dummy sendMessage for the host-side WS (mobile doesn't use native WS)
  const noopSend = useCallback(() => { }, []);
  const { sendRemoteCommand, sendEmergencyStop } = useRemoteSync(noopSend);

  // Fullscreen tracking
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Auto-prompt fullscreen on mobile
  useEffect(() => {
    const timer = setTimeout(() => {
      if (/Mobile|Android|iPhone/i.test(navigator.userAgent) && !document.fullscreenElement) {
        // Don't auto-fullscreen, let user choose
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const throttledSend = useCallback((command: any) => {
    const now = Date.now();
    if (now - lastSendRef.current >= 50) {
      lastSendRef.current = now;
      sendRemoteCommand(command);
    }
  }, [sendRemoteCommand]);

  const handleJoystickMove = useCallback((x: number, y: number) => {
    if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) return;
    const sensitivity = 2;
    const xDiff = x * sensitivity;
    const yDiff = y * sensitivity;

    if (Math.abs(xDiff) > 0.3) {
      throttledSend({ type: 'jog', servo: 0, diff: xDiff });
    }
    if (Math.abs(yDiff) > 0.3) {
      throttledSend({ type: 'jog', servo: 1, diff: yDiff });
    }
  }, [throttledSend]);

  const handleJog = useCallback((servo: number, diff: number) => {
    sendRemoteCommand({ type: 'jog', servo, diff });
    if (navigator.vibrate) navigator.vibrate(15);
  }, [sendRemoteCommand]);

  const startJogRepeat = useCallback((servo: number, diff: number) => {
    handleJog(servo, diff);
    if (jogRepeatRef.current) clearInterval(jogRepeatRef.current);
    jogRepeatRef.current = setInterval(() => handleJog(servo, diff), 100);
  }, [handleJog]);

  const stopJogRepeat = useCallback(() => {
    if (jogRepeatRef.current) {
      clearInterval(jogRepeatRef.current);
      jogRepeatRef.current = null;
    }
  }, []);

  const handleJointChange = useCallback((index: number, value: number) => {
    setSingleJoint(index, value);
    const newAngles = [...targetAngles];
    newAngles[index] = value;
    throttledSend({ type: 'move', angles: newAngles, speed });
  }, [setSingleJoint, targetAngles, throttledSend, speed]);

  const handleSpeedChange = useCallback((s: number) => {
    setSpeed(s);
    sendRemoteCommand({ type: 'speed', value: s });
  }, [setSpeed, sendRemoteCommand]);

  const handleQuickAction = useCallback((action: string) => {
    if (navigator.vibrate) navigator.vibrate(30);
    switch (action) {
      case 'home':
        sendRemoteCommand({ type: 'home' });
        setTargetAngles([90, 45, 90, 0, 0, 90]);
        break;
      case 'zero':
        sendRemoteCommand({ type: 'zero' });
        setTargetAngles([90, 90, 90, 90, 90, 90]);
        break;
      case 'open':
        sendRemoteCommand({ type: 'gripper', state: 'open' });
        setSingleJoint(5, 90);
        break;
      case 'close':
        sendRemoteCommand({ type: 'gripper', state: 'close' });
        setSingleJoint(5, 0);
        break;
      case 'stop':
        sendRemoteCommand({ type: 'stop' });
        break;
    }
  }, [sendRemoteCommand, setTargetAngles, setSingleJoint]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
  };

  const JOINTS = [
    { id: 0, name: 'Base', min: 0, max: 180 },
    { id: 1, name: 'Shoulder', min: 0, max: 180 },
    { id: 2, name: 'Elbow', min: 0, max: 180 },
    { id: 3, name: 'Wrist P', min: 0, max: 180 },
    { id: 4, name: 'Wrist Y', min: 0, max: 180 },
    { id: 5, name: 'Gripper', min: 0, max: 90 },
  ];

  const isConnected = syncStatus !== 'offline';

  return (
    <div className="mobile-controller">
      {/* ─── Status Bar ─────────────────────────────────── */}
      <div className="mobile-status-bar">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Wifi size={12} className="text-[var(--color-robo-accent)]" />
          ) : (
            <WifiOff size={12} className="text-[var(--color-robo-red)]" />
          )}
          <span className="text-[9px] font-black tracking-[0.15em] uppercase truncate max-w-[120px]">
            {isConnected ? `${hostName || 'LINKED'}: ${roomId}` : 'DISCONNECTED'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {remoteLatency > 0 && (
            <span className={`text-[9px] font-bold mono ${remoteLatency < 50 ? 'text-[var(--color-robo-accent)]' : remoteLatency < 150 ? 'text-[var(--color-robo-yellow)]' : 'text-[var(--color-robo-red)]'}`}>
              {remoteLatency}ms
            </span>
          )}
          <button onClick={toggleFullscreen} className="p-1 rounded opacity-60 hover:opacity-100">
            {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
          </button>
        </div>
      </div>

      {/* ─── Emergency Stop (always visible) ──────────── */}
      <button
        className={`mobile-estop ${emergencyStopActive ? 'mobile-estop-active' : ''}`}
        onClick={sendEmergencyStop}
      >
        <Shield size={20} />
        <span>EMERGENCY STOP</span>
      </button>

      {/* ─── Joint Parameters ─────────────────────────── */}
      <div className="mobile-servo-section animate-fadeIn">
        <div className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest mb-1 px-1">Joint Parameters</div>
        <div className="grid grid-cols-1 gap-1.5">
          {JOINTS.map((joint) => (
            <div key={joint.id} className="mobile-servo-row py-1.5 px-3">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-bold text-[var(--color-robo-text-muted)] uppercase">J{joint.id + 1}</span>
                <span className="text-[10px] font-black text-[var(--color-robo-accent)] mono">{Math.round(jointAngles[joint.id])}°</span>
              </div>
              <input
                type="range"
                className="mobile-slider h-5"
                min={joint.min}
                max={joint.max}
                value={jointAngles[joint.id]}
                onChange={(e) => handleJointChange(joint.id, Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ─── Joystick Section ─────────────────────────── */}
      <div className="mobile-joystick-section animate-fadeIn mt-2">
        <div className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest mb-1 px-1">Base Control</div>
        <div className="flex items-center justify-center gap-6 p-4 bg-black/20 rounded-2xl border border-[var(--color-robo-border)]">
          <MobileJoystick
            size={160}
            onMove={handleJoystickMove}
            label="BASE"
          />
        </div>
      </div>

      {/* ─── Presets Section ─────────────────────────── */}
      <div className="animate-fadeIn mt-2">
        <div className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest mb-1 px-1">Quick Presets</div>
        <div className="grid grid-cols-4 gap-2">
          <button className="mobile-action-btn" onClick={() => handleQuickAction('home')}>
            🏠 <span>HOME</span>
          </button>
          <button className="mobile-action-btn" onClick={() => handleQuickAction('zero')}>
            🎯 <span>ZERO</span>
          </button>
          <button className="mobile-action-btn" onClick={() => handleQuickAction('open')}>
            ✋ <span>OPEN</span>
          </button>
          <button className="mobile-action-btn" onClick={() => handleQuickAction('close')}>
            ✊ <span>CLOSE</span>
          </button>
        </div>
      </div>

      {/* ─── Speed Control ────────────────────────────── */}
      <div className="mobile-speed-section mt-2 pb-6">
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <Zap size={12} className="text-[var(--color-robo-accent)]" />
            <span className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Master Speed</span>
          </div>
          <span className="text-sm font-black text-[var(--color-robo-accent)] mono">{speed}%</span>
        </div>
        <input
          type="range"
          className="mobile-slider"
          min={0}
          max={100}
          value={speed}
          onChange={(e) => handleSpeedChange(Number(e.target.value))}
        />
      </div>

      {/* ─── Telemetry Bar ────────────────────────────── */}
      <div className="mobile-telemetry-bar">
        <div className="mobile-telemetry-item">
          <span className="mobile-telemetry-label">V</span>
          <span className="mobile-telemetry-value">{telemetry.voltage.toFixed(1)}V</span>
        </div>
        <div className="mobile-telemetry-item">
          <span className="mobile-telemetry-label">A</span>
          <span className="mobile-telemetry-value">{telemetry.current.toFixed(1)}A</span>
        </div>
        <div className="mobile-telemetry-item">
          <span className="mobile-telemetry-label">T</span>
          <span className="mobile-telemetry-value">{telemetry.temp.toFixed(0)}°C</span>
        </div>
        <div className="mobile-telemetry-item">
          <span className="mobile-telemetry-label">CPU</span>
          <span className="mobile-telemetry-value">{telemetry.cpu}%</span>
        </div>
      </div>
    </div>
  );
}

export default function MobilePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[var(--color-robo-bg)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-[var(--color-robo-border)] border-t-[var(--color-robo-accent)] animate-spin"></div>
          <span className="text-[10px] font-black tracking-widest text-[var(--color-robo-accent)] animate-pulse uppercase">Initializing Remote Link...</span>
        </div>
      </div>
    }>
      <MobileControllerContent />
    </Suspense>
  );
}
