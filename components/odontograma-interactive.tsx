"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, X, FileText, MousePointer2, Info, ChevronRight, Check, Save, RotateCcw, Trash2, AlertCircle } from 'lucide-react';
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// --- CONFIGURACIÓN Y COLORES (MSP SNS / HCU-033) ---
const MODES = {
  PATHOLOGY: { id: 'pathology', label: 'Patología', color: '#ef4444' }, // Red (Rojo)
  TREATMENT: { id: 'treatment', label: 'Realizado', color: '#2563eb' }  // Blue (Azul)
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
    ? '#8b5cf6' 
    : (data?.status === 'completed' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color);
  
  const isLoss = condition === 'loss_other';
  const isExtracted = condition === 'extraction';
  const isEndo = condition === 'endodontics';
  const isCrown = condition === 'crown';

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
          className="w-8 h-4 text-[9px] font-bold text-center border border-border outline-none focus:border-blue-500 bg-card rounded"
          placeholder="R"
          value={data?.recesion || ''}
          onChange={(e) => onApply(id, 'recesion', { id: 'meta' }, e.target.value as any)}
          title="Recesión gingival"
       />
       <input 
          className="w-8 h-4 text-[9px] font-bold text-center border border-border outline-none focus:border-blue-500 bg-card rounded"
          placeholder="M"
          value={data?.movilidad || ''}
          onChange={(e) => onApply(id, 'movilidad', { id: 'meta' }, e.target.value as any)}
          title="Movilidad dental"
       />
    </div>
  );

  return (
    <div className="flex flex-col items-center select-none">
      {isUpper && renderInputs()}
      
      <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 lg:w-10 lg:h-10 my-1 flex items-center justify-center">
        {isInsideFixedRange && (
          <div className="absolute inset-x-0 h-1 bg-red-500 top-1/2 -translate-y-1/2 z-0 opacity-80" />
        )}
        {isInsideRemovibleRange && (
          <div className="absolute inset-x-0 h-1.5 border-y border-dashed border-purple-500 top-1/2 -translate-y-1/2 z-0" />
        )}

        <svg viewBox="0 0 100 100" className="w-full h-full z-10 drop-shadow-sm">
          <polygon 
            points="10,10 90,10 70,30 30,30" 
            fill={getSurfaceFill('top')}
            stroke={getSurfaceStroke('top')}
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-colors"
            onClick={() => handleApply('top')}
          />
          <polygon 
            points="90,10 90,90 70,70 70,30" 
            fill={getSurfaceFill('right')}
            stroke={getSurfaceStroke('right')}
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-colors"
            onClick={() => handleApply('right')}
          />
          <polygon 
            points="10,90 90,90 70,70 30,70" 
            fill={getSurfaceFill('bottom')}
            stroke={getSurfaceStroke('bottom')}
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-colors"
            onClick={() => handleApply('bottom')}
          />
          <polygon 
            points="10,10 10,90 30,70 30,30" 
            fill={getSurfaceFill('left')}
            stroke={getSurfaceStroke('left')}
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-colors"
            onClick={() => handleApply('left')}
          />
          <rect 
            x="30" y="30" width="40" height="40" 
            fill={getSurfaceFill('center')}
            stroke={getSurfaceStroke('center')}
            strokeWidth="2"
            className="cursor-pointer hover:opacity-80 transition-colors"
            onClick={() => handleApply('center')}
          />

          {isExtracted && (
            <g stroke={statusColor} strokeWidth="6" strokeLinecap="round">
              <line x1="15" y1="15" x2="85" y2="85" />
              <line x1="85" y1="15" x2="15" y2="85" />
            </g>
          )}

          {isLoss && (
            <rect x="25" y="10" width="50" height="80" fill="none" stroke={statusColor} strokeWidth="4" />
          )}

          {isEndo && (
            <polygon points="50,15 85,85 15,85" fill="none" stroke={statusColor} strokeWidth="4" />
          )}

          {isCrown && (
            <circle cx="50" cy="50" r="38" fill={statusColor} opacity="0.85" />
          )}
        </svg>
      </div>

      <span className="text-[10px] font-black text-muted-foreground font-mono mt-0.5">{id}</span>
      {!isUpper && renderInputs()}
    </div>
  );
};

export const calculateCPOceo = (teethState: Record<string, any>) => {
  let C = 0, P = 0, O = 0;
  let c = 0, e = 0, o = 0;

  const adultTeeth = Object.values(ADULT_QUADRANTS).flat();
  const childTeeth = Object.values(CHILD_QUADRANTS).flat();

  adultTeeth.forEach(id => {
    const t = teethState[id];
    if (!t) return;
    const hasCaries = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:red'));
    const isPerdido = t.condition === 'extraction' || t.condition === 'loss_other';
    const isObturado = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:blue')) || t.condition === 'crown';

    if (hasCaries) C++;
    else if (isPerdido) P++;
    else if (isObturado) O++;
  });

  childTeeth.forEach(id => {
    const t = teethState[id];
    if (!t) return;
    const hasCaries = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:red'));
    const isExtraccion = t.condition === 'extraction';
    const isObturado = Object.values(t.surfaces || {}).some((v: any) => v && v.startsWith('caries:blue')) || t.condition === 'crown';

    if (hasCaries) c++;
    else if (isExtraccion) e++;
    else if (isObturado) o++;
  });

  return {
    C, P, O, totalCPO: C + P + O,
    c, e, o, totalceo: c + e + o
  };
};

export function OdontogramaInteractive({ data = {}, onChange, patientName = "Paciente", patientId = "", readOnly = false, stickyOffset = 0, onSave }: any) {
  const [teethState, setTeethState] = useState<Record<string, any>>(() => ({ ...generateInitialState(), ...data }));
  const [history, setHistory] = useState<Record<string, any>[]>([]);
  const [activeTool, setActiveTool] = useState<any>(TOOLS.SELECT);
  const [activeMode, setActiveMode] = useState<'red' | 'blue'>('red');
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (readOnly) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || (e.target as HTMLElement).isContentEditable) {
        return;
      }

      const key = e.key;
      const code = e.code;

      if (key.toLowerCase() === 'p' || key === '*' || key === '-' || code === 'NumpadSubtract' || code === 'NumpadMultiply') {
        setActiveMode('red');
        e.preventDefault();
      } else if (key.toLowerCase() === 'r' || key === '+' || key === 'Enter' || code === 'NumpadAdd' || code === 'NumpadEnter') {
        setActiveMode('blue');
        e.preventDefault();
      }

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
    
    setHistory(prev => [...prev.slice(-15), teethState]);

    const newState = { ...teethState };
    const tooth = { ...(newState[toothId] || { id: toothId, surfaces: {}, condition: null, status: null, recesion: '', movilidad: '' }) };
    tooth.surfaces = { ...tooth.surfaces };
    
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

    for (const seq of Object.values(ARCH_SEQUENCES)) {
        if (seq.includes(rangeStart) && seq.includes(endId)) {
            selectedArchSequence = seq;
            break;
        }
    }

    if (selectedArchSequence) {
        setHistory(prev => [...prev.slice(-15), teethState]);
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

  const handleUndo = () => {
    if (history.length === 0) return;
    const previous = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setTeethState(previous);
    onChange?.(previous);
  };

  const handleClearAll = () => {
    setHistory(prev => [...prev.slice(-15), teethState]);
    const cleanState = generateInitialState();
    setTeethState(cleanState);
    onChange?.(cleanState);
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
    <div className="bg-card rounded-2xl shadow-xl border flex flex-col w-full overflow-hidden">
      <div 
         className="bg-card/95 backdrop-blur border-b p-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 transition-all shadow-sm"
      >
         <div className="flex items-center gap-4 flex-wrap">
            <div className="space-y-1">
               <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Diagnóstico / Estado</span>
               <div className="flex bg-muted rounded-lg p-0.5 border shadow-inner">
                  <button 
                    onClick={() => setActiveMode('red')}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5", 
                      activeMode === 'red' ? "bg-red-500 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", activeMode === 'red' ? "bg-white" : "bg-red-500")} />
                    PATOLOGÍA (Rojo)
                  </button>
                  <button 
                    onClick={() => setActiveMode('blue')}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1.5", 
                      activeMode === 'blue' ? "bg-blue-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", activeMode === 'blue' ? "bg-white" : "bg-blue-600")} />
                    REALIZADO (Azul)
                  </button>
               </div>
            </div>
 
            <div className="space-y-1">
               <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground block">Herramientas Normadas MSP</span>
               <div className="flex gap-1 flex-wrap items-center">
                  <button
                     onClick={() => { setActiveTool(TOOLS.SELECT); setRangeStart(null); }}
                     className={cn(
                         "px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase transition-all whitespace-nowrap flex items-center gap-1",
                         activeTool.id === TOOLS.SELECT.id ? "bg-foreground text-background border-foreground shadow" : "bg-card text-muted-foreground hover:border-border"
                     )}
                     title="Seleccionar / Ver"
                  >
                     <MousePointer2 className="h-3 w-3" />
                     {TOOLS.SELECT.label}
                  </button>

                  {[TOOLS.CARIES, TOOLS.SEALANT, TOOLS.EXTRACTION, TOOLS.CROWN, TOOLS.ENDODONTICS, TOOLS.LOSS_OTHER, TOOLS.PROSTHESIS_FIXED, TOOLS.PROSTHESIS_REMOVABLE].map(tool => (
                     <button
                        key={tool.id}
                        onClick={() => { setActiveTool(tool); setRangeStart(null); }}
                        className={cn(
                            "px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase transition-all whitespace-nowrap flex items-center gap-1",
                            activeTool.id === tool.id ? "bg-primary text-primary-foreground border-primary shadow" : "bg-card text-muted-foreground hover:border-primary/40"
                        )}
                     >
                        {tool.label}
                        <span className="text-[9px] font-mono opacity-60 ml-0.5">({tool.hotkey})</span>
                      </button>
                  ))}
                  
                  <button 
                     onClick={() => { setActiveTool(TOOLS.ERASER); setRangeStart(null); }} 
                     className={cn(
                       "p-1 px-2 rounded-lg border flex items-center gap-1 text-[11px] font-bold transition-all", 
                       activeTool.id === 'eraser' ? "bg-red-500 text-white border-red-500 shadow-sm" : "bg-card text-red-600 border-red-200 hover:bg-red-50"
                     )}
                     title="Borrador dental [0 / Del]"
                  >
                     <Eraser className="h-3 w-3" />
                     Borrar
                  </button>
               </div>
            </div>
         </div>

         <div className="flex items-center gap-2 flex-shrink-0">
            <button
               onClick={handleUndo}
               disabled={history.length === 0}
               className={cn(
                 "p-1.5 px-2.5 rounded-lg border flex items-center gap-1 text-xs font-bold transition-all",
                 history.length > 0 ? "bg-card text-foreground hover:bg-muted" : "opacity-40 cursor-not-allowed bg-muted text-muted-foreground"
               )}
               title="Deshacer último cambio"
            >
               <RotateCcw className="h-3.5 w-3.5" />
               <span className="hidden sm:inline">Deshacer</span>
            </button>

            <Dialog>
               <DialogTrigger asChild>
                  <button
                     className="p-1.5 px-2.5 rounded-lg border border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 flex items-center gap-1 text-xs font-bold transition-all"
                     title="Limpiar todos los símbolos del odontograma"
                  >
                     <Trash2 className="h-3.5 w-3.5" />
                     <span className="hidden sm:inline">Limpiar Todo</span>
                  </button>
               </DialogTrigger>
               <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                     <DialogTitle className="flex items-center gap-2 text-rose-600">
                        <AlertCircle className="h-5 w-5" />
                        ¿Limpiar todo el odontograma?
                     </DialogTitle>
                     <DialogDescription>
                        Esta acción borrará todas las anotaciones, caries, prótesis y piezas dentales marcadas para este paciente. Podrás deshacerlo con el botón "Deshacer" si lo requieres.
                     </DialogDescription>
                  </DialogHeader>
                  <DialogFooter className="gap-2 sm:gap-0">
                     <DialogClose asChild>
                        <Button variant="outline" size="sm">Cancelar</Button>
                     </DialogClose>
                     <DialogClose asChild>
                        <Button size="sm" onClick={handleClearAll} className="bg-rose-600 hover:bg-rose-700 text-white font-bold">
                           Sí, Limpiar Odontograma
                        </Button>
                     </DialogClose>
                  </DialogFooter>
               </DialogContent>
            </Dialog>

            {onSave && (
               <button
                  onClick={onSave}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md hover:shadow-lg transition-all"
                  title="Guardar odontograma"
               >
                  <Save className="h-3.5 w-3.5" />
                  GUARDAR
               </button>
            )}
         </div>

         {rangeStart && (
             <div className="w-full bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl flex items-center justify-between text-xs font-bold text-amber-800 animate-in fade-in duration-200">
                <div className="flex items-center gap-2">
                   <Info className="h-4 w-4 text-amber-600 animate-pulse" />
                   <span>Pieza #{rangeStart} seleccionada. Ahora haga clic en la pieza final para {activeTool.label}.</span>
                </div>
                <button onClick={() => setRangeStart(null)} className="text-[10px] uppercase font-black underline hover:text-amber-950">Cancelar</button>
             </div>
         )}
      </div>

      <div className="flex-1 p-4 md:p-6 bg-muted/20">
         <div className="mx-auto max-w-5xl flex flex-col gap-6 bg-card p-4 sm:p-6 md:p-8 rounded-2xl shadow-sm border">
            
            <div className="flex justify-between items-start border-b pb-4">
                <div>
                    <h2 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                       <span>6 ODONTOGRAMA</span>
                       <Badge variant="outline" className="text-[10px] font-mono py-0 border-blue-200 text-blue-700 bg-blue-50">
                          SNS-MSP / HCU-form.033 / 2008
                       </Badge>
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium mt-1">
                        Pintar con: <span className="text-blue-600 font-bold">AZUL PARA TRATAMIENTO REALIZADO</span> • <span className="text-red-500 font-bold">ROJO PARA PATOLOGÍA ACTUAL</span>
                    </p>
                </div>
                <div className="text-right">
                    <Badge variant="secondary" className="text-[11px] font-mono py-0.5">{patientName}</Badge>
                </div>
            </div>

            <div className="flex-1 min-w-0 w-full bg-card p-4 rounded-xl border shadow-inner overflow-x-auto custom-scrollbar">
                <div className="grid grid-cols-[60px_1fr] sm:grid-cols-[90px_1fr] gap-2 sm:gap-4 items-center">
                    <div className="flex flex-col justify-around py-8 text-[9px] font-bold text-muted-foreground uppercase tracking-tight text-center">
                        <div className="h-10 flex flex-col justify-center">Recesión<br/>Movilidad</div>
                        <div className="h-10 flex items-center justify-center">Vestibular</div>
                        <div className="h-10 flex items-center justify-center">Palatino</div>
                        <div className="h-8 flex items-center justify-center">Lingual</div>
                        <div className="h-10 flex items-center justify-center">Vestibular</div>
                        <div className="h-10 flex flex-col justify-center">Movilidad<br/>Recesión</div>
                    </div>

                    <div className="space-y-6">
                        <div className="flex justify-center gap-0.5 sm:gap-1">
                            {renderQuadrant(ADULT_QUADRANTS.Q1)}
                            <div className="w-px bg-border/80 mx-1 self-stretch" />
                            {renderQuadrant(ADULT_QUADRANTS.Q2)}
                        </div>

                        <div className="flex flex-col gap-2 items-center bg-muted/20 py-3 px-2 rounded-xl border border-dashed">
                            <div className="flex gap-0.5 sm:gap-1">
                                {renderQuadrant(CHILD_QUADRANTS.Q5, true)}
                                <div className="w-px bg-border/80 mx-1 self-stretch" />
                                {renderQuadrant(CHILD_QUADRANTS.Q6, true)}
                            </div>
                            <div className="flex gap-0.5 sm:gap-1">
                                {renderQuadrant(CHILD_QUADRANTS.Q7, true)}
                                <div className="w-px bg-border/80 mx-1 self-stretch" />
                                {renderQuadrant(CHILD_QUADRANTS.Q8, true)}
                            </div>
                        </div>

                        <div className="flex justify-center gap-0.5 sm:gap-1">
                            {renderQuadrant(ADULT_QUADRANTS.Q3)}
                            <div className="w-px bg-border/80 mx-1 self-stretch" />
                            {renderQuadrant(ADULT_QUADRANTS.Q4)}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t">
               <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">7. Indicadores de Salud Bucal</h4>
                  <div className="text-[11px] p-3 bg-muted/40 rounded-xl border text-muted-foreground leading-relaxed">
                     Registrados en el Formulario 033 oficial: Higiene Oral Simplificada (Placa, Cálculo, Gingivitis), Enfermedad Periodontal, Maloclusión y Fluorosis.
                  </div>
               </div>

               <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">8. Índices CPO-ceo (Automático)</h4>
                  {(() => {
                     const indices = calculateCPOceo(teethState);
                     return (
                        <div className="grid grid-cols-5 gap-1 text-center text-[10px] items-center bg-muted/20 p-2.5 rounded-xl border">
                           <div className="font-extrabold text-muted-foreground text-left">DENT.</div>
                           <div className="font-bold text-muted-foreground">C/c</div>
                           <div className="font-bold text-muted-foreground">P/e</div>
                           <div className="font-bold text-muted-foreground">O/o</div>
                           <div className="font-extrabold text-foreground">TOTAL</div>
                           
                           <div className="font-bold text-foreground text-left">CPO (D)</div>
                           <div className="bg-card p-1 rounded font-bold border">{indices.C}</div>
                           <div className="bg-card p-1 rounded font-bold border">{indices.P}</div>
                           <div className="bg-card p-1 rounded font-bold border">{indices.O}</div>
                           <div className="bg-blue-600 text-white p-1 rounded font-extrabold">{indices.totalCPO}</div>

                           <div className="font-bold text-foreground text-left">ceo (d)</div>
                           <div className="bg-card p-1 rounded font-bold border">{indices.c}</div>
                           <div className="bg-card p-1 rounded font-bold border">{indices.e}</div>
                           <div className="bg-card p-1 rounded font-bold border">{indices.o}</div>
                           <div className="bg-teal-600 text-white p-1 rounded font-extrabold">{indices.totalceo}</div>
                        </div>
                     );
                  })()}
               </div>

               <div className="space-y-2">
                  <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">9. Simbología Normativa MSP</h4>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-medium text-muted-foreground bg-muted/20 p-2.5 rounded-xl border">
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border border-red-500 bg-red-50" /> Sellante Necesario</div>
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border border-blue-600 bg-blue-50" /> Sellante Realizado</div>
                     <div className="flex items-center gap-1.5 text-red-600 font-bold">✕ Extracción Indicada</div>
                     <div className="flex items-center gap-1.5 text-blue-600 font-bold">✕ Pérdida por Caries</div>
                     <div className="flex items-center gap-1.5"><div className="w-2 h-3 border-2 border-red-500" /> Pérdida Otra Causa</div>
                     <div className="flex items-center gap-1.5"><span className="text-red-500 font-bold">△</span> Endodoncia</div>
                     <div className="flex items-center gap-1.5"><span className="text-red-500 font-bold">□--□</span> Prótesis Fija</div>
                     <div className="flex items-center gap-1.5"><span className="text-purple-600 font-bold">(---)</span> P. Removible</div>
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 bg-red-500 rounded-full" /> Corona</div>
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-blue-600 rounded-full" /> Obturado</div>
                     <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 border-2 border-red-500 rounded-full" /> Caries</div>
                     <div className="flex items-center gap-1.5 text-red-500 font-bold">═ Prótesis Total</div>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
}
