'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';

interface MobileJoystickProps {
  size?: number;
  onMove: (x: number, y: number) => void; // Normalized -1 to 1
  onRelease?: () => void;
  label?: string;
}

/**
 * Canvas-based virtual joystick optimized for mobile touch.
 * Renders at 60fps, provides deadzone filtering, and triggers haptic feedback.
 */
export default function MobileJoystick({ size = 180, onMove, onRelease, label = 'CONTROL' }: MobileJoystickProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDragging = useRef(false);
  const posRef = useRef({ x: 0, y: 0 });
  const animFrame = useRef<number>(0);
  const [active, setActive] = useState(false);

  const DEADZONE = 0.08;
  const maxR = size / 2 - 30;
  const knobR = 24;

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = size;
    const h = size;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    const cx = w / 2;
    const cy = h / 2;
    const { x, y } = posRef.current;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, maxR + 10, 0, Math.PI * 2);
    ctx.strokeStyle = isDragging.current ? 'rgba(14, 215, 181, 0.4)' : 'rgba(51, 65, 85, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Crosshairs
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - maxR, cy);
    ctx.lineTo(cx + maxR, cy);
    ctx.moveTo(cx, cy - maxR);
    ctx.lineTo(cx, cy + maxR);
    ctx.stroke();

    // Direction labels
    ctx.font = '700 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = isDragging.current ? 'rgba(14, 215, 181, 0.6)' : 'rgba(71, 85, 105, 0.6)';
    ctx.fillText('FWD', cx, cy - maxR - 4);
    ctx.fillText('REV', cx, cy + maxR + 12);
    ctx.fillText('L', cx - maxR - 8, cy + 3);
    ctx.fillText('R', cx + maxR + 8, cy + 3);

    // Glow trail when active
    if (isDragging.current && (Math.abs(x) > 0.01 || Math.abs(y) > 0.01)) {
      const grd = ctx.createRadialGradient(cx + x * maxR, cy + y * maxR, 0, cx + x * maxR, cy + y * maxR, knobR + 20);
      grd.addColorStop(0, 'rgba(14, 215, 181, 0.25)');
      grd.addColorStop(1, 'rgba(14, 215, 181, 0)');
      ctx.beginPath();
      ctx.arc(cx + x * maxR, cy + y * maxR, knobR + 20, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Knob
    const knobX = cx + x * maxR;
    const knobY = cy + y * maxR;
    ctx.beginPath();
    ctx.arc(knobX, knobY, knobR, 0, Math.PI * 2);
    const knobGrd = ctx.createRadialGradient(knobX - 4, knobY - 4, 0, knobX, knobY, knobR);
    knobGrd.addColorStop(0, isDragging.current ? 'rgba(14, 215, 181, 0.5)' : 'rgba(51, 65, 85, 0.6)');
    knobGrd.addColorStop(1, isDragging.current ? 'rgba(14, 215, 181, 0.2)' : 'rgba(31, 41, 55, 0.6)');
    ctx.fillStyle = knobGrd;
    ctx.fill();
    ctx.strokeStyle = isDragging.current ? 'rgba(14, 215, 181, 0.8)' : 'rgba(94, 234, 212, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    animFrame.current = requestAnimationFrame(draw);
  }, [size, maxR]);

  useEffect(() => {
    animFrame.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrame.current);
  }, [draw]);

  const handleTouch = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = (clientX - cx) / maxR;
    let dy = (clientY - cy) / maxR;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 1) { dx /= dist; dy /= dist; }

    // Apply deadzone
    const nx = Math.abs(dx) < DEADZONE ? 0 : dx;
    const ny = Math.abs(dy) < DEADZONE ? 0 : dy;

    posRef.current = { x: nx, y: ny };
    onMove(nx, -ny); // Invert Y so up = positive
  }, [maxR, onMove]);

  const handleStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    isDragging.current = true;
    setActive(true);
    const pos = 'touches' in e ? e.touches[0] : e;
    handleTouch(pos.clientX, pos.clientY);
    if (navigator.vibrate) navigator.vibrate(10);
  }, [handleTouch]);

  const handleMove = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging.current) return;
    e.preventDefault();
    const pos = 'touches' in e ? e.touches[0] : e;
    handleTouch(pos.clientX, pos.clientY);
  }, [handleTouch]);

  const handleEnd = useCallback(() => {
    isDragging.current = false;
    setActive(false);
    posRef.current = { x: 0, y: 0 };
    onMove(0, 0);
    onRelease?.();
  }, [onMove, onRelease]);

  return (
    <div className="flex flex-col items-center gap-2">
      <span className={`text-[9px] font-black uppercase tracking-[0.2em] transition-colors ${active ? 'text-[var(--color-robo-accent)]' : 'text-[var(--color-robo-text-muted)]'}`}>
        {label}
      </span>
      <canvas
        ref={canvasRef}
        style={{ width: size, height: size, touchAction: 'none' }}
        onTouchStart={handleStart}
        onTouchMove={handleMove}
        onTouchEnd={handleEnd}
        onMouseDown={handleStart}
        onMouseMove={handleMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
      />
    </div>
  );
}
