'use client';

import { create } from 'zustand';

export interface Telemetry {
  angles: number[];
  voltage: number;
  current: number;
  temp: number;
  cpu: number;
  heap: number;
  rssi: number;
  timestamp: number;
}

export interface ProgramStep {
  id: string;
  name: string;
  duration: number;
  angles: number[];
}

export interface Program {
  id: string;
  name: string;
  steps: ProgramStep[];
  createdAt: string;
  modifiedAt: string;
  lastRun?: string;
}

export interface LogEntry {
  time: string;
  source: string;
  message: string;
  timestamp: number;
}

export interface AngleHistory {
  time: string;
  timestamp: number;
  j1: number; j2: number; j3: number;
  j4: number; j5: number; j6: number;
}

interface RobotState {
  connectionMode: 'usb' | 'wifi' | 'disconnected';
  serialPort: string | null;
  wsConnected: boolean;
  jointAngles: number[];
  targetAngles: number[];
  telemetry: Telemetry;
  angleHistory: AngleHistory[];
  speed: number;
  controlMode: 'joystick' | 'joint';
  gestureMode: boolean;
  programs: Program[];
  activeProgram: string | null;
  programRunning: boolean;
  programPaused: boolean;
  currentStep: number;
  logs: LogEntry[];
  stats: { commandsSent: number; commandsDropped: number; telemetryReceived: number; errors: number; uptime: number; loopRate: number; avgResponse: number; maxResponse: number; packetLoss: number; };
  activeTab: string;
  setConnectionMode: (m: 'usb' | 'wifi' | 'disconnected') => void;
  setSerialPort: (p: string | null) => void;
  setWsConnected: (c: boolean) => void;
  setJointAngles: (a: number[]) => void;
  setTargetAngles: (a: number[]) => void;
  setSingleJoint: (i: number, a: number) => void;
  setSpeed: (s: number) => void;
  setControlMode: (m: 'joystick' | 'joint') => void;
  setGestureMode: (e: boolean) => void;
  updateTelemetry: (d: Telemetry) => void;
  addLog: (e: LogEntry) => void;
  clearLogs: () => void;
  setLogs: (l: LogEntry[]) => void;
  setStats: (s: Partial<RobotState['stats']>) => void;
  setActiveTab: (t: string) => void;
  addProgram: (p: Program) => void;
  updateProgram: (id: string, p: Partial<Program>) => void;
  deleteProgram: (id: string) => void;
  setActiveProgram: (id: string | null) => void;
  setProgramRunning: (r: boolean) => void;
  setProgramPaused: (p: boolean) => void;
  setCurrentStep: (s: number) => void;
}

const DA = [90, 45, 90, 0, 0, 90];

export const useRobotStore = create<RobotState>((set, get) => ({
  connectionMode: 'disconnected',
  serialPort: null,
  wsConnected: false,
  jointAngles: [...DA],
  targetAngles: [...DA],
  telemetry: { angles: [...DA], voltage: 7.48, current: 1.32, temp: 38.6, cpu: 23, heap: 184000, rssi: -58, timestamp: Date.now() },
  angleHistory: [],
  speed: 50,
  controlMode: 'joystick',
  gestureMode: false,
  programs: [],
  activeProgram: null,
  programRunning: false,
  programPaused: false,
  currentStep: 0,
  logs: [],
  stats: { commandsSent: 0, commandsDropped: 0, telemetryReceived: 0, errors: 0, uptime: 8076000, loopRate: 20, avgResponse: 82, maxResponse: 134, packetLoss: 0 },
  activeTab: 'control',
  setConnectionMode: (mode) => set({ connectionMode: mode }),
  setSerialPort: (port) => set({ serialPort: port }),
  setWsConnected: (connected) => set({ wsConnected: connected }),
  setJointAngles: (angles) => set({ jointAngles: angles }),
  setTargetAngles: (angles) => set({ targetAngles: angles }),
  setSingleJoint: (index, angle) => { const a = [...get().targetAngles]; a[index] = angle; set({ targetAngles: a, jointAngles: a }); },
  setSpeed: (speed) => set({ speed }),
  setControlMode: (mode) => set({ controlMode: mode }),
  setGestureMode: (enabled) => set({ gestureMode: enabled }),
  updateTelemetry: (data) => {
    const h = [...get().angleHistory];
    const t = new Date().toLocaleTimeString('en-US', { hour12: false });
    h.push({ time: t, timestamp: data.timestamp, j1: data.angles[0], j2: data.angles[1], j3: data.angles[2], j4: data.angles[3], j5: data.angles[4], j6: data.angles[5] });
    if (h.length > 60) h.splice(0, h.length - 60);
    set({ telemetry: data, jointAngles: data.angles, angleHistory: h });
  },
  addLog: (entry) => { const l = [...get().logs, entry]; if (l.length > 200) l.splice(0, l.length - 200); set({ logs: l }); },
  clearLogs: () => set({ logs: [] }),
  setLogs: (logs) => set({ logs }),
  setStats: (stats) => set({ stats: { ...get().stats, ...stats } }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  addProgram: (program) => set({ programs: [...get().programs, program] }),
  updateProgram: (id, updates) => set({ programs: get().programs.map(p => p.id === id ? { ...p, ...updates } : p) }),
  deleteProgram: (id) => set({ programs: get().programs.filter(p => p.id !== id), activeProgram: get().activeProgram === id ? null : get().activeProgram }),
  setActiveProgram: (id) => set({ activeProgram: id }),
  setProgramRunning: (running) => set({ programRunning: running }),
  setProgramPaused: (paused) => set({ programPaused: paused }),
  setCurrentStep: (step) => set({ currentStep: step }),
}));
