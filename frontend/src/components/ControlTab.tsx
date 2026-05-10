'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';

const VirtualRobot = dynamic(() => import('./VirtualRobot'), { ssr: false });

const JOINTS = [
  { id: 0, name: 'J1 - Base', min: -180, max: 180 },
  { id: 1, name: 'J2 - Shoulder', min: -90, max: 90 },
  { id: 2, name: 'J3 - Elbow', min: 0, max: 180 },
  { id: 3, name: 'J4 - Wrist Pitch', min: -90, max: 90 },
  { id: 4, name: 'J5 - Wrist Yaw', min: -90, max: 90 },
  { id: 5, name: 'J6 - Gripper', min: 0, max: 90 },
];

const SPEED_OPTIONS = [25, 50, 75, 100];

interface ControlTabProps {
  onSend: (data: Record<string, unknown>) => void;
}

export default function ControlTab({ onSend }: ControlTabProps) {
  const { jointAngles, targetAngles, setSingleJoint, speed, setSpeed, controlMode, setControlMode } = useRobotStore();
  const lastSendRef = useRef(0);
  const [joystickPos, setJoystickPos] = useState({ x: 0, y: 0 });
  const joystickRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

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
      case 'home': onSend({ type: 'home' }); break;
      case 'zero': onSend({ type: 'zero' }); break;
      case 'open': onSend({ type: 'gripper', state: 'open' }); break;
      case 'close': onSend({ type: 'gripper', state: 'close' }); break;
    }
  };

  // Joystick handlers
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

  // Joystick continuous movement logic
  useEffect(() => {
    if (controlMode !== 'joystick' || (joystickPos.x === 0 && joystickPos.y === 0)) return;

    const interval = setInterval(() => {
      // Map joystick X to Base (Servo 0) and Y to Shoulder (Servo 1)
      const sensitivity = 0.1; // Adjust based on feel
      const xDiff = joystickPos.x * sensitivity;
      const yDiff = -joystickPos.y * sensitivity; // Invert Y

      if (Math.abs(xDiff) > 0.5) {
        onSend({ type: 'jog', servo: 0, diff: xDiff });
        // Update local target for simulation
        const current = useRobotStore.getState().targetAngles[0];
        setSingleJoint(0, Math.max(-180, Math.min(180, current + xDiff)));
      }

      if (Math.abs(yDiff) > 0.5) {
        onSend({ type: 'jog', servo: 1, diff: yDiff });
        // Update local target for simulation
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
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onUp); };
  }, [handleJoystickMove]);

  return (
    <div className="grid grid-cols-[280px_1fr_300px] gap-4 h-full p-4 animate-fadeIn">
      {/* Left Panel - Joystick & Speed */}
      <div className="flex flex-col gap-4">
        {/* Base Control */}
        <div className="robo-card flex-1">
          <div className="robo-card-title">BASE CONTROL <span className="text-base cursor-help">ⓘ</span></div>
          <div className="flex justify-center">
            <div className="joystick-container" ref={joystickRef}>
              <span className="joystick-label top-2 left-1/2 -translate-x-1/2">FWD</span>
              <span className="joystick-label bottom-2 left-1/2 -translate-x-1/2">REV</span>
              <span className="joystick-label left-2 top-1/2 -translate-y-1/2">LEFT</span>
              <span className="joystick-label right-2 top-1/2 -translate-y-1/2">RIGHT</span>
              {/* Crosshairs */}
              <div className="absolute w-full h-[1px] bg-[var(--color-robo-border)] top-1/2"></div>
              <div className="absolute h-full w-[1px] bg-[var(--color-robo-border)] left-1/2"></div>
              {/* Direction arrows */}
              <div className="absolute top-5 left-1/2 -translate-x-1/2 text-[var(--color-robo-text-muted)] text-lg">↑</div>
              <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-[var(--color-robo-text-muted)] text-lg">↓</div>
              <div className="absolute left-5 top-1/2 -translate-y-1/2 text-[var(--color-robo-text-muted)] text-lg">←</div>
              <div className="absolute right-5 top-1/2 -translate-y-1/2 text-[var(--color-robo-text-muted)] text-lg">→</div>
              <motion.div
                className="joystick-knob"
                style={{ transform: `translate(${joystickPos.x}px, ${joystickPos.y}px)` }}
                onMouseDown={() => { isDragging.current = true; }}
                onTouchStart={() => { isDragging.current = true; }}
              />
            </div>
          </div>
        </div>

        {/* Speed */}
        <div className="robo-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--color-robo-text-dim)] uppercase tracking-wider">Speed</span>
            <span className="text-sm font-bold text-[var(--color-robo-text)] mono">{speed}%</span>
          </div>
          <input type="range" className="robo-slider mb-3" min={0} max={100} value={speed} onChange={(e) => handleSpeedChange(Number(e.target.value))} />
          <div className="flex gap-2">
            {SPEED_OPTIONS.map((s) => (
              <button key={s} className={`speed-btn flex-1 ${speed === s ? 'active' : ''}`} onClick={() => handleSpeedChange(s)}>{s}%</button>
            ))}
          </div>
        </div>

        {/* Control Mode */}
        <div className="robo-card">
          <div className="robo-card-title">CONTROL MODE <span className="text-base cursor-help">ⓘ</span></div>
          <div className="flex gap-2">
            <button className={`robo-btn flex-1 ${controlMode === 'joystick' ? 'robo-btn-primary' : 'robo-btn-secondary'}`} onClick={() => setControlMode('joystick')}>🎮 JOYSTICK</button>
            <button className={`robo-btn flex-1 ${controlMode === 'joint' ? 'robo-btn-primary' : 'robo-btn-secondary'}`} onClick={() => setControlMode('joint')}>🦾 JOINT</button>
          </div>
        </div>
      </div>

      {/* Center - 3D Visualization */}
      <div className="robo-card flex flex-col">
        <div className="flex-1 relative w-full h-full min-h-[300px]">
          <VirtualRobot />
        </div>
        {/* Bottom info bar */}
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--color-robo-border)]">
          <div>
            <div className="text-[10px] font-semibold text-[var(--color-robo-text-muted)] uppercase tracking-wider mb-1">Position</div>
            <div className="text-xs text-[var(--color-robo-text-dim)] mono">X: 21.4 cm</div>
            <div className="text-xs text-[var(--color-robo-text-dim)] mono">Y: 10.8 cm</div>
            <div className="text-xs text-[var(--color-robo-text-dim)] mono">Z: 18.7 cm</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[var(--color-robo-text-muted)] uppercase tracking-wider mb-1">Orientation</div>
            <div className="text-xs text-[var(--color-robo-text-dim)] mono">Roll: 8°</div>
            <div className="text-xs text-[var(--color-robo-text-dim)] mono">Pitch: 26°</div>
            <div className="text-xs text-[var(--color-robo-text-dim)] mono">Yaw: -35°</div>
          </div>
          <div>
            <div className="text-[10px] font-semibold text-[var(--color-robo-text-muted)] uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-1.5 mb-0.5"><span className="status-dot status-dot-green"></span><span className="text-xs text-[var(--color-robo-green)]">Ready</span></div>
            <div className="text-xs text-[var(--color-robo-text-dim)]">No Errors</div>
          </div>
        </div>
      </div>

      {/* Right Panel - Joint Sliders & Quick Actions */}
      <div className="flex flex-col gap-4">
        {/* Joint Control */}
        <div className="robo-card flex-1">
          <div className="robo-card-title">JOINT CONTROL <span className="text-base cursor-help">ⓘ</span></div>
          <div className="flex flex-col gap-4">
            {JOINTS.map((joint) => (
              <div key={joint.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--color-robo-text-dim)]">{joint.name}</span>
                  <span className="text-xs font-bold text-[var(--color-robo-text)] mono">{Math.round(jointAngles[joint.id])}°</span>
                </div>
                <input
                  type="range"
                  className="robo-slider"
                  min={joint.min}
                  max={joint.max}
                  value={jointAngles[joint.id]}
                  onChange={(e) => handleJointChange(joint.id, Number(e.target.value))}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="robo-card">
          <div className="robo-card-title">QUICK ACTIONS</div>
          <div className="grid grid-cols-2 gap-2">
            <button className="robo-btn robo-btn-secondary" onClick={() => handleQuickAction('home')}>🏠 HOME</button>
            <button className="robo-btn robo-btn-secondary" onClick={() => handleQuickAction('zero')}>🎯 ZERO</button>
            <button className="robo-btn robo-btn-secondary" onClick={() => handleQuickAction('open')}>✋ OPEN GRIPPER</button>
            <button className="robo-btn robo-btn-secondary" onClick={() => handleQuickAction('close')}>✊ CLOSE GRIPPER</button>
          </div>
        </div>
      </div>
    </div>
  );
}
