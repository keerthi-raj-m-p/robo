'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import dynamic from 'next/dynamic';
import { useRobotStore } from '@/store/useRobotStore';

const VirtualRobot = dynamic(() => import('./VirtualRobot'), { ssr: false });

interface GestureTabProps {
  onSend: (data: Record<string, unknown>) => void;
}

const GESTURES = [
  { icon: '👆👇', title: 'Move Up / Down', desc: 'Move hand up or down' },
  { icon: '👈👉', title: 'Rotate Left / Right', desc: 'Move hand left or right' },
  { icon: '🤚↔️', title: 'Move Forward / Back', desc: 'Move hand forward or back' },
  { icon: '🤏', title: 'Open / Close Gripper', desc: 'Pinch to close, open to open' },
  { icon: '✊', title: 'Stop / Pause', desc: 'Make a fist to stop movement' },
];

// Add Window interface to make TypeScript happy
declare global {
  interface Window {
    Hands: any;
    Camera: any;
  }
}

export default function GestureTab({ onSend }: GestureTabProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLive, setIsLive] = useState(false);
  const [handStatus, setHandStatus] = useState('Initializing...');
  const [currentGesture, setCurrentGesture] = useState('Neutral');
  const [confidence, setConfidence] = useState(0);
  const [scriptsLoaded, setScriptsLoaded] = useState(0);
  const lastSendTime = useRef(0);

  const throttledSend = (data: Record<string, unknown>) => {
    const now = Date.now();
    if (now - lastSendTime.current > 200) { // 200ms throttle
      // Optimistically update local target angles for simulation
      const store = useRobotStore.getState();
      if (data.type === 'jog') {
        const servo = data.servo as number;
        const diff = data.diff as number;
        // Basic clamp to avoid crazy spin in simulation
        const currentTarget = store.targetAngles[servo];
        let newTarget = currentTarget + diff;
        newTarget = Math.max(-180, Math.min(180, newTarget));
        store.setSingleJoint(servo, newTarget);
      } else if (data.type === 'gripper') {
        store.setSingleJoint(5, data.state === 'open' ? 90 : 0);
      } else if (data.type === 'home' || data.type === 'zero') {
        const angles = data.type === 'home' ? [90, 45, 90, 0, 0, 90] : [90, 90, 90, 90, 90, 90];
        store.setTargetAngles(angles);
      }
      onSend(data);
      lastSendTime.current = now;
    }
  };

  useEffect(() => {
    // Wait until both scripts are loaded
    if (scriptsLoaded < 2) return;
    if (!window.Hands || !window.Camera) return;

    const videoElement = videoRef.current;
    const canvasElement = canvasRef.current;
    if (!videoElement || !canvasElement) return;

    const ctx = canvasElement.getContext('2d');

    const hands = new window.Hands({
      locateFile: (file: string) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      }
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.7
    });

    hands.onResults((results: any) => {
      if (!ctx) return;
      ctx.save();
      ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
      ctx.drawImage(results.image, 0, 0, canvasElement.width, canvasElement.height);

      if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
        setHandStatus('Hand Detected');
        setConfidence(results.multiHandedness[0].score);

        const landmarks = results.multiHandLandmarks[0];

        // Draw connections (simple version)
        const connections = [
          [0,1],[1,2],[2,3],[3,4], // Thumb
          [0,5],[5,6],[6,7],[7,8], // Index
          [5,9],[9,10],[10,11],[11,12], // Middle
          [9,13],[13,14],[14,15],[15,16], // Ring
          [13,17],[17,18],[18,19],[19,20], // Pinky
          [0,17] // Palm base
        ];

        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        for (const [startIdx, endIdx] of connections) {
          const start = landmarks[startIdx];
          const end = landmarks[endIdx];
          ctx.beginPath();
          ctx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
          ctx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
          ctx.stroke();
        }

        // Draw landmarks
        for (const landmark of landmarks) {
          ctx.beginPath();
          ctx.arc(landmark.x * canvasElement.width, landmark.y * canvasElement.height, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ff00';
          ctx.fill();
        }

        // --- Advanced Synchronization Mapping ---
        const wrist = landmarks[0];
        const indexBase = landmarks[5];
        const middleBase = landmarks[9];
        const pinkyBase = landmarks[17];
        const indexTip = landmarks[8];
        const thumbTip = landmarks[4];

        // 1. Base (S0) - Map wrist X to [0, 180] degrees (reversed for mirror)
        const baseAngle = Math.round((1 - wrist.x) * 180);
        
        // 2. Shoulder (S1) - Map wrist Y to [0, 180] degrees (inverted)
        const shoulderAngle = Math.round((1 - wrist.y) * 180);
        
        // 3. Elbow (S2) - Map wrist Z (depth) to [0, 180] degrees
        // wrist.z is usually around -0.1 to -0.5
        const elbowAngle = Math.round(Math.abs(wrist.z) * 400 + 45); 

        // 4. Wrist Roll (S3) - Angle between Index and Pinky bases
        const rollRad = Math.atan2(pinkyBase.y - indexBase.y, pinkyBase.x - indexBase.x);
        const rollAngle = Math.round(rollRad * (180 / Math.PI) + 90);

        // 5. Wrist Pitch (S4) - Angle between Wrist and Middle base
        const pitchRad = Math.atan2(middleBase.y - wrist.y, middleBase.x - wrist.x);
        const pitchAngle = Math.round(pitchRad * (180 / Math.PI) + 90);

        // 6. Gripper (S5) - Pinch distance
        const pinchDist = Math.hypot(thumbTip.x - indexTip.x, thumbTip.y - indexTip.y);
        const gripperAngle = pinchDist < 0.05 ? 0 : 90;

        // Synchronize all joints
        const newAngles = [
          Math.max(0, Math.min(180, baseAngle)),
          Math.max(0, Math.min(180, shoulderAngle)),
          Math.max(0, Math.min(180, elbowAngle)),
          Math.max(0, Math.min(180, rollAngle)),
          Math.max(0, Math.min(180, pitchAngle)),
          gripperAngle
        ];

        // Update local HUD
        if (Math.abs(wrist.x - 0.5) > 0.1 || Math.abs(wrist.y - 0.5) > 0.1) {
          setCurrentGesture(`Tracking: ${newAngles.join(', ')}`);
        } else {
          setCurrentGesture('Neutral');
        }

        // Send move command with all synchronized angles
        throttledSend({ type: 'move', angles: newAngles });
        
        // Optimistically update simulation
        const store = useRobotStore.getState();
        store.setTargetAngles(newAngles);

      } else {
        setHandStatus('No Hand Detected');
        setCurrentGesture('Neutral');
        setConfidence(0);
      }
      ctx.restore();
    });

    const camera = new window.Camera(videoElement, {
      onFrame: async () => {
        setIsLive(true);
        await hands.send({ image: videoElement });
      },
      width: 640,
      height: 480
    });

    camera.start().catch((e: any) => {
        console.error("Camera failed to start:", e);
        setHandStatus("Camera Error");
    });

    return () => {
      camera.stop();
      hands.close();
    };
  }, [scriptsLoaded]); // re-run effect when scripts load

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'home': onSend({ type: 'home' }); break;
      case 'zero': onSend({ type: 'zero' }); break;
      case 'open': onSend({ type: 'gripper', state: 'open' }); break;
      case 'close': onSend({ type: 'gripper', state: 'close' }); break;
    }
  };

  return (
    <div className="grid grid-cols-[280px_1fr_300px] gap-4 h-full p-4 animate-fadeIn">
      {/* Dynamic Scripts for MediaPipe to bypass Webpack bundling issues */}
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" strategy="lazyOnload" onLoad={() => setScriptsLoaded(s => s + 1)} />
      <Script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js" strategy="lazyOnload" onLoad={() => setScriptsLoaded(s => s + 1)} />

      {/* Left Panel - Camera Feed & Hand Status */}
      <div className="flex flex-col gap-4">
        <div className="robo-card flex-1">
          <div className="robo-card-title">CAMERA FEED <span className="text-base cursor-help">ⓘ</span></div>
          <div className="aspect-[4/3] bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded-lg flex items-center justify-center relative overflow-hidden">
            <video ref={videoRef} className="hidden" playsInline></video>
            <canvas ref={canvasRef} width="640" height="480" className="w-full h-full object-cover transform scale-x-[-1]"></canvas>
            
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-0.5">
              <span className={`status-dot ${isLive ? 'status-dot-green' : 'status-dot-red'}`}></span>
              <span className={`text-[10px] font-semibold ${isLive ? 'text-[var(--color-robo-green)]' : 'text-red-500'}`}>
                {isLive ? 'Live' : 'Offline'}
              </span>
            </div>
            
            {!isLive && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <div className="text-5xl mb-2">🤚</div>
                <div className="text-xs text-[var(--color-robo-text-muted)]">{scriptsLoaded < 2 ? 'Loading Model...' : handStatus}</div>
                <div className="text-[10px] text-[var(--color-robo-text-muted)] mt-1">Enable camera access</div>
              </div>
            )}
          </div>
        </div>

        <div className="robo-card">
          <div className="robo-card-title">HAND STATUS</div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-2xl">🤚</span>
            <div>
              <div className={`text-sm font-semibold ${confidence > 0 ? 'text-[var(--color-robo-green)]' : 'text-[var(--color-robo-text-muted)]'}`}>
                {handStatus}
              </div>
              <div className="text-xs text-[var(--color-robo-text-muted)]">
                Confidence: {Math.round(confidence * 100)}%
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-[var(--color-robo-border)] rounded-full overflow-hidden">
            <div className="h-full bg-[var(--color-robo-green)] rounded-full transition-all duration-300" style={{ width: `${Math.round(confidence * 100)}%` }}></div>
          </div>
        </div>

        <div className="robo-card">
          <div className="robo-card-title">CONTROL MODE</div>
          <div className="flex gap-2">
            <button className="robo-btn robo-btn-primary flex-1">🤚 GESTURE</button>
            <button className="robo-btn robo-btn-secondary flex-1">🎛️ MANUAL</button>
          </div>
        </div>
      </div>

      {/* Center - 3D Visualization */}
      <div className="robo-card flex flex-col relative group">
        <div className="flex-1 relative w-full h-full min-h-[300px]">
          <VirtualRobot />
          
          {/* Gesture HUD Overlay */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none z-10">
            <div className={`px-4 py-2 rounded-full border border-[var(--color-robo-green)] bg-black/60 backdrop-blur-md transition-all ${currentGesture !== 'Neutral' ? 'scale-110 opacity-100 shadow-[0_0_20px_rgba(0,255,136,0.2)]' : 'scale-100 opacity-60'}`}>
               <span className="text-xs font-bold text-[var(--color-robo-green)] uppercase tracking-[0.2em]">
                 {currentGesture}
               </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[var(--color-robo-border)]">
          <div>
            <div className="text-[10px] font-semibold text-[var(--color-robo-text-muted)] uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-1.5 mb-0.5">
               <span className={`status-dot ${isLive ? 'status-dot-green' : 'status-dot-red'}`}></span>
               <span className={`text-xs ${isLive ? 'text-[var(--color-robo-green)]' : 'text-red-500'}`}>
                 {isLive ? 'Tracking Active' : 'Waiting...'}
               </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Gesture Guide & Quick Actions */}
      <div className="flex flex-col gap-4">
        <div className="robo-card flex-1">
          <div className="robo-card-title">GESTURE GUIDE <span className="text-base cursor-help">ⓘ</span></div>
          <div className="flex flex-col gap-3">
            {GESTURES.map((g, i) => (
              <div key={i} className="flex items-start gap-3 p-2 rounded-lg hover:bg-[var(--color-robo-card-hover)] transition-colors">
                <span className="text-lg">{g.icon}</span>
                <div>
                  <div className="text-xs font-semibold text-[var(--color-robo-text)]">{g.title}</div>
                  <div className="text-[11px] text-[var(--color-robo-text-muted)]">{g.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

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
