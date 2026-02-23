"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, X, FileText, MousePointer2, Info, ChevronRight, Check } from 'lucide-react';
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
  const statusColor = data?.status === 'completed' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color;
  
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
          className="w-8 h-4 text-[9px] font-bold text-center border border-slate-200 outline-none focus:border-blue-500 bg-white"
          placeholder="R"
          value={data?.recesion || ''}
          onChange={(e) => onApply(id, 'recesion', { id: 'meta' }, e.target.value as any)}
       />
       <input 
          className="w-8 h-4 text-[9px] font-bold text-center border border-slate-200 outline-none focus:border-blue-500 bg-white"
          placeholder="M"
          value={data?.movilidad || ''}
          onChange={(e) => onApply(id, 'movilidad', { id: 'meta' }, e.target.value as any)}
       />
    </div>
  );

  return (
    <div className="flex flex-col items-center select-none">
      {isUpper && renderInputs()}
      
      <div className="relative w-8 h-8 md:w-11 md:h-11 my-1 flex items-center justify-center">
        {isInsideFixedRange && (
            <div className="absolute top-1/2 left-0 right-0 border-t-2 border-dashed h-0 z-10" style={{ borderColor: statusColor }} />
        )}
        {isFixedEndpoint && (
            <div className="absolute inset-x-0 inset-y-0 border-2 z-20 pointer-events-none" style={{ borderColor: statusColor }} />
        )}
        {isInsideRemovibleRange && (
            <div className="absolute top-[60%] left-0 right-0 h-1 border-t-2 border-black/40 border-dotted z-10" />
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

export function OdontogramaInteractive({ data = {}, onChange, patientName = "Paciente", patientId = "", readOnly = false }: any) {
  const [teethState, setTeethState] = useState<Record<string, any>>(() => ({ ...generateInitialState(), ...data }));
  const [activeTool, setActiveTool] = useState<any>(TOOLS.SELECT);
  const [activeMode, setActiveMode] = useState<'red' | 'blue'>('red');
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setTeethState(prev => ({ ...prev, ...data }));
    }
  }, [data]);

  const applyTreatment = useCallback((toothId: number, zone: string, tool: any, mode: any) => {
    if (readOnly) return;
    setTeethState(prev => {
        const newState = { ...prev };
        const tooth = newState[toothId] || { id: toothId, surfaces: {}, condition: null, status: null, recesion: '', movilidad: '' };
        
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
        onChange?.(newState);
        return newState;
    });
  }, [onChange, readOnly]);

  const handleRange = (endId: number) => {
    if (!rangeStart) {
        setRangeStart(endId);
        return;
    }
    
    // Apply range logic
    setTeethState(prev => {
        const newState = { ...prev };
        const start = Math.min(rangeStart, endId);
        const end = Math.max(rangeStart, endId);
        
        // Find all teeth in between
        Object.keys(newState).forEach(idKey => {
            const id = parseInt(idKey);
            if (id >= start && id <= end) {
                const tooth = newState[id];
                if (activeTool.id === 'fixed' && (id === start || id === end)) {
                    tooth.condition = 'crown';
                    tooth.status = activeMode === 'blue' ? 'completed' : 'planned';
                }
                tooth.bridge = { type: activeTool.id, start, end, status: activeMode === 'blue' ? 'completed' : 'planned' };
            }
        });
        
        onChange?.(newState);
        return newState;
    });
    setRangeStart(null);
  };

  const renderQuadrant = (ids: number[], isChild = false) => (
    <div className="flex gap-1">
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
    <div className="bg-white rounded-xl shadow-2xl border overflow-hidden flex flex-col h-full min-h-[700px]">
      {/* TOOLBAR */}
      <div className="bg-slate-50 border-b p-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50">
         <div className="flex items-center gap-6">
            <div className="space-y-1">
               <h3 className="text-xs font-black uppercase tracking-tighter text-slate-400">Estado Clínico</h3>
               <div className="flex bg-white rounded-lg p-1 border shadow-sm">
                  <button 
                    onClick={() => setActiveMode('red')}
                    className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeMode === 'red' ? "bg-red-500 text-white shadow-lg shadow-red-200" : "text-slate-500")}
                  >
                    <div className={cn("w-2 h-2 rounded-full", activeMode === 'red' ? "bg-white" : "bg-red-500")} />
                    PATOLOGÍA
                  </button>
                  <button 
                    onClick={() => setActiveMode('blue')}
                    className={cn("px-4 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-2", activeMode === 'blue' ? "bg-blue-600 text-white shadow-lg shadow-blue-200" : "text-slate-500")}
                  >
                    <div className={cn("w-2 h-2 rounded-full", activeMode === 'blue' ? "bg-white" : "bg-blue-600")} />
                    REALIZADO
                  </button>
               </div>
            </div>

            <div className="space-y-1">
               <h3 className="text-xs font-black uppercase tracking-tighter text-slate-400">Herramientas</h3>
               <div className="flex gap-1.5">
                  {[TOOLS.CARIES, TOOLS.SEALANT, TOOLS.EXTRACTION, TOOLS.CROWN, TOOLS.ENDODONTICS, TOOLS.LOSS_OTHER, TOOLS.PROSTHESIS_FIXED, TOOLS.PROSTHESIS_REMOVABLE].map(tool => (
                     <button
                        key={tool.id}
                        onClick={() => { setActiveTool(tool); setRangeStart(null); }}
                        className={cn(
                            "px-3 py-1.5 rounded-lg border text-[10px] font-black uppercase transition-all whitespace-nowrap",
                            activeTool.id === tool.id ? "bg-slate-900 text-white border-slate-900 shadow-lg" : "bg-white text-slate-600 hover:border-slate-400"
                        )}
                     >
                        {tool.label}
                     </button>
                  ))}
                  <button onClick={() => setActiveTool(TOOLS.ERASER)} className={cn("p-2 rounded-lg border", activeTool.id === 'eraser' ? "bg-red-100 border-red-200 text-red-600" : "bg-white")}><Eraser size={14} /></button>
               </div>
            </div>
         </div>

         {rangeStart && (
             <div className="bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center gap-3 animate-pulse">
                <Info size={16} className="text-amber-600" />
                <p className="text-xs font-bold text-amber-700">Seleccione la pieza final para {activeTool.label}</p>
                <button onClick={() => setRangeStart(null)} className="text-[10px] uppercase font-black text-amber-900 underline">Cancelar</button>
             </div>
         )}
      </div>

      {/* CANVAS */}
      <div className="flex-1 p-8 bg-slate-50/30 overflow-auto scrollbar-hide">
         <div className="mx-auto max-w-5xl flex flex-col gap-12 bg-white p-12 rounded-[2rem] shadow-inner border border-slate-100">
            
            {/* Legend/Header */}
            <div className="flex justify-between items-start border-b pb-6">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">6 ODONTOGRAMA</h2>
                    <p className="text-[11px] text-slate-400 font-medium max-w-sm mt-1">
                        PINTAR CON: <span className="text-blue-600 font-bold">AZUL PARA TRATAMIENTO REALIZADO</span> - <span className="text-red-500 font-bold">ROJO PARA PATOLOGÍA ACTUAL</span>
                    </p>
                </div>
                <div className="text-right">
                    <Badge variant="outline" className="text-[10px] font-mono py-0">{patientId || 'PACIENTE'}</Badge>
                </div>
            </div>

            {/* Odontogram Grid with Labels */}
            <div className="flex-1 min-w-[800px] bg-white p-6 rounded-2xl border shadow-sm overflow-x-auto">
                <div className="grid grid-cols-[100px_1fr] gap-4">
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
                        <div className="flex justify-center gap-1">
                            {renderQuadrant(ADULT_QUADRANTS.Q1)}
                            {renderQuadrant(ADULT_QUADRANTS.Q2)}
                        </div>

                        {/* Middle Row (Deciduous) */}
                        <div className="flex flex-col gap-4 items-center">
                            <div className="flex gap-1">
                                {renderQuadrant(CHILD_QUADRANTS.Q5, true)}
                                {renderQuadrant(CHILD_QUADRANTS.Q6, true)}
                            </div>
                            <div className="flex gap-1">
                                {renderQuadrant(CHILD_QUADRANTS.Q8, true)}
                                {renderQuadrant(CHILD_QUADRANTS.Q7, true)}
                            </div>
                        </div>

                        {/* Lower Teeth (Adult) */}
                        <div className="flex justify-center gap-1">
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
                  <div className="text-[10px] p-4 bg-slate-50 rounded-xl border border-dashed text-slate-500 italic">
                     Los indicadores de salud bucal se calculan automáticamente basado en el historial clínico.
                  </div>
               </div>
               <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">8 ÍNDICES CPO-ceo</h4>
                  <div className="grid grid-cols-4 gap-2">
                     {['C', 'P', 'O', 'TOTAL'].map(h => <div key={h} className="text-center font-bold text-[9px] text-slate-400">{h}</div>)}
                     <div className="bg-slate-100 p-2 text-center rounded">0</div>
                     <div className="bg-slate-100 p-2 text-center rounded">0</div>
                     <div className="bg-slate-100 p-2 text-center rounded">0</div>
                     <div className="bg-blue-600 text-white p-2 text-center rounded font-bold">0</div>
                  </div>
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

