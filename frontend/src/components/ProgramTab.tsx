'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRobotStore, Program, ProgramStep } from '@/store/useRobotStore';

interface ProgramTabProps {
  onSend: (data: Record<string, unknown>) => void;
}

const JOINT_NAMES = ['J1', 'J2', 'J3', 'J4', 'J5', 'J6'];

export default function ProgramTab({ onSend }: ProgramTabProps) {
  const {
    programs, activeProgram, setActiveProgram, programRunning,
    setProgramRunning, programPaused, setProgramPaused, currentStep,
    setCurrentStep, addProgram, deleteProgram, updateProgram, setTargetAngles,
    setActiveTab, programConfig, setProgramConfig
  } = useRobotStore();

  const [searchQuery, setSearchQuery] = useState('');
  const { loopEnabled, delayBetween, speedMult } = programConfig;

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
    if (!activeProg || activeProg.steps.length === 0) return;
    setProgramRunning(true);
    setProgramPaused(false);
    setCurrentStep(0);
    
    // Immediate execution of first step with speed sync
    const step = activeProg.steps[0];
    onSend({ type: 'speed', value: speedMult });
    onSend({ type: 'move', angles: step.angles });
    setTargetAngles(step.angles);
    console.log('[ProgramTab] Starting sequence:', activeProg.name, 'Step 0 sent');

    // Provide immediate visual feedback before redirection
    setTimeout(() => {
      setActiveTab('control');
    }, 150);
  };

  const handleStop = () => {
    setProgramRunning(false);
    setProgramPaused(false);
    setCurrentStep(0);
  };

  const handlePause = () => setProgramPaused(!programPaused);

  const handleStepForward = () => {
    if (!activeProg) return;
    const next = (currentStep + 1) % activeProg.steps.length;
    setCurrentStep(next);
    const step = activeProg.steps[next];
    onSend({ type: 'move', angles: step.angles, speed: speedMult });
    setTargetAngles(step.angles);
  };

  useEffect(() => {
    if (!programRunning || programPaused || !activeProg) return;

    const current = activeProg.steps[currentStep];
    const timer = setTimeout(() => {
      const nextStep = currentStep + 1;
      
      if (nextStep < activeProg.steps.length) {
        setCurrentStep(nextStep);
        const step = activeProg.steps[nextStep];
        onSend({ type: 'speed', value: speedMult });
        onSend({ type: 'move', angles: step.angles });
        setTargetAngles(step.angles);
        console.log(`[ProgramTab] Executing step ${nextStep + 1}/${activeProg.steps.length}:`, step.name);
      } else if (loopEnabled) {
        setCurrentStep(0);
        const step = activeProg.steps[0];
        onSend({ type: 'speed', value: speedMult });
        onSend({ type: 'move', angles: step.angles });
        setTargetAngles(step.angles);
      } else {
        setProgramRunning(false);
      }
    }, (current.duration * 1000) / (speedMult / 100) + (delayBetween * 1000));

    return () => clearTimeout(timer);
  }, [programRunning, programPaused, currentStep, activeProg, loopEnabled, delayBetween, speedMult, onSend, setCurrentStep, setProgramRunning, setTargetAngles]);

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
        } catch { }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="grid grid-cols-[240px_1fr_300px] gap-4 h-full p-4 animate-fadeIn">
      {/* Left - Program List */}
      <div className="flex flex-col gap-3">
        <div className="robo-card flex-1 flex flex-col">
          <div className="robo-card-title border-b border-[var(--color-robo-border)] pb-2 mb-3 text-xs tracking-widest">SEQUENCE LIBRARY</div>
          <input
            type="text" placeholder="Search routines..."
            className="w-full bg-black/20 border border-[var(--color-robo-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-robo-text)] mb-3 outline-none focus:border-[var(--color-robo-accent)] transition-all"
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          />
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
            {filteredPrograms.map((prog) => (
              <div
                key={prog.id}
                className={`p-2.5 rounded-lg cursor-pointer transition-all border group/item ${activeProgram === prog.id ? 'bg-[var(--color-robo-accent-glow)] border-[var(--color-robo-accent-dim)] shadow-[0_0_10px_rgba(121,192,255,0.1)]' : 'border-transparent hover:bg-[var(--color-robo-card-hover)]'}`}
                onClick={() => setActiveProgram(prog.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[var(--color-robo-text)] tracking-tight">{prog.name}</span>
                    <span className="text-[10px] text-[var(--color-robo-text-muted)] mt-0.5 uppercase tracking-tighter">{prog.steps.length} steps</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${activeProgram === prog.id && programRunning ? 'bg-[var(--color-robo-red)] text-white' : 'bg-[var(--color-robo-accent)] text-[#0b0f1a] opacity-0 group-hover/item:opacity-100 shadow-[0_0_10px_var(--color-robo-accent-glow)]'}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProgram(prog.id);
                        if (programRunning) handleStop();
                        else handleStart();
                      }}
                    >
                      {activeProgram === prog.id && programRunning ? '⏹' : '▶'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button className="robo-btn robo-btn-primary w-full mt-3 text-xs tracking-widest font-black" onClick={handleNewProgram}>+ NEW ROUTINE</button>
        </div>
      </div>

      {/* Center - Step Editor */}
      <div className="robo-card flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Editor</span>
            <span className="text-sm font-black text-[var(--color-robo-text)]">{activeProg?.name || '---'}</span>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-[10px] text-[var(--color-robo-text-muted)] font-bold">TOTAL DURATION: <span className="text-[var(--color-robo-accent)]">{activeProg?.steps.reduce((s, st) => s + st.duration, 0).toFixed(1)}S</span></div>
             <span className="text-[var(--color-robo-text-muted)] cursor-help">ⓘ</span>
          </div>
        </div>

        <div className="overflow-auto flex-1 custom-scrollbar">
          <table className="robo-table">
            <thead>
              <tr>
                <th className="w-8"></th>
                <th className="w-8 text-[10px] uppercase">#</th>
                <th className="text-[10px] uppercase tracking-widest">Step Identifier</th>
                <th className="w-20 text-[10px] uppercase tracking-widest">Time</th>
                <th colSpan={6} className="text-center text-[10px] uppercase tracking-[0.2em] border-l border-[var(--color-robo-border)]">Joint Parameters (J1 - J6)</th>
                <th className="w-16 text-center text-[10px] uppercase tracking-widest border-l border-[var(--color-robo-border)]">Action</th>
              </tr>
            </thead>
            <tbody>
              {activeProg?.steps.map((step, idx) => (
                <tr key={step.id} className={currentStep === idx && programRunning ? 'bg-[var(--color-robo-accent-glow)]' : ''}>
                  <td className="text-[var(--color-robo-text-muted)] cursor-grab opacity-40 hover:opacity-100">⠿</td>
                  <td><span className="text-[10px] font-bold text-[var(--color-robo-text-muted)]">{idx + 1}</span></td>
                  <td className="text-xs font-bold text-[var(--color-robo-text)]">{step.name}</td>
                  <td className="text-xs mono text-[var(--color-robo-accent-dim)]">{step.duration.toFixed(1)}s</td>
                  {step.angles.map((angle, ai) => (
                    <td key={ai} className={`text-xs mono text-center border-l border-[var(--color-robo-border)/30] ${Math.abs(angle) > 30 ? 'text-[var(--color-robo-accent)]' : 'text-[var(--color-robo-text-dim)]'}`}>
                      {angle}°
                    </td>
                  ))}
                  <td className="text-center border-l border-[var(--color-robo-border)]">
                    <span className="text-[var(--color-robo-text-muted)] cursor-pointer hover:text-[var(--color-robo-accent)] text-sm mr-1">✏️</span>
                    <span className="text-[var(--color-robo-text-muted)] cursor-pointer hover:text-[var(--color-robo-red)] text-sm">🗑</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-[var(--color-robo-border)]">
          <button className="robo-btn robo-btn-primary text-[10px] px-4 py-2 font-black tracking-widest" onClick={handleAddStep}>+ ADD STEP</button>
          <button className="robo-btn robo-btn-secondary text-[10px] px-4 py-2 font-black tracking-widest">DUPLICATE</button>
          <button className="robo-btn robo-btn-secondary text-[10px] px-4 py-2 font-black tracking-widest" onClick={handleImport}>IMPORT</button>
          <button className="robo-btn robo-btn-secondary text-[10px] px-4 py-2 font-black tracking-widest" onClick={handleExport}>EXPORT</button>
          <div className="flex-1"></div>
          <button className="robo-btn robo-btn-danger text-[10px] px-4 py-2 font-black tracking-widest">CLEAR ALL</button>
        </div>
      </div>

      {/* Right - Execution Control Panel (Replaces 3D Space) */}
      <div className="flex flex-col gap-4 overflow-y-auto pr-1">
        <div className="robo-card border-[var(--color-robo-accent-dim)] shadow-[0_0_30px_var(--color-robo-accent-glow)] p-4">
           <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-[0.2em]">Live Execution</span>
                <span className="text-sm font-black text-[var(--color-robo-text)] tracking-tight truncate max-w-[150px]">{activeProg?.name || '---'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${programRunning ? 'text-[var(--color-robo-accent)]' : 'text-[var(--color-robo-text-muted)]'}`}>
                  {programRunning ? 'Active' : 'Ready'}
                </span>
                <span className={`status-dot ${programRunning ? 'status-dot-green animate-pulse' : 'bg-gray-600'}`}></span>
              </div>
           </div>

           <div className="flex flex-col gap-2">
             <button
                className={`w-full py-3 rounded-xl font-black text-xs tracking-[0.3em] transition-all flex items-center justify-center gap-2 border ${programRunning ? 'bg-[var(--color-robo-red)] border-transparent text-white shadow-[0_0_40px_rgba(248,81,73,0.4)] animate-pulse' : 'bg-transparent border-[var(--color-robo-accent)] text-[var(--color-robo-accent)] hover:bg-[var(--color-robo-accent-glow)] hover:shadow-[0_0_20px_var(--color-robo-accent-glow)] active:scale-95'}`}
                onClick={programRunning ? handleStop : handleStart}
              >
                <span className="text-sm">{programRunning ? '⏹' : '▶'}</span>
                <span>{programRunning ? 'STOP SEQUENCE' : 'START SEQUENCE'}</span>
              </button>

              <div className="flex gap-2">
                 <button 
                    className={`flex-[1.5] py-2.5 rounded-lg border font-black text-[9px] tracking-widest transition-all flex items-center justify-center gap-2 ${programPaused ? 'bg-[var(--color-robo-accent)] text-[#0b0f1a] shadow-[0_0_15px_var(--color-robo-accent-glow)]' : 'bg-black/20 border-[var(--color-robo-border)] text-[var(--color-robo-text-muted)] hover:border-[var(--color-robo-accent)] hover:text-[var(--color-robo-text)]'}`}
                    onClick={handlePause}
                    disabled={!programRunning}
                 >
                    <span className="text-[10px]">{programPaused ? '▶' : '⏸'}</span>
                    {programPaused ? 'RESUME' : 'PAUSE'}
                 </button>
                 <button 
                    className="flex-1 py-2.5 rounded-lg border border-[var(--color-robo-border)] bg-black/20 text-[var(--color-robo-text-muted)] font-black text-[9px] tracking-widest hover:border-[var(--color-robo-accent)] hover:text-[var(--color-robo-text)] transition-all flex items-center justify-center gap-2"
                    onClick={handleStepForward}
                 >
                    <span className="text-[10px]">⏭</span>
                    NEXT
                 </button>
              </div>
           </div>
        </div>

        <div className="robo-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-black text-[var(--color-robo-text-muted)] uppercase tracking-widest">Configuration</span>
            <div className={`toggle-switch ${loopEnabled ? 'active' : ''}`} onClick={() => setProgramConfig({ loopEnabled: !loopEnabled })}></div>
          </div>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[var(--color-robo-text-muted)] font-bold uppercase">Inter-Step Delay</span>
                <span className="text-xs font-bold text-[var(--color-robo-accent)] mono">{delayBetween.toFixed(1)}s</span>
              </div>
              <input type="range" className="robo-slider" min={0} max={5} step={0.1} value={delayBetween} onChange={(e) => setProgramConfig({ delayBetween: Number(e.target.value) })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-[var(--color-robo-text-muted)] font-bold uppercase">Execution Speed</span>
                <span className="text-xs font-bold text-[var(--color-robo-accent)] mono">{speedMult}%</span>
              </div>
              <input type="range" className="robo-slider" min={10} max={100} value={speedMult} onChange={(e) => setProgramConfig({ speedMult: Number(e.target.value) })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
