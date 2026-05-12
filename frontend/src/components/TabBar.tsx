'use client';

import React from 'react';
import { useRobotStore } from '@/store/useRobotStore';
import { motion } from 'framer-motion';
import RemoteConnect from './RemoteConnect';

const TABS = [
  { id: 'control', label: 'Control', icon: '🎮' },
  { id: 'gesture', label: 'Gesture', icon: '🤚' },
  { id: 'program', label: 'Program', icon: '📋' },
];

export default function TabBar() {
  const { activeTab, setActiveTab } = useRobotStore();

  return (
    <nav className="tab-bar shrink-0 flex items-center px-2 md:px-4">
      <div className="flex-1 hidden sm:block"></div>
      
      <div className="flex items-center gap-1">
        {TABS.map((tab) => (
          <motion.button
            key={tab.id}
            className={`tab-item px-3 md:px-6 py-2 md:py-3 ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-base md:text-lg">{tab.icon}</span>
            <span className="font-bold tracking-tight text-[10px] md:text-xs">{tab.label}</span>
          </motion.button>
        ))}
      </div>
      
      <div className="flex-1 flex justify-end">
        <RemoteConnect />
      </div>
    </nav>
  );
}
