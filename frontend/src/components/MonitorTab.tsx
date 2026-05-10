'use client';

import React from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const JOINT_NAMES = ['J1 - Base', 'J2 - Shoulder', 'J3 - Elbow', 'J4 - Wrist Pitch', 'J5 - Wrist Yaw', 'J6 - Gripper'];
const CHART_COLORS = ['#22c55e', '#3b82f6', '#a855f7', '#f97316', '#eab308', '#ef4444'];

const HEALTH_ITEMS = [
  { name: 'ESP32 Controller', icon: '🔧' },
  { name: 'PCA9685 Driver', icon: '⚙️' },
  { name: 'Serial Connection', icon: '🔌' },
  { name: 'WiFi Connection', icon: '📶' },
  { name: 'Servos', icon: '🦾' },
  { name: 'Battery', icon: '🔋' },
];

const EVENTS = [
  { time: '09:44:01', text: 'Mode changed to: Manual', color: 'green' },
  { time: '09:43:58', text: 'Home position executed', color: 'green' },
  { time: '09:43:45', text: 'Gripper opened', color: 'yellow' },
  { time: '09:43:30', text: 'Gesture control started', color: 'blue' },
];

export default function MonitorTab() {
  const { jointAngles, telemetry, angleHistory, stats, connectionMode } = useRobotStore();

  const formatUptime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="grid grid-cols-[220px_1fr_1fr_280px] gap-4 h-full p-4 animate-fadeIn">
      {/* Column 1 - Live View + Command Log */}
      <div className="flex flex-col gap-4">
        {/* Live View */}
        <div className="robo-card">
          <div className="robo-card-title">LIVE VIEW <span className="text-base cursor-help">ⓘ</span></div>
          <div className="aspect-square bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded-lg flex items-center justify-center relative">
            <div className="absolute top-2 left-2 flex items-center gap-1.5 bg-black/60 rounded px-2 py-0.5">
              <span className="status-dot status-dot-green"></span>
              <span className="text-[10px] font-semibold text-[var(--color-robo-green)]">Live</span>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-2">🦾</div>
              <div className="text-xs text-[var(--color-robo-text-muted)]">3D View</div>
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button className="robo-btn robo-btn-ghost text-xs flex-1">🔄</button>
            <button className="robo-btn robo-btn-ghost text-xs flex-1">📷</button>
            <button className="robo-btn robo-btn-ghost text-xs flex-1">⛶</button>
          </div>
        </div>

        {/* Command Log */}
        <div className="robo-card flex-1 flex flex-col min-h-0">
          <div className="robo-card-title">
            COMMAND LOG
            <span className="text-xs text-[var(--color-robo-text-muted)] cursor-pointer">Clear</span>
          </div>
          <div className="overflow-y-auto flex-1 space-y-1">
            {[
              { time: '09:44:21', src: 'Manual (Web)', cmd: `S: ${jointAngles.map(a => Math.round(a)).join(',')}` },
              { time: '09:44:18', src: 'Manual (Web)', cmd: 'S: -28,29,40,-12,54,20' },
              { time: '09:44:15', src: 'Gesture AI', cmd: 'S: -30,28,42,-12,55,20' },
              { time: '09:44:12', src: 'Manual (Web)', cmd: 'S: -32,27,41,-13,54,20' },
              { time: '09:44:09', src: 'Gesture AI', cmd: 'S: -30,29,40,-12,53,20' },
            ].map((log, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] py-1 border-b border-[var(--color-robo-border)]">
                <span className="text-[var(--color-robo-text-muted)] mono w-14">{log.time}</span>
                <span className="text-[var(--color-robo-text-dim)] w-20 truncate">{log.src}</span>
                <span className="text-[var(--color-robo-text)] mono flex-1 truncate">{log.cmd}</span>
                <span className="text-[var(--color-robo-green)]">● OK</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 2 - Joint Angles + Telemetry + Performance */}
      <div className="flex flex-col gap-4">
        {/* Joint Angles Live */}
        <div className="robo-card">
          <div className="robo-card-title">JOINT ANGLES (LIVE) <span className="text-base cursor-help">ⓘ</span></div>
          <div className="space-y-3">
            {JOINT_NAMES.map((name, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-[var(--color-robo-text)]">{name}</span>
                  <span className="text-xs font-bold text-[var(--color-robo-text)] mono">{Math.round(jointAngles[i])}°</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-[var(--color-robo-text-muted)] mono w-8">-180°</span>
                  <div className="flex-1 h-2 bg-[var(--color-robo-border)] rounded-full relative">
                    <div
                      className="absolute h-full rounded-full"
                      style={{
                        backgroundColor: CHART_COLORS[i],
                        width: `${((jointAngles[i] + 180) / 360) * 100}%`,
                        left: 0
                      }}
                    ></div>
                  </div>
                  <span className="text-[9px] text-[var(--color-robo-text-muted)] mono w-6">180°</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry Cards */}
        <div className="robo-card">
          <div className="robo-card-title">TELEMETRY</div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Voltage', value: `${telemetry.voltage.toFixed(2)} V`, icon: '⚡', color: 'var(--color-robo-green)' },
              { label: 'Current', value: `${telemetry.current.toFixed(2)} A`, icon: '🔌', color: 'var(--color-robo-blue)' },
              { label: 'Temperature', value: `${telemetry.temp.toFixed(1)} °C`, icon: '🌡️', color: 'var(--color-robo-orange)' },
              { label: 'CPU Load', value: `${telemetry.cpu} %`, icon: '💻', color: 'var(--color-robo-purple)' },
            ].map((item, i) => (
              <div key={i} className="bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded-lg p-3 text-center">
                <div className="text-lg mb-1">{item.icon}</div>
                <div className="text-xs font-bold text-[var(--color-robo-text)] mono">{item.value}</div>
                <div className="text-[10px] text-[var(--color-robo-text-muted)]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance */}
        <div className="robo-card">
          <div className="robo-card-title">PERFORMANCE <span className="text-base cursor-help">ⓘ</span></div>
          <div className="grid grid-cols-5 gap-2 text-center">
            {[
              { label: 'Uptime', value: formatUptime(stats.uptime) },
              { label: 'Loop Rate', value: `${stats.loopRate} Hz` },
              { label: 'Packet Loss', value: `${stats.packetLoss} %` },
              { label: 'Avg. Response', value: `${stats.avgResponse} ms` },
              { label: 'Max. Response', value: `${stats.maxResponse} ms` },
            ].map((item, i) => (
              <div key={i}>
                <div className="text-xs font-bold text-[var(--color-robo-text)] mono">{item.value}</div>
                <div className="text-[9px] text-[var(--color-robo-text-muted)]">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Column 3 - Angle Chart */}
      <div className="robo-card flex flex-col">
        <div className="robo-card-title">ANGLE OVER TIME <span className="text-base cursor-help">ⓘ</span></div>
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={angleHistory.length > 0 ? angleHistory : generateDemoData()}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" />
              <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke="#64748b" interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 9 }} stroke="#64748b" domain={[-180, 180]} />
              <Tooltip
                contentStyle={{ background: '#0f1a0f', border: '1px solid #1a2e1a', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              {['j1', 'j2', 'j3', 'j4', 'j5', 'j6'].map((key, i) => (
                <Line key={key} type="monotone" dataKey={key} name={`J${i + 1}`} stroke={CHART_COLORS[i]} dot={false} strokeWidth={1.5} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Column 4 - System Health + Events */}
      <div className="flex flex-col gap-4">
        {/* System Health */}
        <div className="robo-card">
          <div className="robo-card-title">SYSTEM HEALTH <span className="text-base cursor-help">ⓘ</span></div>
          <div className="space-y-2">
            {HEALTH_ITEMS.map((item, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-xs text-[var(--color-robo-text)]">{item.name}</span>
                </div>
                <span className="flex items-center gap-1 text-xs text-[var(--color-robo-green)]">
                  <span className="status-dot status-dot-green"></span> Healthy
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Events */}
        <div className="robo-card flex-1">
          <div className="robo-card-title">
            EVENTS
            <span className="text-xs text-[var(--color-robo-text-muted)] cursor-pointer">View All</span>
          </div>
          <div className="space-y-2">
            {EVENTS.map((evt, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className={`status-dot mt-1 ${evt.color === 'green' ? 'status-dot-green' : evt.color === 'yellow' ? 'status-dot-yellow' : 'bg-[var(--color-robo-blue)] shadow-[0_0_6px_rgba(59,130,246,0.6)]'}`}></span>
                <div>
                  <div className="text-[10px] text-[var(--color-robo-text-muted)] mono">{evt.time}</div>
                  <div className="text-xs text-[var(--color-robo-text-dim)]">{evt.text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function generateDemoData() {
  const data = [];
  const now = new Date();
  for (let i = 30; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 10000);
    const ts = t.toLocaleTimeString('en-US', { hour12: false });
    data.push({
      time: ts,
      timestamp: t.getTime(),
      j1: -30 + Math.sin(i * 0.2) * 10,
      j2: 28 + Math.cos(i * 0.15) * 5,
      j3: 42 + Math.sin(i * 0.1) * 15,
      j4: -12 + Math.cos(i * 0.25) * 8,
      j5: 55 + Math.sin(i * 0.3) * 12,
      j6: 20 + Math.cos(i * 0.2) * 5,
    });
  }
  return data;
}
