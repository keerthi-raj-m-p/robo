'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const VirtualRobot = dynamic(() => import('./VirtualRobot'), { ssr: false });

const JOINTS = [
  { id: 0, name: 'J1 - Base', min: 0, max: 180 },
  { id: 1, name: 'J2 - Shoulder', min: 0, max: 180 },
  { id: 2, name: 'J3 - Elbow', min: 0, max: 180 },
  { id: 3, name: 'J4 - Wrist Pitch', min: 0, max: 180 },
  { id: 4, name: 'J5 - Wrist Yaw', min: 0, max: 180 },
  { id: 5, name: 'J6 - Gripper', min: 0, max: 90 },
];

const SPEED_OPTIONS = [25, 50, 75, 100];

interface ControlTabProps {
  onSend: (data: Record<string, unknown>) => void;
}

export default function ControlTab({ onSend }: ControlTabProps) {
  const { 
    jointAngles, targetAngles, setSingleJoint, setTargetAngles, 
    speed, setSpeed, controlMode, setControlMode, isRemote 
  } = useRobotStore();
  
  const lastSendRef = useRef(0);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const repeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const sendAngles = useCallback((angles: number[]) => {
    const now = Date.now();
    if (now - lastSendRef.current >= 50) {
      lastSendRef.current = now;
      onSend({ type: 'move', angles, speed });
    }
  }, [onSend, speed]);

  const handleJointChange = useCallback((index: number, value: number) => {
    setSingleJoint(index, value);
    const newAngles = [...targetAngles];
    newAngles[index] = value;
    sendAngles(newAngles);
  }, [setSingleJoint, targetAngles, sendAngles]);

  const handleSpeedChange = (s: number) => {
    setSpeed(s);
    onSend({ type: 'speed', value: s });
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'home':
        onSend({ type: 'home' });
        setTargetAngles([90, 45, 90, 0, 0, 90]);
        break;
      case 'zero':
        onSend({ type: 'zero' });
        setTargetAngles([90, 90, 90, 90, 90, 90]);
        break;
      case 'open':
        onSend({ type: 'gripper', state: 'open' });
        setSingleJoint(5, 90);
        break;
      case 'close':
        onSend({ type: 'gripper', state: 'close' });
        setSingleJoint(5, 0);
        break;
    }
  };

  const handleJog = useCallback((servo: number, diff: number) => {
    onSend({ type: 'jog', servo, diff });
    const current = useRobotStore.getState().targetAngles[servo];
    const limits = JOINTS[servo] || { min: 0, max: 180 };
    setSingleJoint(servo, Math.max(limits.min, Math.min(limits.max, current + diff)));
  }, [onSend, setSingleJoint]);

  const startJogRepeat = (servo: number, diff: number) => {
    handleJog(servo, diff);
    if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    repeatIntervalRef.current = setInterval(() => {
      handleJog(servo, diff);
    }, 100);
  };

  const stopJogRepeat = () => {
    if (repeatIntervalRef.current) {
      clearInterval(repeatIntervalRef.current);
      repeatIntervalRef.current = null;
    }
  };

  const handleJoystickMove = useCallback((clientX: number, clientY: number) => {
    if (!joystickRef.current || !isDragging.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxR = rect.width / 2 - 25;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > maxR) { dx = (dx / dist) * maxR; dy = (dy / dist) * maxR; }
    setJoystickPos({ x: dx, y: dy });
  }, []);

  useEffect(() => {
    if (controlMode !== 'joystick' || (joystickPos.x === 0 && joystickPos.y === 0)) return;

    const interval = setInterval(() => {
      const sensitivity = 0.1;
      const xDiff = joystickPos.x * sensitivity;
      const yDiff = -joystickPos.y * sensitivity;

      if (Math.abs(xDiff) > 0.5) {
        onSend({ type: 'jog', servo: 0, diff: xDiff });
        const current = useRobotStore.getState().targetAngles[0];
        setSingleJoint(0, Math.max(-180, Math.min(180, current + xDiff)));
      }

      if (Math.abs(yDiff) > 0.5) {
        onSend({ type: 'jog', servo: 1, diff: yDiff });
        const current = useRobotStore.getState().targetAngles[1];
        setSingleJoint(1, Math.max(-90, Math.min(90, current + yDiff)));
      }
    }, 100);

    return () => clearInterval(interval);
  }, [joystickPos, controlMode, onSend, setSingleJoint]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => handleJoystickMove(e.clientX, e.clientY);
    const onTouchMove = (e: TouchEvent) => { if (e.touches[0]) handleJoystickMove(e.touches[0].clientX, e.touches[0].clientY); };
    const onUp = () => { isDragging.current = false; setJoystickPos({ x: 0, y: 0 }); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onTouchMove);
    window.addEventListener('touchend', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onUp);
      if (repeatIntervalRef.current) clearInterval(repeatIntervalRef.current);
    };
  }, [handleJoystickMove]);

  return (
    <div className={`grid ${isRemote ? 'grid-cols-1 overflow-y-auto' : 'grid-cols-[280px_1fr_300px]'} gap-4 h-full p-4 animate-fadeIn`}>
      {/* Joystick & Base Controls (Always visible, first on mobile) */}
      <div className={`flex flex-col gap-4 ${isRemote ? 'order-2' : 'order-1'}`}>
        <div className="robo-card flex-1 min-h-[300px] flex flex-col">
          <div className="robo-card-title">BASE CONTROL <span className="text-base cursor-help">ⓘ</span></div>
          <div className="flex-1 flex items-center justify-center">
            <div className="joystick-container" ref={joystickRef}>
              <button className="joystick-label top-2 left-1/2 -translate-x-1/2" onMouseDown={() => startJogRepeat(1, 2)} onMouseUp={stopJogRepeat} onMouseLeave={stopJogRepeat} onTouchStart={() => startJogRepeat(1, 2)} onTouchEnd={stopJogRepeat}>FWD</button>
              <button className="joystick-label bottom-2 left-1/2 -translate-x-1/2" onMouseDown={() => startJogRepeat(1, -2)} onMouseUp={stopJogRepeat} onMouseLeave={stopJogRepeat} onTouchStart={() => startJogRepeat(1, -2)} onTouchEnd={stopJogRepeat}>REV</button>
              <button className="joystick-label left-2 top-1/2 -translate-y-1/2" onMouseDown={() => startJogRepeat(0, -2)} onMouseUp={stopJogRepeat} onMouseLeave={stopJogRepeat} onTouchStart={() => startJogRepeat(0, -2)} onTouchEnd={stopJogRepeat}>LEFT</button>
              <button className="joystick-label right-2 top-1/2 -translate-y-1/2" onMouseDown={() => startJogRepeat(0, 2)} onMouseUp={stopJogRepeat} onMouseLeave={stopJogRepeat} onTouchStart={() => startJogRepeat(0, 2)} onTouchEnd={stopJogRepeat}>RIGHT</button>
              <div className="absolute w-full h-[1px] bg-[var(--color-robo-border)] top-1/2 opacity-20"></div>
              <div className="absolute h-full w-[1px] bg-[var(--color-robo-border)] left-1/2 opacity-20"></div>
              <motion.div className="joystick-knob shadow-[0_0_20px_var(--color-robo-accent-glow)]" style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }} onMouseDown={() => { isDragging.current = true; }} onTouchStart={() => { isDragging.current = true; }} />
            </div>
          </div>
        </div>

        <div className="robo-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Speed</span>
            <span className="text-xs font-bold text-[var(--color-robo-accent)] mono">{speed}%</span>
          </div>
          <input type="range" className="robo-slider mb-3" min={0} max={100} value={speed} onChange={(e) => handleSpeedChange(Number(e.target.value))} />
        </div>
      </div>

      {/* 3D Visualization (Center on laptop, top on mobile) */}
      <div className={`flex flex-col gap-4 min-w-0 ${isRemote ? 'order-1 h-[40vh]' : 'order-2'}`}>
        <div className="robo-card flex-1 flex flex-col border-[var(--color-robo-accent-dim)] shadow-[0_0_20px_var(--color-robo-accent-glow)] overflow-hidden">
          <div className="flex-1 relative bg-black/40 rounded-t-lg overflow-hidden">
            <VirtualRobot />
          </div>
          {!isRemote && (
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-[var(--color-robo-border)] bg-black/20 rounded-b-lg p-3">
              <div className="relative">
                <div className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest mb-1 opacity-50 italic">Position Vector</div>
                <div className="text-[11px] text-[var(--color-robo-accent)] mono">X: {(20 + jointAngles[0]/10).toFixed(1)} cm</div>
                <div className="text-[11px] text-[var(--color-robo-accent)] mono">Y: {(10 + jointAngles[1]/15).toFixed(1)} cm</div>
              </div>
              <div className="relative">
                <div className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest mb-1 opacity-50 italic">Attitude Data</div>
                <div className="text-[11px] text-[var(--color-robo-purple)] mono">P: {Math.round(jointAngles[4] - 90)}°</div>
                <div className="text-[11px] text-[var(--color-robo-purple)] mono">Y: {Math.round(jointAngles[5] - 45)}°</div>
              </div>
              <div className="relative">
                <div className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest mb-1 opacity-50 italic">Status</div>
                <div className="flex items-center gap-1">
                  <span className="status-dot status-dot-green"></span>
                  <span className="text-[10px] text-[var(--color-robo-accent)] font-bold">READY</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Joint Sliders & Quick Actions (Last on mobile) */}
      <div className={`flex flex-col gap-4 ${isRemote ? 'order-3' : 'order-3'}`}>
        <div className="robo-card">
          <div className="robo-card-title">JOINT PARAMETERS</div>
          <div className="flex flex-col gap-3">
            {JOINTS.map((joint) => (
              <div key={joint.id}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] font-bold text-[var(--color-robo-text-muted)] uppercase tracking-tighter">{joint.name}</span>
                  <span className="text-[10px] font-black text-[var(--color-robo-accent)] mono">{Math.round(jointAngles[joint.id])}°</span>
                </div>
                <input type="range" className="robo-slider" min={joint.min} max={joint.max} value={jointAngles[joint.id]} onChange={(e) => handleJointChange(joint.id, Number(e.target.value))} />
              </div>
            ))}
          </div>
        </div>

        <div className="robo-card">
          <div className="robo-card-title">PRESETS</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="robo-btn robo-btn-secondary py-2 text-[10px] font-bold" onClick={() => handleQuickAction('home')}>🏠 HOME</button>
            <button className="robo-btn robo-btn-secondary py-2 text-[10px] font-bold" onClick={() => handleQuickAction('zero')}>🎯 ZERO</button>
            <button className="robo-btn robo-btn-secondary py-2 text-[10px] font-bold" onClick={() => handleQuickAction('open')}>✋ OPEN</button>
            <button className="robo-btn robo-btn-secondary py-2 text-[10px] font-bold" onClick={() => handleQuickAction('close')}>✊ CLOSE</button>
          </div>
          <button className="w-full mt-2 py-3 bg-[var(--color-robo-red)]/20 border border-[var(--color-robo-red)]/50 rounded-lg text-[var(--color-robo-red)] text-[10px] font-black tracking-[0.2em] hover:bg-[var(--color-robo-red)] hover:text-white transition-all uppercase" onClick={() => onSend({ type: 'stop' })}>Emergency Stop</button>
        </div>
      </div>
    </div>
  );
}
