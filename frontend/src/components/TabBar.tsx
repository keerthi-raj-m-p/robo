'use client';

import React from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { motion } from 'framer-motion';

const TABS = [
  { id: 'control', label: 'Control', icon: '🎮' },
  { id: 'gesture', label: 'Gesture', icon: '🤚' },
  { id: 'program', label: 'Program', icon: '📋' },
  { id: 'io', label: 'I/O', icon: '⚡' },
  { id: 'monitor', label: 'Monitor', icon: '📊' },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useRobotStore();

  return (
    <nav className="tab-bar shrink-0">
      {TABS.map((tab) => (
        <motion.button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          whileTap={{ scale: 0.95 }}
        >
          <span className="text-lg">{tab.icon}</span>
          <span>{tab.label}</span>
        </motion.button>
      ))}
    </nav>
  );
}
