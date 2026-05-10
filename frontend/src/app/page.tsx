'use client';

import React, { useEffect } from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { useWebSocket } from '@/store/useWebSocket';
import TopBar from '@/components/Header';
import TabBar from '@/components/TabBar';
import ControlTab from '@/components/ControlTab';
import dynamic from 'next/dynamic';
const GestureTab = dynamic(() => import('@/components/GestureTab'), { ssr: false });
import ProgramTab from '@/components/ProgramTab';
import IOTab from '@/components/IOTab';
import MonitorTab from '@/components/MonitorTab';
import { motion, AnimatePresence } from 'framer-motion';

function useDemoTelemetry() {
  const { connectionMode, updateTelemetry, addLog } = useRobotStore();

  useEffect(() => {
    if (connectionMode !== 'disconnected') return;

    const store = useRobotStore.getState();
    if (store.logs.length === 0) {
      const demoLogs = [
        { time: '09:41:01', source: 'system', message: 'System initialized', timestamp: Date.now() - 5000 },
        { time: '09:41:02', source: 'system', message: 'Serial connected: /dev/ttyUSB0', timestamp: Date.now() - 4000 },
        { time: '09:41:02', source: 'system', message: 'WiFi connected: 192.168.4.1', timestamp: Date.now() - 3000 },
        { time: '09:41:05', source: 'cmd', message: 'Mode changed: Manual', timestamp: Date.now() - 1000 },
      ];
      demoLogs.forEach(log => addLog(log));
    }

    if (store.programs.length === 0) {
      store.addProgram({
        id: 'prog-1', name: 'Pick and Place',
        createdAt: 'May 20, 2025, 11:20 AM', modifiedAt: 'Today, 10:24 AM', lastRun: 'Today, 10:35 AM',
        steps: [
          { id: 's1', name: 'Move to Home', duration: 2.0, angles: [0, 45, 90, -10, 0, 10] },
          { id: 's2', name: 'Move to Pick Pos', duration: 2.5, angles: [30, 20, 110, -20, 45, 10] },
          { id: 's3', name: 'Open Gripper', duration: 1.0, angles: [30, 20, 110, -20, 45, 0] },
          { id: 's4', name: 'Move Down', duration: 1.5, angles: [30, 10, 120, -20, 45, 0] },
          { id: 's5', name: 'Close Gripper', duration: 1.0, angles: [30, 10, 120, -20, 45, 30] },
          { id: 's6', name: 'Move Up', duration: 1.5, angles: [30, 20, 110, -20, 45, 30] },
          { id: 's7', name: 'Move to Place', duration: 2.5, angles: [-30, 15, 100, -15, -45, 30] },
          { id: 's8', name: 'Move Down', duration: 1.5, angles: [-30, 5, 110, -15, -45, 30] },
          { id: 's9', name: 'Open Gripper', duration: 1.0, angles: [-30, 5, 110, -15, -45, 0] },
          { id: 's10', name: 'Move Up', duration: 1.5, angles: [-30, 15, 100, -15, -45, 0] },
          { id: 's11', name: 'Return Home', duration: 2.0, angles: [0, 45, 90, -10, 0, 10] },
          { id: 's12', name: 'End', duration: 0.5, angles: [0, 45, 90, -10, 0, 10] },
        ]
      });
      store.addProgram({
        id: 'prog-2', name: 'Home Position', createdAt: 'May 19, 2025', modifiedAt: 'Today, 09:15 AM',
        steps: Array.from({ length: 6 }, (_, i) => ({ id: `s${i}`, name: `Step ${i + 1}`, duration: 1, angles: [0, 45, 90, -10, 0, 0] }))
      });
      store.addProgram({
        id: 'prog-3', name: 'Assembly Sequence', createdAt: 'May 18, 2025', modifiedAt: 'Yesterday, 04:30 PM',
        steps: Array.from({ length: 18 }, (_, i) => ({ id: `s${i}`, name: `Step ${i + 1}`, duration: 1.5, angles: [0, 45, 90, 0, 0, 0] }))
      });
      store.setActiveProgram('prog-1');
    }

    const interval = setInterval(() => {
      const store = useRobotStore.getState();
      const current = store.jointAngles;
      const target = store.targetAngles;
      
      const newAngles = current.map((a, i) => {
        const diff = target[i] - a;
        if (Math.abs(diff) < 0.5) return target[i];
        return Math.round((a + diff * 0.15) * 10) / 10;
      });

      updateTelemetry({
        angles: newAngles,
        voltage: 7.42,
        current: 1.25,
        temp: 38.5,
        cpu: 25,
        heap: 180000,
        rssi: -55,
        timestamp: Date.now()
      });
    }, 50);

    return () => clearInterval(interval);
  }, [connectionMode, updateTelemetry, addLog]);
}

export default function Home() {
  const { activeTab } = useRobotStore();
  const { sendMessage } = useWebSocket();
  useDemoTelemetry();

  const renderTab = () => {
    switch (activeTab) {
      case 'control': return <ControlTab onSend={sendMessage} />;
      case 'gesture': return <GestureTab onSend={sendMessage} />;
      case 'program': return <ProgramTab onSend={sendMessage} />;
      case 'io': return <IOTab onSend={sendMessage} />;
      case 'monitor': return <MonitorTab />;
      default: return <ControlTab onSend={sendMessage} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-[var(--color-robo-bg)]">
      <TopBar />
      <main className="flex-1 overflow-auto min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {renderTab()}
          </motion.div>
        </AnimatePresence>
      </main>
      <TabBar />
    </div>
  );
}
