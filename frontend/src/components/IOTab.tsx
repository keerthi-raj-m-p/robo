'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';

interface IOTabProps {
  onSend: (data: Record<string, unknown>) => void;
}

const JOINT_NAMES = ['J1 - Base', 'J2 - Shoulder', 'J3 - Elbow', 'J4 - Wrist Pitch', 'J5 - Wrist Yaw', 'J6 - Gripper'];

const DIO_PORTS = [
  { port: 'DIO1', dir: 'Input', state: true, value: 'HIGH (3.3V)', desc: 'Limit Switch 1' },
  { port: 'DIO2', dir: 'Input', state: false, value: 'LOW (0V)', desc: 'Limit Switch 2' },
  { port: 'DIO3', dir: 'Input', state: true, value: 'HIGH (3.3V)', desc: 'Gripper Sensor' },
  { port: 'DIO4', dir: 'Output', state: true, value: 'HIGH (3.3V)', desc: 'Buzzer' },
  { port: 'DIO5', dir: 'Output', state: false, value: 'LOW (0V)', desc: 'LED Indicator' },
];

export default function IOTab({ onSend }: IOTabProps) {
  const { connectionMode, serialPort, telemetry, logs, clearLogs, jointAngles } = useRobotStore();
  const [commandInput, setCommandInput] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const handleSendCommand = () => {
    if (!commandInput.trim()) return;
    onSend({ type: 'command', raw: commandInput.trim() });
    setCommandInput('');
  };

  const analogInputs = [
    { ch: 'A0', value: 512, voltage: '1.65 V' },
    { ch: 'A1', value: 742, voltage: '2.39 V' },
    { ch: 'A2', value: 256, voltage: '0.82 V' },
    { ch: 'A3', value: 925, voltage: '2.98 V' },
  ];

  const getPWM = (angle: number) => Math.round(500 + (angle / 180) * 2000);

  return (
    <div className="grid grid-cols-[240px_1fr_280px] gap-4 h-full p-4 animate-fadeIn">
      {/* Left Panel - Connections, System Status, Log Console */}
      <div className="flex flex-col gap-4">
        {/* Connections */}
        <div className="robo-card">
          <div className="robo-card-title">CONNECTIONS <span className="text-base cursor-help">ⓘ</span></div>
          <div className="space-y-2.5">
            {[
              { name: 'ESP32 (Serial)', addr: serialPort || '/dev/ttyUSB0', connected: connectionMode === 'usb' },
              { name: 'ESP32 (WiFi)', addr: '192.168.4.1', connected: connectionMode === 'wifi' },
              { name: 'WebSocket Server', addr: 'ws://localhost:3001', connected: true },
            ].map((conn, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`status-dot ${conn.connected ? 'status-dot-green' : 'status-dot-red'}`}></span>
                  <div>
                    <div className="text-xs font-medium text-[var(--color-robo-text)]">{conn.name}</div>
                    <div className="text-[10px] text-[var(--color-robo-text-muted)]">
                      {conn.connected ? '● Connected' : '● Disconnected'}
                    </div>
                  </div>
                </div>
                <span className="text-[10px] text-[var(--color-robo-text-muted)] mono">{conn.addr}</span>
              </div>
            ))}
          </div>
        </div>

        {/* System Status */}
        <div className="robo-card">
          <div className="robo-card-title">SYSTEM STATUS</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">System Mode</span><span className="text-[var(--color-robo-text)]">Manual</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Current State</span><span className="text-[var(--color-robo-text)]">Idle</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Uptime</span><span className="text-[var(--color-robo-text)] mono">02:14:36</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Last Command</span><span className="text-[var(--color-robo-text)]">2 sec ago</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Errors</span><span className="text-[var(--color-robo-green)] font-bold">0</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Warnings</span><span className="text-[var(--color-robo-green)] font-bold">0</span></div>
          </div>
        </div>

        {/* Log Console */}
        <div className="robo-card flex-1 flex flex-col min-h-0">
          <div className="robo-card-title">
            LOG CONSOLE
            <button className="text-xs text-[var(--color-robo-text-muted)] hover:text-[var(--color-robo-text)] cursor-pointer" onClick={clearLogs}>Clear</button>
          </div>
          <div className="log-console flex-1" ref={logRef}>
            {logs.length === 0 ? (
              <div className="text-[var(--color-robo-text-muted)]">No logs yet...</div>
            ) : (
              logs.slice(-30).map((log, i) => (
                <div key={i} className="log-line">
                  <span className="log-time">[{log.time}] </span>
                  <span className={`log-${log.source}`}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Center - Servo I/O Monitor & DIO Ports */}
      <div className="flex flex-col gap-4">
        {/* Servo I/O Monitor */}
        <div className="robo-card flex-1">
          <div className="robo-card-title">SERVO I/O MONITOR <span className="text-base cursor-help">ⓘ</span></div>
          <table className="robo-table">
            <thead>
              <tr>
                <th>Joint</th>
                <th>Angle (°)</th>
                <th>Target (°)</th>
                <th>PWM (µs)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {JOINT_NAMES.map((name, i) => (
                <tr key={i}>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-[var(--color-robo-text)]">{name}</span>
                    </div>
                    <div className="servo-bar mt-1 w-full">
                      <div className="servo-bar-fill" style={{ width: `${(jointAngles[i] / 180) * 100}%` }}></div>
                    </div>
                  </td>
                  <td className="mono text-xs">{Math.round(jointAngles[i])}°</td>
                  <td className="mono text-xs text-[var(--color-robo-green)]">{Math.round(jointAngles[i])}°</td>
                  <td className="mono text-xs">{getPWM(jointAngles[i])}</td>
                  <td>
                    <span className="flex items-center gap-1 text-xs text-[var(--color-robo-green)]">
                      <span className="status-dot status-dot-green"></span> OK
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* I/O Ports */}
        <div className="robo-card">
          <div className="robo-card-title">I/O PORTS</div>
          <table className="robo-table">
            <thead>
              <tr>
                <th>Port</th>
                <th>Direction</th>
                <th>State</th>
                <th>Value</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {DIO_PORTS.map((port, i) => (
                <tr key={i}>
                  <td className="text-xs font-medium text-[var(--color-robo-text)]">{port.port}</td>
                  <td>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${port.dir === 'Input' ? 'bg-[var(--color-robo-green-glow)] text-[var(--color-robo-green)]' : 'bg-orange-900/30 text-orange-400'}`}>
                      {port.dir}
                    </span>
                  </td>
                  <td className={`text-xs font-semibold ${port.state ? 'text-[var(--color-robo-green)]' : 'text-[var(--color-robo-text-muted)]'}`}>
                    {port.state ? 'ON' : 'OFF'}
                  </td>
                  <td className="text-xs mono text-[var(--color-robo-text-dim)]">{port.value}</td>
                  <td className="text-xs text-[var(--color-robo-text-muted)]">{port.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Right Panel - Analog, Telemetry, Command Tester */}
      <div className="flex flex-col gap-4">
        {/* Analog Inputs */}
        <div className="robo-card">
          <div className="robo-card-title">ANALOG INPUTS <span className="text-base cursor-help">ⓘ</span></div>
          <div className="space-y-3">
            {analogInputs.map((ai) => (
              <div key={ai.ch}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-[var(--color-robo-text)]">{ai.ch}</span>
                  <div className="flex gap-3">
                    <span className="text-xs mono text-[var(--color-robo-text-dim)]">{ai.value}</span>
                    <span className="text-xs mono text-[var(--color-robo-text-dim)]">{ai.voltage}</span>
                  </div>
                </div>
                <div className="servo-bar">
                  <div className="servo-bar-fill" style={{ width: `${(ai.value / 1023) * 100}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Telemetry */}
        <div className="robo-card">
          <div className="robo-card-title">TELEMETRY <span className="text-base cursor-help">ⓘ</span></div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Voltage</span><span className="text-[var(--color-robo-text)] mono">{telemetry.voltage.toFixed(2)} V</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Current</span><span className="text-[var(--color-robo-text)] mono">{telemetry.current.toFixed(2)} A</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Temperature</span><span className="text-[var(--color-robo-text)] mono">{telemetry.temp.toFixed(1)} °C</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">CPU Load</span><span className="text-[var(--color-robo-text)] mono">{telemetry.cpu} %</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Free Heap</span><span className="text-[var(--color-robo-text)] mono">{Math.round(telemetry.heap / 1024)} KB</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Signal Strength</span><span className="text-[var(--color-robo-text)] mono">{telemetry.rssi} dBm</span></div>
          </div>
        </div>

        {/* Command Tester */}
        <div className="robo-card">
          <div className="robo-card-title">COMMAND TESTER <span className="text-base cursor-help">ⓘ</span></div>
          <div className="flex gap-2 mb-3">
            <input
              type="text" placeholder="Enter raw command..."
              className="flex-1 bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-robo-text)] mono outline-none focus:border-[var(--color-robo-green)]"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            />
            <button className="robo-btn robo-btn-primary text-xs" onClick={handleSendCommand}>SEND</button>
          </div>
          <div className="text-[10px] text-[var(--color-robo-text-muted)] mb-1">Examples:</div>
          <div className="flex flex-wrap gap-1">
            {['S:0,90,90,90,90,0', 'G:1', 'M:HOME'].map((cmd) => (
              <button key={cmd} className="text-[10px] px-2 py-1 bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded text-[var(--color-robo-text-dim)] hover:border-[var(--color-robo-green)] mono cursor-pointer"
                onClick={() => setCommandInput(cmd)}>
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
