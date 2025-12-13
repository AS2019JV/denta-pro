"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, X, FileText } from 'lucide-react';

// --- CONFIGURACIÓN Y COLORES ---
// Paleta profesional ajustada para UI clínica estilo Google Material
const BRAND = {
  primary: '#145247',    // Deep Teal
  secondary: '#FAA805',  // Golden Orange
  tertiary: '#A3D900',   // Saturated Lime Green (Mejorado)
  quaternary: '#FDFBF7', // Off-white cálido para el papel
  surface: '#FFFFFF',    // Blanco puro
  text: '#1F2937',       // Gris muy oscuro
  muted: '#6B7280',      // Gris medio
};

// Definición de Herramientas
const TOOLS = {
  SELECT: { id: 'select', label: 'Cursor', icon: 'cursor', cursor: 'default' },
  ERASER: { id: 'eraser', label: 'Borrar', icon: 'eraser', cursor: 'not-allowed' },
  CARIES: { id: 'caries', label: 'Caries', paintColor: '#ef4444', type: 'surface', hotkey: '1' },
  RESTORATION: { id: 'restoration', label: 'Restauración', paintColor: '#3b82f6', type: 'surface', hotkey: '2' },
  SEALANT: { id: 'sealant', label: 'Sellante', paintColor: BRAND.tertiary, type: 'surface', hotkey: '3' },
  EXTRACTION: { id: 'extraction', label: 'Extracción', paintColor: '#dc2626', type: 'whole', hotkey: '4' },
  CROWN: { id: 'crown', label: 'Corona', paintColor: BRAND.secondary, type: 'whole', hotkey: '5' },
};

// Cuadrantes
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
      condition: null
    };
  });
  return state;
};

// --- COMPONENTES UI ---

// Diente individual
interface ToothProps {
  id: number;
  data: any;
  currentTool: any;
  onApply: (id: number, zone: string, tool: any) => void;
}

const Tooth = ({ id, data, currentTool, onApply }: ToothProps) => {
  const isCrown = data?.condition === 'crown';
  const isExtracted = data?.condition === 'extraction';

  const handleSurfaceClick = (surfaceKey: string) => onApply(id, surfaceKey, currentTool);
  
  const handleWholeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (['whole', 'select', 'eraser'].includes(currentTool.type || '') || currentTool.id === 'select' || currentTool.id === 'eraser') {
      onApply(id, 'whole', currentTool);
    } else {
      onApply(id, 'center', currentTool);
    }
  };

  const getFill = (surface: string) => {
    const status = data?.surfaces?.[surface];
    if (status === 'caries') return TOOLS.CARIES.paintColor;
    if (status === 'restoration') return TOOLS.RESTORATION.paintColor;
    if (status === 'sealant') return TOOLS.SEALANT.paintColor;
    return '#FFFFFF';
  };

  return (
    <div className="flex flex-col items-center mx-[2px] mb-2 group relative">
      <span className="text-[10px] font-bold text-slate-400 mb-0.5 group-hover:text-teal-700 transition-colors">{id}</span>
      <div className="relative w-9 h-9 md:w-11 md:h-11 cursor-pointer transition-transform hover:scale-105">
        
        {/* Crown Indicator */}
        {isCrown && (
          <div className="absolute inset-0 rounded-full border-[3px] z-20 pointer-events-none"
               style={{ borderColor: BRAND.secondary }}></div>
        )}
        
        {/* Extraction Indicator (Increased Size & Boldness) */}
        {isExtracted && (
          <div className="absolute -inset-1 z-30 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-200">
            <X 
                className="w-full h-full text-red-600 drop-shadow-sm" 
                strokeWidth={3.5} 
            />
          </div>
        )}

        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
          <polygon points="0,0 100,0 70,30 30,30" fill={getFill('top')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('top')} className="hover:opacity-80 transition-opacity" />
          <polygon points="30,70 70,70 100,100 0,100" fill={getFill('bottom')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('bottom')} className="hover:opacity-80 transition-opacity" />
          <polygon points="0,0 30,30 30,70 0,100" fill={getFill('left')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('left')} className="hover:opacity-80 transition-opacity" />
          <polygon points="100,0 100,100 70,70 70,30" fill={getFill('right')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('right')} className="hover:opacity-80 transition-opacity" />
          <rect x="30" y="30" width="40" height="40" fill={getFill('center')} stroke="#94a3b8" strokeWidth="1" onClick={handleWholeClick} className="hover:opacity-80 transition-opacity" />
        </svg>
      </div>
    </div>
  );
};

// --- COMPONENTE PRINCIPAL ---

interface OdontogramaInteractiveProps {
  data: any;
  onChange: (data: any) => void;
  patientName?: string;
  patientId?: string;
}

export function OdontogramaInteractive({ data = {}, onChange, patientName = "Paciente", patientId = "" }: OdontogramaInteractiveProps) {
  // Initialize state with props.data merged into default structure
  
  const [teethState, setTeethState] = useState<Record<string, any>>(() => {
     const initial = generateInitialState();
     // If data has keys, merge them
     if (data && Object.keys(data).length > 0) {
        return { ...initial, ...data };
     }
     return initial;
  });

  // Sync from props if data changes externally
  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setTeethState(prev => ({ ...prev, ...data }));
    }
  }, [data]);

  const [activeTool, setActiveTool] = useState(TOOLS.SELECT);
  const [viewMode, setViewMode] = useState('mixed'); // 'adult' | 'child' | 'mixed'

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in inputs
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      
      switch(e.key) {
        case '1': setActiveTool(TOOLS.CARIES); break;
        case '2': setActiveTool(TOOLS.RESTORATION); break;
        case '3': setActiveTool(TOOLS.SEALANT); break;
        case '4': setActiveTool(TOOLS.EXTRACTION); break;
        case '5': setActiveTool(TOOLS.CROWN); break;
        case 'Escape': setActiveTool(TOOLS.SELECT); break;
        case 'Delete': setActiveTool(TOOLS.ERASER); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const applyTreatment = useCallback((toothId: number, zone: string, tool: any) => {
    setTeethState(prev => {
      const newState = { ...prev };
      const tooth = { ...(newState[toothId] || { id: toothId, surfaces: {}, condition: null }) };
      
      // Ensure surfaces object exists
      if (!tooth.surfaces) {
          tooth.surfaces = { top: null, bottom: null, left: null, right: null, center: null };
      }

      if (tool.id === 'select') return prev;
      
      if (tool.id === 'eraser') {
        if (zone === 'whole') {
            tooth.condition = null;
            tooth.surfaces = { top: null, bottom: null, left: null, right: null, center: null };
        } else {
            tooth.surfaces = { ...tooth.surfaces, [zone]: null };
        }
      } else if (tool.type === 'whole') {
        tooth.condition = tooth.condition === tool.id ? null : tool.id;
      } else {
        const current = tooth.surfaces[zone];
        tooth.surfaces = { ...tooth.surfaces, [zone]: current === tool.id ? null : tool.id };
      }
      newState[toothId] = tooth;
      
      // Propagate changes to parent
      onChange?.(newState);
      
      return newState;
    });
  }, [onChange]);

  const renderRow = (ids: number[]) => (
    <div className="flex gap-1 justify-center">
      {ids.map(id => (
        <Tooth key={id} id={id} data={teethState[id]} currentTool={activeTool} onApply={applyTreatment} />
      ))}
    </div>
  );

  return (
    <div className="h-[800px] flex flex-col bg-slate-50 font-sans text-slate-800 overflow-hidden relative selection:bg-teal-100 rounded-xl border border-slate-200 shadow-sm">
      
      {/* 1. APP BAR - Minimalista Google Style */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 h-16 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="bg-teal-50 p-2 rounded-xl text-[#145247]">
            <FileText size={22} strokeWidth={2} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">Odontograma</h1>
            <div className="flex items-center gap-2 text-xs text-slate-500">
                {patientId && <span className="font-medium">HC: {patientId.slice(0, 8).toUpperCase()}</span>}
                {patientId && <span>•</span>}
                <span>{patientName}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
           {/* View Tabs - Pill Style */}
           <div className="bg-slate-100 p-1 rounded-full flex gap-1 mr-4 border border-slate-200">
              {['adult', 'mixed', 'child'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all ${
                    viewMode === mode 
                      ? 'bg-white text-[#145247] shadow-sm ring-1 ring-slate-200' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {mode === 'adult' ? 'Adulto' : mode === 'child' ? 'Niño' : 'Mixto'}
                </button>
              ))}
           </div>

           <button 
             onClick={() => {
                 const newState = generateInitialState();
                 setTeethState(newState);
                 onChange?.(newState);
             }} 
             className="p-2.5 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
             title="Limpiar"
           >
              <RefreshCw size={18} />
           </button>
        </div>
      </header>

      {/* 2. MAIN WORKSPACE */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden relative flex flex-col items-center pt-8 pb-32">
          
        {/* Paper Container */}
        <div 
            className="bg-[#FDFBF7] shadow-lg border border-slate-200/60 rounded-xl p-8 md:p-12 min-w-[800px] flex flex-col items-center justify-center relative select-none animate-in fade-in slide-in-from-bottom-4 duration-500"
        > 
            <div className="w-full flex justify-between px-8 mb-8 text-[10px] font-bold text-slate-300 uppercase tracking-[0.3em]">
                <span>Derecha</span>
                <span>Izquierda</span>
            </div>

            <div className="flex flex-col gap-10 relative z-10">
              {/* UPPER ARCH */}
              <div className="flex flex-col items-center gap-3">
                 {(viewMode === 'adult' || viewMode === 'mixed') && (
                    <div className="flex gap-12">
                        {renderRow(ADULT_QUADRANTS.Q1)}
                        {renderRow(ADULT_QUADRANTS.Q2)}
                    </div>
                 )}
                 {(viewMode === 'child' || viewMode === 'mixed') && (
                    <div className={`flex gap-12 ${viewMode === 'mixed' ? 'scale-90 opacity-95' : ''}`}>
                        {renderRow(CHILD_QUADRANTS.Q5)}
                        {renderRow(CHILD_QUADRANTS.Q6)}
                    </div>
                 )}
              </div>

              {/* CENTER DIVIDER */}
              {(viewMode === 'mixed') && <div className="w-full border-t border-dashed border-slate-200 my-2"></div>}

              {/* LOWER ARCH */}
              <div className="flex flex-col-reverse items-center gap-3">
                 {(viewMode === 'adult' || viewMode === 'mixed') && (
                    <div className="flex gap-12">
                        {renderRow(ADULT_QUADRANTS.Q3)}
                        {renderRow(ADULT_QUADRANTS.Q4)}
                    </div>
                 )}
                 {(viewMode === 'child' || viewMode === 'mixed') && (
                    <div className={`flex gap-12 ${viewMode === 'mixed' ? 'scale-90 opacity-95' : ''}`}>
                        {renderRow(CHILD_QUADRANTS.Q7)}
                        {renderRow(CHILD_QUADRANTS.Q8)}
                    </div>
                 )}
              </div>
            </div>
        </div>
      </main>

      {/* 3. FLOATING TOOLBAR - Google Material Dock Style */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-full px-4 w-auto flex flex-col items-center gap-3">
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl p-2 flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide ring-1 ring-slate-900/5">
            
            {/* Utility Tools */}
            <div className="flex items-center gap-1 pr-2 border-r border-slate-200 mr-1">
                <button
                    onClick={() => setActiveTool(TOOLS.SELECT)}
                    className={`p-3 rounded-xl transition-all ${activeTool.id === 'select' ? 'bg-slate-100 text-slate-800' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                    title="Seleccionar (Esc)"
                >
                   <div className="w-5 h-5 border-2 border-current rounded-md border-dashed" />
                </button>
                <button
                    onClick={() => setActiveTool(TOOLS.ERASER)}
                    className={`p-3 rounded-xl transition-all ${activeTool.id === 'eraser' ? 'bg-red-50 text-red-600' : 'text-slate-400 hover:text-red-500 hover:bg-slate-50'}`}
                    title="Borrar (Supr)"
                >
                   <Eraser size={20} />
                </button>
            </div>

            {/* Treatment Tools - Reordered as requested: Sellante, Corona, Extracción, Restauración, Caries */}
            {[TOOLS.SEALANT, TOOLS.CROWN, TOOLS.EXTRACTION, TOOLS.RESTORATION, TOOLS.CARIES].map((tool) => {
                const isActive = activeTool.id === tool.id;
                return (
                    <button
                        key={tool.id}
                        onClick={() => setActiveTool(tool)}
                        className={`
                            relative group flex items-center gap-2 px-3 py-2.5 rounded-xl transition-all whitespace-nowrap
                            ${isActive 
                                ? 'bg-[#145247] text-white shadow-md transform -translate-y-0.5' 
                                : 'text-slate-600 hover:bg-slate-100'
                            }
                        `}
                    >
                        {/* Color Indicator */}
                        <div 
                            className={`w-3 h-3 rounded-full shadow-sm ${isActive ? 'ring-2 ring-white/20' : ''}`}
                            style={{ backgroundColor: tool.paintColor }}
                        />
                        
                        <span className="text-xs font-bold tracking-wide hidden md:inline-block">
                            {tool.label}
                        </span>

                        {/* Mobile Label only shows if active to save space */}
                        <span className="text-xs font-bold tracking-wide md:hidden inline-block">
                            {isActive ? tool.label : ''}
                        </span>

                        {/* Hotkey Bubble */}
                        <span className={`
                            absolute -top-2 -right-1 text-[9px] font-mono px-1.5 py-0.5 rounded-md border font-bold shadow-sm
                            ${isActive ? 'bg-[#FAA805] text-[#145247] border-transparent' : 'bg-white text-slate-400 border-slate-200'}
                        `}>
                            {tool.hotkey}
                        </span>
                    </button>
                );
            })}
        </div>
        
        {/* Helper Tags */}
        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/80 border border-slate-200 shadow-sm backdrop-blur text-[10px] font-semibold text-slate-500">
                <span className="bg-slate-100 px-1 rounded border border-slate-200 text-slate-600">Esc</span> para seleccionar
             </span>
             <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/80 border border-slate-200 shadow-sm backdrop-blur text-[10px] font-semibold text-slate-500">
                <span className="bg-slate-100 px-1 rounded border border-slate-200 text-slate-600">Supr</span> para borrar
             </span>
        </div>
      </div>

    </div>
  );
}
