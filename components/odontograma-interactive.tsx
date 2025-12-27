"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, X, FileText, MousePointer2 } from 'lucide-react';

// --- CONFIGURACIÓN Y COLORES ---
const MODES = {
  PATHOLOGY: { id: 'pathology', label: 'Patología', color: '#ef4444' }, // Red
  TREATMENT: { id: 'treatment', label: 'Realizado', color: '#3b82f6' }  // Blue
};

// Paleta profesional ajustada para UI clínica estilo Google Material
const BRAND = {
  primary: '#145247',    // Deep Teal
  secondary: '#FAA805',  // Golden Orange
  tertiary: '#A3D900',   // Saturated Lime Green
  quaternary: '#FDFBF7', // Off-white cálido
  surface: '#FFFFFF',    // Blanco puro
  text: '#1F2937',       // Gris muy oscuro
  muted: '#6B7280',      // Gris medio
};

// Definición de Herramientas
const TOOLS = {
  SELECT: { id: 'select', label: 'Cursor', icon: 'cursor', cursor: 'default' },
  ERASER: { id: 'eraser', label: 'Borrar', icon: 'eraser', cursor: 'not-allowed' },
  
  // Clinical Tools
  // Note: For 'surface' types, we apply color to specific zones.
  // For 'whole' types, we apply logical state to the whole tooth.
  CARIES: { id: 'caries', label: 'Caries / Obturado', type: 'surface', hotkey: '1' },
  SEALANT: { id: 'sealant', label: 'Sellante', type: 'surface', hotkey: '2' },
  EXTRACTION: { id: 'extraction', label: 'Extracción', type: 'whole', hotkey: '3' },
  CROWN: { id: 'crown', label: 'Corona', type: 'whole', hotkey: '4' },
  ENDODONTICS: { id: 'endodontics', label: 'Endodoncia', type: 'whole', hotkey: '5' },
  PROSTHESIS: { id: 'prosthesis', label: 'Prótesis', type: 'whole', hotkey: '6' }
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
// Data Structure:
// {
//   "18": { 
//      "status": "planned" | "completed" | "existing", 
//      "condition": "extraction" | "crown" | "endodontics" | null,
//      "surfaces": { "top": "caries:red", "left": "restoration:blue" ... },
//      "notes": "..." 
//   }
// }

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
      status: null, // "planned" (red) or "completed" (blue) effectively
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
  onApply: (id: number, zone: string, tool: any, color: string) => void;
}

const Tooth = ({ id, data, currentTool, currentMode, isDeciduous, onApply }: ToothProps) => {
  // Extract state
  const condition = data?.condition;
  const statusColor = data?.status === 'completed' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color;
  
  const isCrown = condition === 'crown';
  const isExtracted = condition === 'extraction';
  const isEndo = condition === 'endodontics';
  const isProsthesis = condition === 'prosthesis';

  // Helper to resolve surface color
  const getSurfaceFill = (surface: string) => {
      const val = data?.surfaces?.[surface];
      if (!val) return '#FFFFFF'; // Default white
      // Expected format: "toolId:mode" (e.g. "caries:red" or "sealant:blue")
      if (val.includes(':')) {
           const [_, modeColor] = val.split(':');
           return modeColor === 'red' ? MODES.PATHOLOGY.color : MODES.TREATMENT.color; 
      }
      return '#FFFFFF';
  };

  const handleZoneClick = (zone: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const colorTag = currentMode === 'red' ? 'red' : 'blue';
      onApply(id, zone, currentTool, colorTag);
  };

  const renderShape = () => {
    const strokeColor = "#94a3b8";
    const hoverClass = "hover:opacity-80 transition-opacity cursor-pointer";

    if (isDeciduous) {
        // Circle Shape (Child)
        return (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="white" stroke={strokeColor} strokeWidth="1" />
                {/* Sectors */}
                <path d="M 20,20 L 80,20 L 50,50 Z" transform="translate(0, -5)" fill={getSurfaceFill('top')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('top', e)} className={hoverClass} />
                <path d="M 20,80 L 80,80 L 50,50 Z" transform="translate(0, 5)" fill={getSurfaceFill('bottom')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('bottom', e)} className={hoverClass} />
                <path d="M 20,20 L 20,80 L 50,50 Z" transform="translate(-5, 0)" fill={getSurfaceFill('left')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('left', e)} className={hoverClass} />
                <path d="M 80,20 L 80,80 L 50,50 Z" transform="translate(5, 0)" fill={getSurfaceFill('right')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('right', e)} className={hoverClass} />
                <circle cx="50" cy="50" r="15" fill={getSurfaceFill('center')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('center', e)} className={hoverClass} />
            </svg>
        );
    } else {
        // Square Shape (Adult)
        return (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                {/* Background base */}
                <rect x="0" y="0" width="100" height="100" fill="white" stroke="none" />
                
                {/* Trapezoid Sectors */}
                <polygon points="0,0 100,0 75,25 25,25" fill={getSurfaceFill('top')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('top', e)} className={hoverClass} />
                <polygon points="25,75 75,75 100,100 0,100" fill={getSurfaceFill('bottom')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('bottom', e)} className={hoverClass} />
                <polygon points="0,0 25,25 25,75 0,100" fill={getSurfaceFill('left')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('left', e)} className={hoverClass} />
                <polygon points="100,0 100,100 75,75 75,25" fill={getSurfaceFill('right')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('right', e)} className={hoverClass} />
                
                {/* Center Box */}
                <rect x="25" y="25" width="50" height="50" fill={getSurfaceFill('center')} stroke={strokeColor} strokeWidth="0.5" onClick={(e) => handleZoneClick('center', e)} className={hoverClass} />
                
                {/* Outer Border for clean look */}
                <rect x="0.5" y="0.5" width="99" height="99" fill="none" stroke={strokeColor} strokeWidth="1" pointerEvents="none" />
            </svg>
        );
    }
  };

  return (
    <div className="flex flex-col items-center mx-[2px] mb-2 group relative">
      <span className="text-[10px] font-bold text-slate-400 mb-0.5 group-hover:text-teal-700 transition-colors cursor-default">
        {id}
      </span>
      
      <div 
        className={`relative w-9 h-9 md:w-11 md:h-11 transition-transform hover:scale-105 ${isDeciduous ? 'rounded-full' : ''}`}
        onClick={(e) => handleZoneClick('whole', e)} // Fallback if clicking gaps, or for 'whole' tools
      >
        {/* --- CONDITION OVERLAYS --- */}

        {/* Crown Ring */}
        {isCrown && (
          <div 
            className="absolute -inset-[4px] rounded-full border-[3px] z-20 pointer-events-none"
            style={{ borderColor: statusColor }}
          />
        )}
        
        {/* Extraction X */}
        {isExtracted && (
          <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none">
             <span className="text-5xl leading-none font-bold opacity-90" style={{ color: statusColor }}>X</span>
          </div>
        )}
        
        {/* Endodontics Line */}
        {isEndo && (
             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                 <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px]" 
                      style={{ borderBottomColor: statusColor }}></div>
                 <div className="w-[2px] h-8 bg-current absolute top-2 left-1/2 -translate-x-1/2 -z-10" style={{ backgroundColor: statusColor }}></div>
             </div>
        )}

         {/* Prosthesis Bridge Indicator */}
         {isProsthesis && (
             <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 pointer-events-none w-12 border-t-4 border-dotted" style={{ borderColor: statusColor }}>
             </div>
        )}

        {renderShape()}
      </div>
    </div>
  );
};


// --- COMPONENTE PRINCIPAL ---

interface OdontogramaInteractiveProps {
  data: any; // JSONB from DB
  onChange: (data: any) => void;
  patientName?: string;
  patientId?: string;
  readOnly?: boolean;
}

export function OdontogramaInteractive({ 
  data = {}, 
  onChange, 
  patientName = "Paciente", 
  patientId = "",
  readOnly = false 
}: OdontogramaInteractiveProps) {

  // Initialize and Sync State
  const [teethState, setTeethState] = useState<Record<string, any>>(() => ({ ...generateInitialState(), ...data }));

  useEffect(() => {
    if (data && Object.keys(data).length > 0) {
      setTeethState(prev => ({ ...prev, ...data }));
    }
  }, [data]);

  const [activeTool, setActiveTool] = useState<any>(TOOLS.SELECT);
  const [activeMode, setActiveMode] = useState<'red' | 'blue'>('red'); // 'red' = planned/pathology, 'blue' = completed/existing
  const [viewMode, setViewMode] = useState('mixed'); // 'adult' | 'child' | 'mixed'

  // Keyboard Shortcuts
  useEffect(() => {
    if (readOnly) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      switch(e.key) {
        case '1': setActiveTool(TOOLS.CARIES); break;
        case '2': setActiveTool(TOOLS.SEALANT); break;
        case '3': setActiveTool(TOOLS.EXTRACTION); break;
        case '4': setActiveTool(TOOLS.CROWN); break;
        case '5': setActiveTool(TOOLS.ENDODONTICS); break;
        case '6': setActiveTool(TOOLS.PROSTHESIS); break;
        case 'Escape': setActiveTool(TOOLS.SELECT); break;
        case 'Delete': setActiveTool(TOOLS.ERASER); break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readOnly]);

  const applyTreatment = useCallback((toothId: number, zone: string, tool: any, mode: 'red' | 'blue') => {
    if (readOnly) return;

    setTeethState(prev => {
        const newState = { ...prev };
        // Ensure tooth object exists
        const tooth = newState[toothId] || { id: toothId, surfaces: {}, condition: null, status: null };
        if (!tooth.surfaces) tooth.surfaces = { top: null, bottom: null, left: null, right: null, center: null };

        // 1. ERASE
        if (tool.id === 'eraser') {
            if (zone === 'whole') {
                tooth.condition = null;
                tooth.status = null;
                tooth.surfaces = { top: null, bottom: null, left: null, right: null, center: null };
            } else {
                tooth.surfaces[zone] = null;
            }
        } 
        // 2. WHOLE TOOTH TOOLS (Extraction, Crown, etc)
        else if (tool.type === 'whole') {
            // If clicking 'whole' or specifically the center for a whole tool
            const isSameCondition = tooth.condition === tool.id;
            const isSameStatus = (mode === 'blue' && tooth.status === 'completed') || (mode === 'red' && tooth.status !== 'completed');

            if (isSameCondition && isSameStatus) {
                // Toggle Off
                tooth.condition = null;
                tooth.status = null;
            } else {
                // Apply
                tooth.condition = tool.id;
                tooth.status = mode === 'blue' ? 'completed' : 'planned';
            }
        } 
        // 3. SURFACE TOOLS (Caries, Sealant)
        else if (tool.type === 'surface') {
            // Apply strict surface painting
            // Format: "toolId:mode" -> "caries:red" or "sealant:blue"
            const newVal = `${tool.id}:${mode}`;
            if (tooth.surfaces[zone] === newVal) {
                tooth.surfaces[zone] = null; // Toggle off
            } else {
                tooth.surfaces[zone] = newVal;
            }
        }
        else if (tool.id === 'select') {
             // Selection logic could go here (e.g. highlight tooth)
             // For now, no-op
        }

        newState[toothId] = tooth;
        // Async update propagation
        if (onChange) Promise.resolve().then(() => onChange(newState));
        return newState;
    });
  }, [onChange, readOnly]);

  // Render Helper
  const renderQuadrant = (ids: number[], isChild = false) => (
      <div className="flex gap-1">
          {ids.map(id => (
              <Tooth 
                key={id}
                id={id}
                data={teethState[id]}
                currentTool={activeTool}
                currentMode={activeMode}
                isDeciduous={isChild}
                onApply={applyTreatment}
              />
          ))}
      </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans text-slate-800 rounded-xl border border-slate-200 shadow-sm overflow-hidden selection:bg-teal-100">
      
      {/* HEADER & CONTROLS */}
      <div className="bg-white px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40 shadow-sm">
         
         <div className="flex items-center gap-3">
             <div className="p-2 bg-teal-50 text-teal-800 rounded-lg">
                 <FileText size={20} />
             </div>
             <div>
                 <h2 className="text-sm font-bold text-slate-900 leading-tight">Odontograma</h2>
                 <p className="text-xs text-slate-500">{patientName} {patientId ? `(HC: ${patientId.slice(0,6)})` : ''}</p>
             </div>
         </div>

         {!readOnly && (
             <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setViewMode('adult')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'adult' ? 'bg-white shadow-sm text-teal-800' : 'text-slate-500 hover:text-slate-700'}`}
                >Adulto</button>
                <button 
                    onClick={() => setViewMode('mixed')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'mixed' ? 'bg-white shadow-sm text-teal-800' : 'text-slate-500 hover:text-slate-700'}`}
                >Mixto</button>
                <button 
                    onClick={() => setViewMode('child')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${viewMode === 'child' ? 'bg-white shadow-sm text-teal-800' : 'text-slate-500 hover:text-slate-700'}`}
                >Niño</button>
             </div>
         )}
         
         {!readOnly && (
             <button onClick={() => {
                 if (confirm('¿Limpiar todo el odontograma?')) {
                     const fresh = generateInitialState();
                     setTeethState(fresh);
                     onChange(fresh);
                 }
             }} className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-full transition-colors" title="Borrar todo">
                 <RefreshCw size={16} />
             </button>
         )}
      </div>

      {/* CANVAS */}
      <div className="flex-1 overflow-auto bg-[#FDFBF7] p-8 md:p-12 relative flex flex-col items-center">
            
            <div className="flex flex-col gap-12 select-none scale-90 md:scale-100 origin-top">
                
                {/* UP */}
                <div className="flex flex-col items-center gap-6">
                    {/* ADULT UP */}
                    {(viewMode === 'adult' || viewMode === 'mixed') && (
                        <div className="flex gap-8">
                             {renderQuadrant(ADULT_QUADRANTS.Q1)}
                             {renderQuadrant(ADULT_QUADRANTS.Q2)}
                        </div>
                    )}
                    
                    {/* CHILD UP */}
                    {(viewMode === 'child' || viewMode === 'mixed') && (
                        <div className="flex gap-16 px-8">
                             {renderQuadrant(CHILD_QUADRANTS.Q5, true)}
                             {renderQuadrant(CHILD_QUADRANTS.Q6, true)}
                        </div>
                    )}
                </div>

                {/* DIVIDER */}
                <div className="w-full flex items-center gap-4 opacity-30">
                     <div className="h-px bg-slate-400 flex-1"></div>
                     <span className="text-[10px] uppercase font-black text-slate-400">Lingual</span>
                     <div className="h-px bg-slate-400 flex-1"></div>
                </div>

                {/* DOWN */}
                <div className="flex flex-col-reverse items-center gap-6">
                    {/* ADULT DOWN */}
                    {(viewMode === 'adult' || viewMode === 'mixed') && (
                        <div className="flex gap-8">
                             {renderQuadrant(ADULT_QUADRANTS.Q4)}
                             {renderQuadrant(ADULT_QUADRANTS.Q3)}
                        </div>
                    )}

                    {/* CHILD DOWN */}
                    {(viewMode === 'child' || viewMode === 'mixed') && (
                        <div className="flex gap-16 px-8">
                             {renderQuadrant(CHILD_QUADRANTS.Q8, true)}
                             {renderQuadrant(CHILD_QUADRANTS.Q7, true)}
                        </div>
                    )}
                </div>

            </div>
      </div>

      {/* TOOLS DOCK */}
      {!readOnly && (
        <div className="bg-white border-t border-slate-200 p-4 sticky bottom-0 z-50">
             <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
                 
                 {/* 1. Mode Switch */}
                 <div className="flex bg-slate-100 p-1 rounded-lg shrink-0">
                     <button 
                        onClick={() => setActiveMode('red')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${activeMode === 'red' ? 'bg-white shadow text-red-600' : 'text-slate-500'}`}
                     >
                        <div className="w-2 h-2 rounded-full bg-red-500" />
                        <span className="text-xs font-bold uppercase">Patología</span>
                     </button>
                     <button 
                        onClick={() => setActiveMode('blue')}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md transition-all ${activeMode === 'blue' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
                     >
                        <div className="w-2 h-2 rounded-full bg-blue-500" />
                        <span className="text-xs font-bold uppercase">Realizado</span>
                     </button>
                 </div>

                 <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

                 {/* 2. Tool Palette */}
                 <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto scrollbar-hide px-2">
                     <button
                        onClick={() => setActiveTool(TOOLS.SELECT)}
                        className={`p-2.5 rounded-lg border ${activeTool.id === 'select' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        title="Seleccionar (Esc)"
                     >
                        <MousePointer2 size={18} />
                     </button>
                     
                     <button
                        onClick={() => setActiveTool(TOOLS.ERASER)}
                        className={`p-2.5 rounded-lg border ${activeTool.id === 'eraser' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                        title="Borrar (Supr)"
                     >
                        <Eraser size={18} />
                     </button>

                     <div className="w-px h-8 bg-slate-200 mx-1 shrink-0"></div>

                     {[TOOLS.CARIES, TOOLS.SEALANT, TOOLS.CROWN, TOOLS.EXTRACTION, TOOLS.ENDODONTICS, TOOLS.PROSTHESIS].map(tool => (
                         <button
                            key={tool.id}
                            onClick={() => setActiveTool(tool)}
                            className={`
                                flex items-center gap-2 px-3 py-2 rounded-lg border whitespace-nowrap transition-all
                                ${activeTool.id === tool.id 
                                    ? (activeMode === 'red' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-blue-50 border-blue-200 text-blue-700')
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }
                            `}
                         >
                            <span className="text-xs font-bold">{tool.label}</span>
                            <span className="text-[9px] px-1 py-0.5 rounded bg-black/5 text-black/50 font-mono hidden lg:inline-block">{tool.hotkey}</span>
                         </button>
                     ))}
                 </div>
             </div>
        </div>
      )}

    </div>
  );
}

