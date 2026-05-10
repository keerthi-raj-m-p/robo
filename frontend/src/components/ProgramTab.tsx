'use client';

import React, { useState } from 'react';
import { useRobotStore, Program, ProgramStep } from '@/store/useRobotStore';
import dynamic from 'next/dynamic';

const VirtualRobot = dynamic(() => import('./VirtualRobot'), { ssr: false });

interface ProgramTabProps {
  onSend: (data: Record<string, unknown>) => void;
}

const JOINT_NAMES = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'];

export default function ProgramTab({ onSend }: ProgramTabProps) {
  const {
    programs, activeProgram, setActiveProgram, programRunning,
    setProgramRunning, programPaused, setProgramPaused, currentStep,
    setCurrentStep, addProgram, deleteProgram, updateProgram
  } = useRobotStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [loopEnabled, setLoopEnabled] = useState(true);
  const [delayBetween, setDelayBetween] = useState(0.5);
  const [speedMult, setSpeedMult] = useState(100);

  const activeProg = programs.find(p => p.id === activeProgram);
  const filteredPrograms = programs.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleNewProgram = () => {
    const id = `prog-${Date.now()}`;
    const newProg: Program = {
      id, name: 'New Program', steps: [
        { id: `s-${Date.now()}`, name: 'Step 1', duration: 1.0, angles: [0, 45, 90, 0, 0, 0] }
      ],
      createdAt: new Date().toLocaleString(),
      modifiedAt: new Date().toLocaleString()
    };
    addProgram(newProg);
    setActiveProgram(id);
  };

  const handleAddStep = () => {
    if (!activeProg) return;
    const newStep: ProgramStep = {
      id: `s-${Date.now()}`, name: `Step ${activeProg.steps.length + 1}`,
      duration: 1.0, angles: [0, 45, 90, 0, 0, 0]
    };
    updateProgram(activeProg.id, {
      steps: [...activeProg.steps, newStep],
      modifiedAt: new Date().toLocaleString()
    });
  };

  const handleStart = () => {
    if (!activeProg) return;
    setProgramRunning(true);
    setProgramPaused(false);
    setCurrentStep(0);
    if (activeProg.steps[0]) {
      onSend({ type: 'move', angles: activeProg.steps[0].angles, speed: speedMult });
    }
  };

  const handleStop = () => { setProgramRunning(false); setProgramPaused(false); setCurrentStep(0); };
  const handlePause = () => setProgramPaused(!programPaused);
  const handleStepForward = () => {
    if (!activeProg) return;
    const next = Math.min(currentStep + 1, activeProg.steps.length - 1);
    setCurrentStep(next);
    onSend({ type: 'move', angles: activeProg.steps[next].angles, speed: speedMult });
  };

  const handleExport = () => {
    if (!activeProg) return;
    const blob = new Blob([JSON.stringify(activeProg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${activeProg.name.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        try {
          const prog = JSON.parse(ev.target?.result as string) as Program;
          prog.id = `prog-${Date.now()}`;
          prog.modifiedAt = new Date().toLocaleString();
          addProgram(prog);
          setActiveProgram(prog.id);
        } catch {}
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="grid grid-cols-[240px_1fr_280px] gap-4 h-full p-4 animate-fadeIn">
      {/* Left - Program List */}
      <div className="flex flex-col gap-3">
        <div className="robo-card flex-1 flex flex-col">
          <div className="robo-card-title">PROGRAM LIST <span className="text-lg cursor-pointer">+</span></div>
          <input
            type="text" placeholder="Search programs..."
            className="w-full bg-[var(--color-robo-bg)] border border-[var(--color-robo-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-robo-text)] mb-3 outline-none focus:border-[var(--color-robo-green)]"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {filteredPrograms.map((prog) => (
              <div
                key={prog.id}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border ${activeProgram === prog.id ? 'bg-[var(--color-robo-green-glow)] border-[var(--color-robo-green-dim)]' : 'border-transparent hover:bg-[var(--color-robo-card-hover)]'}`}
                onClick={() => setActiveProgram(prog.id)}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-robo-text)]">{prog.name}</span>
                  <div className="flex items-center gap-1">
                    {activeProgram === prog.id && <span className="text-[var(--color-robo-green)] text-sm">▶</span>}
                    <span className="text-[var(--color-robo-text-muted)] text-sm cursor-pointer">⋮</span>
                  </div>
                </div>
                <div className="text-[10px] text-[var(--color-robo-text-muted)] mt-0.5">{prog.steps.length} steps</div>
                <div className="text-[10px] text-[var(--color-robo-text-muted)]">Modified: {prog.modifiedAt}</div>
              </div>
            ))}
          </div>
          <button className="robo-btn robo-btn-primary w-full mt-3 text-xs" onClick={handleNewProgram}>+ NEW PROGRAM</button>
        </div>
      </div>

      {/* Center - Step Editor */}
      <div className="robo-card flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--color-robo-text)]">PROGRAM EDITOR - {activeProg?.name || 'None'}</span>
            <span className="text-[var(--color-robo-text-muted)] cursor-pointer">✏️</span>
          </div>
          <span className="text-xs text-[var(--color-robo-text-muted)]">Total Steps: {activeProg?.steps.length || 0} ⓘ</span>
        </div>

        {/* Table Header */}
        <div className="overflow-auto flex-1">
          <table className="robo-table">
            <thead>
              <tr>
                <th className="w-6"></th>
                <th className="w-8">#</th>
                <th>Step Name</th>
                <th className="w-20">Duration</th>
                <th colSpan={6} className="text-center">Joints (J1-J6)</th>
                <th className="w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeProg?.steps.map((step, idx) => (
                <tr key={step.id} className={currentStep === idx && programRunning ? 'bg-[var(--color-robo-green-glow)]' : ''}>
                  <td className="text-[var(--color-robo-text-muted)] cursor-grab">⠿</td>
                  <td>
                    <span className="text-xs text-[var(--color-robo-text-muted)]">{idx + 1}</span>
                  </td>
                  <td className="text-xs font-medium text-[var(--color-robo-text)]">{step.name}</td>
                  <td className="text-xs mono text-[var(--color-robo-text-dim)]">{step.duration.toFixed(1)}s</td>
                  {step.angles.map((angle, ai) => (
                    <td key={ai} className={`text-xs mono text-center ${Math.abs(angle) > 30 ? 'text-[var(--color-robo-green)]' : 'text-[var(--color-robo-text-dim)]'}`}>
                      {angle}°
                    </td>
                  ))}
                  <td className="text-center">
                    <span className="text-[var(--color-robo-text-muted)] cursor-pointer hover:text-[var(--color-robo-text)] text-sm mr-1">✏️</span>
                    <span className="text-[var(--color-robo-text-muted)] cursor-pointer hover:text-[var(--color-robo-red)] text-sm">🗑</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bottom Action Bar */}
        <div className="flex items-center gap-2 pt-3 mt-3 border-t border-[var(--color-robo-border)]">
          <button className="robo-btn robo-btn-primary text-xs" onClick={handleAddStep}>+ ADD STEP</button>
          <button className="robo-btn robo-btn-secondary text-xs">📋 DUPLICATE</button>
          <button className="robo-btn robo-btn-secondary text-xs" onClick={handleImport}>📥 IMPORT</button>
          <button className="robo-btn robo-btn-secondary text-xs" onClick={handleExport}>📤 EXPORT</button>
          <div className="flex-1"></div>
          <button className="robo-btn robo-btn-danger text-xs">🗑 CLEAR ALL</button>
        </div>
      </div>

      {/* Right - Run Controls */}
      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        <div className="robo-card h-[240px] p-0 overflow-hidden relative">
           <VirtualRobot />
           <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/60 rounded text-[9px] font-bold text-[var(--color-robo-green)] border border-[var(--color-robo-border)]">
             3D PREVIEW
           </div>
        </div>

        <div className="robo-card">
          <div className="robo-card-title">RUN PROGRAM <span className="text-base cursor-help">ⓘ</span></div>
          <div className="text-sm font-semibold text-[var(--color-robo-text)] mb-0.5">{activeProg?.name || 'No program selected'}</div>
          <div className="text-xs text-[var(--color-robo-text-muted)] mb-4">{activeProg?.steps.length || 0} steps</div>

          <button
            className={`w-full py-3 rounded-lg font-bold text-sm mb-3 transition-all ${programRunning ? 'bg-[var(--color-robo-red)] text-white' : 'bg-[var(--color-robo-green)] text-black hover:shadow-[0_0_20px_rgba(34,197,94,0.3)]'}`}
            onClick={programRunning ? handleStop : handleStart}
          >
            {programRunning ? '⏹ STOP' : '▶ START'}
          </button>

          <div className="flex gap-2">
            <button className="robo-btn robo-btn-secondary flex-1 text-xs" onClick={handlePause} disabled={!programRunning}>⏸ PAUSE</button>
            <button className="robo-btn robo-btn-secondary flex-1 text-xs" onClick={handleStop} disabled={!programRunning}>⏹ STOP</button>
            <button className="robo-btn robo-btn-secondary flex-1 text-xs" onClick={handleStepForward}>⏭ STEP</button>
          </div>
        </div>

        <div className="robo-card">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-[var(--color-robo-text-dim)] uppercase">Loop</span>
            <div className={`toggle-switch ${loopEnabled ? 'active' : ''}`} onClick={() => setLoopEnabled(!loopEnabled)}></div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--color-robo-text-dim)]">DELAY BETWEEN STEPS</span>
              <span className="text-xs font-bold text-[var(--color-robo-text)] mono">{delayBetween.toFixed(1)}s</span>
            </div>
            <input type="range" className="robo-slider" min={0} max={5} step={0.1} value={delayBetween} onChange={(e) => setDelayBetween(Number(e.target.value))} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-[var(--color-robo-text-dim)]">SPEED MULTIPLIER</span>
              <span className="text-xs font-bold text-[var(--color-robo-text)] mono">{speedMult}%</span>
            </div>
            <input type="range" className="robo-slider" min={10} max={100} value={speedMult} onChange={(e) => setSpeedMult(Number(e.target.value))} />
          </div>
        </div>

        <div className="robo-card">
          <div className="robo-card-title">PROGRAM INFO</div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Created:</span><span className="text-[var(--color-robo-text-dim)]">{activeProg?.createdAt || '-'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Modified:</span><span className="text-[var(--color-robo-text-dim)]">{activeProg?.modifiedAt || '-'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Total Steps:</span><span className="text-[var(--color-robo-text-dim)]">{activeProg?.steps.length || 0}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Total Duration:</span><span className="text-[var(--color-robo-text-dim)]">{activeProg?.steps.reduce((s, st) => s + st.duration, 0).toFixed(1) || '0'}s</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Last Run:</span><span className="text-[var(--color-robo-text-dim)]">{activeProg?.lastRun || 'Never'}</span></div>
            <div className="flex justify-between"><span className="text-[var(--color-robo-text-muted)]">Status:</span><span className="text-[var(--color-robo-green)] flex items-center gap-1"><span className="status-dot status-dot-green"></span> Ready</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
