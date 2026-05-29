"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, X, FileText, MousePointer2, Info, ChevronRight, Check, Save } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

// --- CONFIGURACIÓN Y COLORES ---
const MODES = {
  PATHOLOGY: { id: 'pathology', label: 'Patología', color: '#ef4444' }, // Red
  TREATMENT: { id: 'treatment', label: 'Realizado', color: '#3b82f6' }  // Blue
};

const TOOLS = {
  SELECT: { id: 'select', label: 'Cursor', hotkey: 'V' },
  ERASER: { id: 'eraser', label: 'Borrar', hotkey: 'D' },
  CARIES: { id: 'caries', label: 'Caries/Obt.', type: 'surface', hotkey: '1' },
  SEALANT: { id: 'sealant', label: 'Sellante', type: 'surface', hotkey: '2' },
  EXTRACTION: { id: 'extraction', label: 'Extracción', type: 'whole', hotkey: '3' },
  CROWN: { id: 'crown', label: 'Corona', type: 'whole', hotkey: '4' },
  ENDODONTICS: { id: 'endodontics', label: 'Endodoncia', type: 'whole', hotkey: '5' },
  LOSS_OTHER: { id: 'loss_other', label: 'Pérdida (Otra)', type: 'whole', hotkey: '6' },
  PROSTHESIS_FIXED: { id: 'fixed', label: 'P. Fija', type: 'range', hotkey: '7' },
  PROSTHESIS_REMOVABLE: { id: 'removible', label: 'P. Removible', type: 'range', hotkey: '8' },
};

const ADULT_QUADRANTS = {
  Q1: [18, 17, 16, 15, 14, 13, 12, 11],
  Q2: [21, 22, 23, 24, 25, 26, 27, 28],
  Q3: [48, 47, 46, 45, 44, 43, 42, 41],
  Q4: [31, 32, 33, 34, 35, 36, 37, 38],
};

const CHILD_QUADRANTS = {
  Q5: [55, 54, 53, 52, 51],
  Q6: [61, 62, 63, 64, 65],
  Q7: [85, 84, 83, 82, 81],
  Q8: [71, 72, 73, 74, 75],
};

const ARCH_SEQUENCES = {
  UPPER_ADULT: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  LOWER_ADULT: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
  UPPER_CHILD: [55, 54, 53, 52, 51, 61, 62, 63, 64, 65],
  LOWER_CHILD: [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]
};

// --- LOGICA DE ESTADO ---
const generateInitialState = () => {
  const state: Record<string, any> = {};
  const allTeeth = [
    ...Object.values(ADULT_QUADRANTS).flat(),
    ...Object.values(CHILD_QUADRANTS).flat()
  ];
  allTeeth.forEach(id => {
    state[id] = {
      id,
      surfaces: { top: null, bottom: null, left: null, right: null, center: null },
      condition: null,
      status: null,
      recesion: '',
      movilidad: '',
      notes: ''
    };
  });
  return state;
};

// --- COMPONENTES UI ---

interface ToothProps {
  id: number;
  data: any;
  currentTool: any;
  currentMode: 'red' | 'blue';
  isDeciduous: boolean;
  onApply: (id: number, zone: string, tool: any, mode: 'red' | 'blue') => void;
  isInsideFixedRange: boolean;
  isFixedEndpoint: boolean;
  isInsideRemovibleRange: boolean;
  onRangeStart?: (id: number) => void;
}

const Tooth = ({ 
  id, data, currentTool, currentMode, isDeciduous, onApply, 
  isInsideFixedRange, isFixedEndpoint, isInsideRemovibleRange, onRangeStart 
}: ToothProps) => {
  const condition = data?.condition;
  const isRemovible = data?.bridge?.type === 'removible';
  const statusColor = isRemovible 
    ? '#8b5cf6' // Premium Violet 500 for Removable Bridge (notorious!)
    : (data?.status === 'completed' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color);
  
  const isLoss = condition === 'loss_other';
  const isExtracted = condition === 'extraction';
  const isEndo = condition === 'endodontics';
  const isCrown = condition === 'crown';

  // Logic to determine if it's an upper (maxilar) or lower (mandibular) tooth
  // Upper: 18-11, 21-28, 55-51, 61-65
  // Lower: 41-48, 31-38, 85-81, 71-75
  const isUpper = (id >= 11 && id <= 28) || (id >= 51 && id <= 65);

  const getSurfaceFill = (surface: string) => {
    const val = data?.surfaces?.[surface];
    if (!val) return 'transparent';
    const [tool, mode] = val.split(':');
    if (tool === 'sealant') return mode === 'red' ? '#fee2e2' : '#dbeafe';
    return mode === 'red' ? MODES.PATHOLOGY.color : MODES.TREATMENT.color;
  };

  const getSurfaceStroke = (surface: string) => {
    const val = data?.surfaces?.[surface];
    if (!val) return '#cbd5e1';
    const [tool, mode] = val.split(':');
    return mode === 'red' ? MODES.PATHOLOGY.color : MODES.TREATMENT.color;
  };

  const handleApply = (zone: string) => {
    if (currentTool.type === 'range') {
        onRangeStart?.(id);
    } else {
        onApply(id, zone, currentTool, currentMode === 'red' ? 'red' : 'blue');
    }
  };

  const renderInputs = () => (
    <div className="flex flex-col gap-0.5">
       <input 
          className="w-8 h-4 text-[9px] font-bold text-center border border-border outline-none focus:border-blue-500 bg-card"
          placeholder="R"
          value={data?.recesion || ''}
          onChange={(e) => onApply(id, 'recesion', { id: 'meta' }, e.target.value as any)}
       />
       <input 
          className="w-8 h-4 text-[9px] font-bold text-center border border-border outline-none focus:border-blue-500 bg-card"
          placeholder="M"
          value={data?.movilidad || ''}
          onChange={(e) => onApply(id, 'movilidad', { id: 'meta' }, e.target.value as any)}
       />
    </div>
  );

  return (
    <div className="flex flex-col items-center select-none">
      {isUpper && renderInputs()}
      
      <div className="relative w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 lg:w-9 lg:h-9 xl:w-10 xl:h-10 my-1 flex items-center justify-center">
        {isInsideFixedRange && (
            <div 
               className={cn(
                  "absolute top-1/2 left-0 right-0 h-0 z-10 flex items-center justify-center pointer-events-none",
                  isFixedEndpoint ? "" : "border-t-2 border-solid"
               )} 
               style={{ borderColor: statusColor }}
            >
               {!isFixedEndpoint && (
                  <span className="text-[12px] font-black leading-none select-none bg-card px-0.5 rounded" style={{ color: statusColor }}>-</span>
               )}
            </div>
        )}
        {isFixedEndpoint && (
            <div className="absolute inset-x-0 inset-y-0 border-2 z-20 pointer-events-none rounded" style={{ borderColor: statusColor }} />
        )}
        {isInsideRemovibleRange && (
            <div className="absolute top-[60%] left-0 right-0 h-0 z-10 flex items-center justify-center pointer-events-none border-t-[3px] border-dashed border-violet-500 dark:border-violet-400" />
        )}

        {isExtracted && <X className="absolute inset-0 w-full h-full z-30 opacity-80" strokeWidth={3} color={statusColor} />}
        {isLoss && <div className="absolute inset-0 flex items-center justify-center z-30"><div className="w-1 h-full" style={{ backgroundColor: statusColor }} /></div>}
        {isEndo && <div className="absolute inset-0 flex items-center justify-center z-30"><div className="w-0.5 h-full relative" style={{ backgroundColor: statusColor }}><div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 border-t-2 border-l-2" style={{ borderColor: statusColor }} /></div></div>}
        {isCrown && <div className="absolute inset-0 rounded-full border-4 z-20 pointer-events-none" style={{ borderColor: statusColor }} />}

        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_1px_1px_rgba(0,0,0,0.05)]">
            <g className="cursor-pointer">
                {isDeciduous ? (
                    <>
                        <path d="M 20,20 L 80,20 L 50,51 Z" fill={getSurfaceFill('top')} stroke={getSurfaceStroke('top')} strokeWidth="1" onClick={() => handleApply('top')} />
                        <path d="M 20,80 L 80,80 L 50,49 Z" fill={getSurfaceFill('bottom')} stroke={getSurfaceStroke('bottom')} strokeWidth="1" onClick={() => handleApply('bottom')} />
                        <path d="M 20,20 L 20,80 L 49,50 Z" fill={getSurfaceFill('left')} stroke={getSurfaceStroke('left')} strokeWidth="1" onClick={() => handleApply('left')} />
                        <path d="M 80,20 L 80,80 L 51,50 Z" fill={getSurfaceFill('right')} stroke={getSurfaceStroke('right')} strokeWidth="1" onClick={() => handleApply('right')} />
                        <circle cx="50" cy="50" r="18" fill={getSurfaceFill('center')} stroke={getSurfaceStroke('center')} strokeWidth="1" onClick={() => handleApply('center')} />
                    </>
                ) : (
                    <>
                        <polygon points="5,5 95,5 70,30 30,30" fill={getSurfaceFill('top')} stroke={getSurfaceStroke('top')} strokeWidth="1" onClick={() => handleApply('top')} />
                        <polygon points="30,70 70,70 95,95 5,95" fill={getSurfaceFill('bottom')} stroke={getSurfaceStroke('bottom')} strokeWidth="1" onClick={() => handleApply('bottom')} />
                        <polygon points="5,5 30,30 30,70 5,95" fill={getSurfaceFill('left')} stroke={getSurfaceStroke('left')} strokeWidth="1" onClick={() => handleApply('left')} />
                        <polygon points="95,5 95,95 70,70 70,30" fill={getSurfaceFill('right')} stroke={getSurfaceStroke('right')} strokeWidth="1" onClick={() => handleApply('right')} />
                        <rect x="30" y="30" width="40" height="40" fill={getSurfaceFill('center')} stroke={getSurfaceStroke('center')} strokeWidth="1" onClick={() => handleApply('center')} />
                    </>
                )}
            </g>
        </svg>
      </div>

      {!isUpper && renderInputs()}
      <span className="text-[10px] font-black text-slate-400 mt-1">{id}</span>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

// --- CALCULO DINAMICO CPO-ceo ---
const calculateCPOceo = (teeth: Record<string, any>) => {
  let C = 0, P = 0, O = 0; // Permanente
  let c = 0, e = 0, o = 0; // Temporario

  Object.entries(teeth).forEach(([idKey, data]) => {
    const id = parseInt(idKey);
    const isDeciduous = (id >= 51 && id <= 65) || (id >= 71 && id <= 85);
    
    const condition = data?.condition;
    const status = data?.status; // 'completed' (blue) or 'planned' (red)
    
    // Decayed (C / c)
    let hasCariesPlanned = false;
    let hasCariesCompleted = false;
    if (data?.surfaces) {
      Object.values(data.surfaces).forEach((val: any) => {
        if (val) {
          const [tool, mode] = val.split(':');
          if (tool === 'caries') {
            if (mode === 'red') hasCariesPlanned = true;
            if (mode === 'blue') hasCariesCompleted = true;
          }
        }
      });
    }

    if (isDeciduous) {
      if (hasCariesPlanned) {
        c++;
      } else if (condition === 'extraction' && status === 'planned') {
        e++;
      } else if (hasCariesCompleted || (condition === 'crown' && status === 'completed')) {
        o++;
      }
    } else {
      if (hasCariesPlanned) {
        C++;
      } else if ((condition === 'extraction' || condition === 'loss_other') && status === 'planned') {
        P++;
      } else if (hasCariesCompleted || (condition === 'crown' && status === 'completed')) {
        O++;
      }
    }
  });

  return {
    C, P, O, totalCPO: C + P + O,
    c, e, o, totalceo: c + e + o
  };
};

export function OdontogramaInteractive({ data = {}, onChange, patientName = "Paciente", patientId = "", readOnly = false, stickyOffset = 96, onSave }: any) {
  const [teethState, setTeethState] = useState<Record<string, any>>(() => ({ ...generateInitialState(), ...data }));
  const [activeTool, setActiveTool] = useState<any>(TOOLS.SELECT);
  const [activeMode, setActiveMode] = useState<'red' | 'blue'>('red');
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      
      // Ignore key events when the user is typing in inputs or textareas
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const key = e.key;
      const code = e.code;

      // Color/Mode Shortcuts
      if (key.toLowerCase() === 'p' || key === '*' || key === '-' || code === 'NumpadSubtract' || code === 'NumpadMultiply') {
        setActiveMode('red');
        e.preventDefault();
      } else if (key.toLowerCase() === 'r' || key === '+' || key === 'Enter' || code === 'NumpadAdd' || code === 'NumpadEnter') {
        setActiveMode('blue');
        e.preventDefault();
      }

      // Tool Shortcuts (Standard & Numpad)
      if (key === '1' || code === 'Numpad1') {
        setActiveTool(TOOLS.CARIES);
        setRangeStart(null);
      } else if (key === '2' || code === 'Numpad2') {
        setActiveTool(TOOLS.SEALANT);
        setRangeStart(null);
      } else if (key === '3' || code === 'Numpad3') {
        setActiveTool(TOOLS.EXTRACTION);
        setRangeStart(null);
      } else if (key === '4' || code === 'Numpad4') {
        setActiveTool(TOOLS.CROWN);
        setRangeStart(null);
      } else if (key === '5' || code === 'Numpad5') {
        setActiveTool(TOOLS.ENDODONTICS);
        setRangeStart(null);
      } else if (key === '6' || code === 'Numpad6') {
        setActiveTool(TOOLS.LOSS_OTHER);
        setRangeStart(null);
      } else if (key === '7' || code === 'Numpad7') {
        setActiveTool(TOOLS.PROSTHESIS_FIXED);
        setRangeStart(null);
      } else if (key === '8' || code === 'Numpad8') {
        setActiveTool(TOOLS.PROSTHESIS_REMOVABLE);
        setRangeStart(null);
      } else if (key === '0' || code === 'Numpad0' || key === 'Delete' || key === 'Backspace') {
        setActiveTool(TOOLS.ERASER);
        setRangeStart(null);
      } else if (key === 'Escape' || key.toLowerCase() === 'v') {
        setActiveTool(TOOLS.SELECT);
        setRangeStart(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [readOnly]);

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setTeethState(prev => ({ ...prev, ...data }));
    }
  }, [data]);

  const applyTreatment = useCallback((toothId: number, zone: string, tool: any, mode: any) => {
    if (readOnly) return;
    
    // Compute the new state outside the state setter to avoid React render lifecycle warnings
    const newState = { ...teethState };
    const tooth = { ...(newState[toothId] || { id: toothId, surfaces: {}, condition: null, status: null, recesion: '', movilidad: '' }) };
    tooth.surfaces = { ...tooth.surfaces }; // Shallow copy of surfaces for safety
    
    if (tool.id === 'meta') {
        tooth[zone] = mode;
    } else if (tool.id === 'eraser') {
        tooth.condition = null;
        tooth.status = null;
        tooth.surfaces = { top: null, bottom: null, left: null, right: null, center: null };
        tooth.bridge = null;
    } else if (tool.type === 'whole') {
        tooth.condition = tooth.condition === tool.id ? null : tool.id;
        tooth.status = mode === 'blue' ? 'completed' : 'planned';
    } else if (tool.type === 'surface') {
        const val = `${tool.id}:${mode}`;
        tooth.surfaces[zone] = tooth.surfaces[zone] === val ? null : val;
    }
    
    newState[toothId] = tooth;
    
    setTeethState(newState);
    onChange?.(newState);
  }, [onChange, readOnly, teethState]);

  const handleRange = (endId: number) => {
    if (!rangeStart) {
        setRangeStart(endId);
        return;
    }
    
    let selectedArchSequence: number[] | null = null;

    // Find which anatomical sequence contains BOTH teeth
    for (const seq of Object.values(ARCH_SEQUENCES)) {
        if (seq.includes(rangeStart) && seq.includes(endId)) {
            selectedArchSequence = seq;
            break;
        }
    }

    if (selectedArchSequence) {
        const newState = { ...teethState };
        const startIndex = selectedArchSequence.indexOf(rangeStart);
        const endIndex = selectedArchSequence.indexOf(endId);
        const minIndex = Math.min(startIndex, endIndex);
        const maxIndex = Math.max(startIndex, endIndex);

        const activeRangeTeeth = selectedArchSequence.slice(minIndex, maxIndex + 1);
        const start = selectedArchSequence[minIndex];
        const end = selectedArchSequence[maxIndex];

        activeRangeTeeth.forEach(id => {
            const tooth = { ...(newState[id] || { id, surfaces: {}, condition: null, status: null, recesion: '', movilidad: '' }) };
            if (activeTool.id === 'fixed' && (id === start || id === end)) {
                tooth.condition = 'crown';
                tooth.status = activeMode === 'blue' ? 'completed' : 'planned';
            }
            tooth.bridge = { type: activeTool.id, start, end, status: activeMode === 'blue' ? 'completed' : 'planned' };
            newState[id] = tooth;
        });

        setTeethState(newState);
        onChange?.(newState);
    }
    
    setRangeStart(null);
  };

  const renderQuadrant = (ids: number[], isChild = false) => (
    <div className="flex gap-0.5 sm:gap-1">
      {ids.map(id => {
        const toothData = teethState[id];
        const bridge = toothData?.bridge;
        return (
          <Tooth 
            key={id}
            id={id}
            data={toothData}
            currentTool={activeTool}
            currentMode={activeMode}
            isDeciduous={isChild}
            onApply={applyTreatment}
            onRangeStart={handleRange}
            isInsideFixedRange={bridge?.type === 'fixed'}
            isFixedEndpoint={bridge?.type === 'fixed' && (id === bridge.start || id === bridge.end)}
            isInsideRemovibleRange={bridge?.type === 'removible'}
          />
        );
      })}
    </div>
  );

  return (
    <div className="bg-card rounded-xl shadow-2xl border flex flex-col w-full">
      {/* TOOLBAR */}
      <div 
         className="bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/60 border-b p-4 flex flex-wrap items-center justify-between gap-4 rounded-t-xl sticky z-20 transition-all shadow-sm"
         style={{ top: `${stickyOffset}px` }}
      >
         <div className="flex items-center gap-6 flex-wrap">
            <div className="space-y-1">
               <h3 className="text-xs font-black uppercase tracking-tighter text-slate-400">Estado Clínico</h3>
               <div className="flex bg-card rounded-lg p-1 border shadow-sm">
                  <button 
                    onClick={() => setActiveMode('red')}
                    className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeMode === 'red' ? "bg-red-500 text-white shadow-lg shadow-red-200" : "text-slate-500")}
                  >
                    <div className={cn("w-2 h-2 rounded-full", activeMode === 'red' ? "bg-card" : "bg-red-500")} />
                    PATOLOGÍA
                    <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded border border-current bg-black/5 opacity-60 ml-1">P / -</span>
                  </button>
                  <button 
                    onClick={() => setActiveMode('blue')}
                    className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeMode === 'blue' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-500")}
                  >
                    <div className={cn("w-2 h-2 rounded-full", activeMode === 'blue' ? "bg-card" : "bg-blue-600")} />
                    REALIZADO
                    <span className="text-[9px] font-mono font-bold px-1 py-0.2 rounded border border-current bg-black/5 opacity-60 ml-1">R / +</span>
                  </button>
               </div>
            </div>
 
            <div className="space-y-1">
               <h3 className="text-xs font-black uppercase tracking-tighter text-slate-400">Herramientas</h3>
               <div className="flex gap-1.5 flex-wrap">
                  <button
                     onClick={() => { setActiveTool(TOOLS.SELECT); setRangeStart(null); }}
                     className={cn(
                         "px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5",
                         activeTool.id === TOOLS.SELECT.id ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-card text-slate-600 hover:border-slate-400"
                     )}
                  >
                     {TOOLS.SELECT.label}
                     <span className={cn(
                        "text-[9px] font-mono font-bold px-1 py-0.2 rounded border",
                        activeTool.id === TOOLS.SELECT.id ? "border-white/20 bg-white/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                     )}>
                        Esc
                     </span>
                  </button>

                  {[TOOLS.CARIES, TOOLS.SEALANT, TOOLS.EXTRACTION, TOOLS.CROWN, TOOLS.ENDODONTICS, TOOLS.LOSS_OTHER, TOOLS.PROSTHESIS_FIXED, TOOLS.PROSTHESIS_REMOVABLE].map(tool => (
                     <button
                        key={tool.id}
                        onClick={() => { setActiveTool(tool); setRangeStart(null); }}
                        className={cn(
                            "px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all whitespace-nowrap flex items-center gap-1.5",
                            activeTool.id === tool.id ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-card text-slate-600 hover:border-slate-400"
                        )}
                        style={tool.id === 'removible' ? { borderColor: '#c084fc', color: activeTool.id === 'removible' ? undefined : '#6b21a8' } : undefined}
                     >
                        {tool.label}
                        <span className={cn(
                           "text-[9px] font-mono font-bold px-1 py-0.2 rounded border",
                           activeTool.id === tool.id ? "border-white/20 bg-white/10" : "border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                        )}>
                           {tool.hotkey}
                        </span>
                      </button>
                  ))}
                  
                  <button 
                     onClick={() => { setActiveTool(TOOLS.ERASER); setRangeStart(null); }} 
                     className={cn("p-1.5 px-2.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold transition-all", activeTool.id === 'eraser' ? "bg-red-100 border-red-200 text-red-600 shadow-sm" : "bg-card text-slate-600 hover:border-slate-400")}
                     title="Borrador [0 / Del]"
                  >
                     <Eraser size={14} />
                     <span className={cn(
                        "text-[9px] font-mono font-bold px-1 py-0.2 rounded border",
                        activeTool.id === 'eraser' ? "border-red-200 bg-red-50 text-red-600" : "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-800 dark:bg-slate-900"
                     )}>
                        0
                     </span>
                  </button>
               </div>
            </div>
         </div>

         {onSave && (
            <div className="flex items-center gap-2 flex-shrink-0">
               <button
                  onClick={onSave}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-blue-200 dark:shadow-none hover:shadow-lg transition-all"
                  title="Guardar expediente"
               >
                  <Save size={13} />
                  GUARDAR
               </button>
            </div>
         )}

         {rangeStart && (
             <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center gap-3 animate-pulse">
                <Info size={16} className="text-amber-600" />
                <p className="text-xs font-bold text-amber-700">Seleccione la pieza final para {activeTool.label}</p>
                <button onClick={() => setRangeStart(null)} className="text-[10px] uppercase font-black text-amber-900 underline">Cancelar</button>
             </div>
         )}
      </div>

      {/* CANVAS */}
      <div className="flex-1 p-4 md:p-8 bg-muted/50/30">
         <div className="mx-auto max-w-5xl flex flex-col gap-6 md:gap-12 bg-card p-4 sm:p-6 md:p-8 lg:p-12 rounded-xl md:rounded-[2rem] shadow-inner border border-border/50">
            
            {/* Legend/Header */}
            <div className="flex justify-between items-start border-b pb-6">
                <div>
                    <h2 className="text-2xl font-black text-foreground tracking-tight">6 ODONTOGRAMA</h2>
                    <p className="text-[11px] text-slate-400 font-medium max-w-sm mt-1">
                        PINTAR CON: <span className="text-blue-600 font-bold">AZUL PARA TRATAMIENTO REALIZADO</span> - <span className="text-red-500 font-bold">ROJO PARA PATOLOGÍA ACTUAL</span>
                    </p>
                </div>
                <div className="text-right">
                    <Badge variant="outline" className="text-[10px] font-mono py-0">{patientId || 'PACIENTE'}</Badge>
                </div>
            </div>

            {/* Odontogram Grid with Labels */}
            <div className="flex-1 min-w-0 w-full bg-card p-4 md:p-6 rounded-xl md:rounded-2xl border shadow-sm overflow-x-auto custom-scrollbar">
                <div className="grid grid-cols-[70px_1fr] sm:grid-cols-[100px_1fr] gap-2 sm:gap-4">
                    {/* Labels Column */}
                    <div className="flex flex-col justify-around py-12 text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                        <div className="h-8 flex flex-col justify-center">Recesión<br/>Movilidad</div>
                        <div className="h-12 flex items-center">Vestibular</div>
                        <div className="h-12 flex items-center">Palatino</div>
                        <div className="h-8 flex items-center">Lingual</div>
                        <div className="h-12 flex items-center">Vestibular</div>
                        <div className="h-8 flex flex-col justify-center">Movilidad<br/>Recesión</div>
                    </div>

                    <div className="space-y-8">
                        {/* Upper Teeth (Adult) */}
                        <div className="flex justify-center gap-0.5 sm:gap-1">
                            {renderQuadrant(ADULT_QUADRANTS.Q1)}
                            {renderQuadrant(ADULT_QUADRANTS.Q2)}
                        </div>

                        {/* Middle Row (Deciduous) */}
                        <div className="flex flex-col gap-2 sm:gap-4 items-center">
                            <div className="flex gap-0.5 sm:gap-1">
                                {renderQuadrant(CHILD_QUADRANTS.Q5, true)}
                                {renderQuadrant(CHILD_QUADRANTS.Q6, true)}
                            </div>
                            <div className="flex gap-0.5 sm:gap-1">
                                {renderQuadrant(CHILD_QUADRANTS.Q8, true)}
                                {renderQuadrant(CHILD_QUADRANTS.Q7, true)}
                            </div>
                        </div>

                        {/* Lower Teeth (Adult) */}
                        <div className="flex justify-center gap-0.5 sm:gap-1">
                            {renderQuadrant(ADULT_QUADRANTS.Q4)}
                            {renderQuadrant(ADULT_QUADRANTS.Q3)}
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 7, 8, 9 MINI PREVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8 pt-8 border-t">
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">7 INDICADORES</h4>
                  <div className="text-[10px] p-4 bg-muted/50 rounded-xl border border-dashed text-slate-500 italic">
                     Los indicadores de salud bucal se calculan automáticamente basado en el historial clínico.
                  </div>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">8 ÍNDICES CPO-ceo</h4>
                  {(() => {
                     const indices = calculateCPOceo(teethState);
                     return (
                        <div className="grid grid-cols-5 gap-1.5 text-center text-[10px] items-center">
                           <div className="font-extrabold text-slate-400 text-left">TIPO</div>
                           {['C/c', 'P/e', 'O/o', 'TOTAL'].map(h => <div key={h} className="font-bold text-slate-400">{h}</div>)}
                           
                           <div className="font-bold text-slate-500 text-left">CPO (D)</div>
                           <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded font-bold">{indices.C}</div>
                           <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded font-bold">{indices.P}</div>
                           <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded font-bold">{indices.O}</div>
                           <div className="bg-blue-600 text-white p-1.5 rounded font-extrabold">{indices.totalCPO}</div>

                           <div className="font-bold text-slate-500 text-left">ceo (d)</div>
                           <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded font-bold">{indices.c}</div>
                           <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded font-bold">{indices.e}</div>
                           <div className="bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded font-bold">{indices.o}</div>
                           <div className="bg-teal-600 text-white p-1.5 rounded font-extrabold">{indices.totalceo}</div>
                        </div>
                     );
                  })()}
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">9 SIMBOLOGÍA</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-bold text-slate-500">
                     <div className="flex items-center gap-2"><div className="w-2 h-2 border border-red-500" /> Sellante Necesario</div>
                     <div className="flex items-center gap-2 font-black text-red-500">X Extracción Indicada</div>
                     <div className="flex items-center gap-2 text-blue-600"><div className="w-2 h-2 border-2 border-blue-600 p-0.5"><div className="w-full h-full bg-blue-100" /></div> Sellante Realizado</div>
                     <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-full" /> Caries</div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}

