"use client"

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Eraser, X, FileText } from 'lucide-react';

// --- CONFIGURACIÓN Y COLORES ---
const MODES = {
  PATHOLOGY: { id: 'pathology', label: 'Patología', color: '#ef4444' }, // Red
  TREATMENT: { id: 'treatment', label: 'Realizado', color: '#3b82f6' }  // Blue
};

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
  // Mode Selection is separate
  SELECT: { id: 'select', label: 'Cursor', icon: 'cursor', cursor: 'default' },
  ERASER: { id: 'eraser', label: 'Borrar', icon: 'eraser', cursor: 'not-allowed' },
  
  // Clinical Tools
  CARIES: { id: 'caries', label: 'Caries / Obturado', type: 'surface', hotkey: '1' },
  SEALANT: { id: 'sealant', label: 'Sellante', type: 'surface', hotkey: '2' },
  EXTRACTION: { id: 'extraction', label: 'Extracción / Perdida', type: 'whole', hotkey: '3' },
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
      conditionColor: null, // New field to store color for whole tooth conditions
      recession: '',
      mobility: ''
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
  currentMode: 'red' | 'blue';
  isDeciduous: boolean;
  onApply: (id: number, zone: string, tool: any, color: string) => void;
}

const Tooth = ({ id, data, currentTool, currentMode, isDeciduous, onApply }: ToothProps) => {
  const isCrown = data?.condition === 'crown';
  const isExtracted = data?.condition === 'extraction';
  const isEndo = data?.condition === 'endodontics';
  const isProsthesis = data?.condition === 'prosthesis';
  
  // Extract color from the saved state. Format: "toolId:color" or just "toolId" (legacy)
  const getSurfaceColor = (surface: string) => {
      const val = data?.surfaces?.[surface];
      if (!val) return '#FFFFFF';
      if (val.includes(':')) {
          const [_, color] = val.split(':');
          return color === 'red' ? MODES.PATHOLOGY.color : MODES.TREATMENT.color;
      }
      // Legacy fallback
      if (val === 'caries') return MODES.PATHOLOGY.color;
      if (val === 'restoration') return MODES.TREATMENT.color;
      return '#FFFFFF';
  };

  const currentPaintColor = currentMode === 'red' ? 'red' : 'blue';

  const handleSurfaceClick = (surfaceKey: string) => {
      onApply(id, surfaceKey, currentTool, currentPaintColor);
  };
  
  const handleWholeClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (['whole', 'select', 'eraser'].includes(currentTool.type || '') || currentTool.id === 'select' || currentTool.id === 'eraser') {
      onApply(id, 'whole', currentTool, currentPaintColor);
    } else {
      onApply(id, 'center', currentTool, currentPaintColor);
    }
  };

  const crownColor = isCrown ? (data.conditionColor === 'blue' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color) : undefined;
  const extractColor = isExtracted ? (data.conditionColor === 'blue' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color) : undefined;

  // SVG Paths for Square (Adult) vs Circle (Child)
  const renderShape = () => {
    if (isDeciduous) {
        // Circle Shape with 5 sectors
        // Center is 50,50. Radius 50.
        // We simulate sectors using paths.
        // Center circle: r=15
        return (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <circle cx="50" cy="50" r="48" fill="white" stroke="#94a3b8" strokeWidth="1" />
                
                {/* Top Sector */}
                <path d="M 20,20 L 80,20 L 50,50 Z" transform="translate(0, -5)" fill={getSurfaceColor('top')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('top')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                {/* Bottom Sector */}
                <path d="M 20,80 L 80,80 L 50,50 Z" transform="translate(0, 5)" fill={getSurfaceColor('bottom')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('bottom')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                {/* Left Sector */}
                <path d="M 20,20 L 20,80 L 50,50 Z" transform="translate(-5, 0)" fill={getSurfaceColor('left')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('left')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                {/* Right Sector */}
                <path d="M 80,20 L 80,80 L 50,50 Z" transform="translate(5, 0)" fill={getSurfaceColor('right')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('right')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                {/* Center Circle */}
                <circle cx="50" cy="50" r="15" fill={getSurfaceColor('center')} stroke="#94a3b8" strokeWidth="1" onClick={handleWholeClick} className="hover:opacity-80 transition-opacity cursor-pointer" />
            </svg>
        );
    } else {
        // Standard Square Shape
        return (
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
                <polygon points="0,0 100,0 75,25 25,25" fill={getSurfaceColor('top')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('top')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                <polygon points="25,75 75,75 100,100 0,100" fill={getSurfaceColor('bottom')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('bottom')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                <polygon points="0,0 25,25 25,75 0,100" fill={getSurfaceColor('left')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('left')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                <polygon points="100,0 100,100 75,75 75,25" fill={getSurfaceColor('right')} stroke="#94a3b8" strokeWidth="1" onClick={() => handleSurfaceClick('right')} className="hover:opacity-80 transition-opacity cursor-pointer" />
                <rect x="25" y="25" width="50" height="50" fill={getSurfaceColor('center')} stroke="#94a3b8" strokeWidth="1" onClick={handleWholeClick} className="hover:opacity-80 transition-opacity cursor-pointer" />
            </svg>
        );
    }
  };

  return (
    <div className="flex flex-col items-center mx-[2px] mb-2 group relative">
      <span className="text-[10px] font-bold text-slate-400 mb-0.5 group-hover:text-teal-700 transition-colors">{id}</span>
      <div className={`relative w-9 h-9 md:w-11 md:h-11 transition-transform hover:scale-105 ${isDeciduous ? 'rounded-full' : ''}`}>
        
        {/* Indicators Overlay */}
        {isCrown && (
          <div className={`absolute -inset-[3px] rounded-full border-[3px] z-20 pointer-events-none`}
               style={{ borderColor: (typeof crownColor === 'string' ? crownColor : BRAND.secondary) }}></div>
        )}
        
        {isExtracted && (
          <div className="absolute -inset-1 z-30 flex items-center justify-center pointer-events-none animate-in fade-in zoom-in duration-200">
             <span className="text-4xl leading-none font-bold" style={{ color: extractColor }}>X</span>
          </div>
        )}
        
        {isEndo && (
             <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                 <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-b-[10px]" style={{ borderBottomColor: data.conditionColor === 'blue' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color }}></div>
             </div>
        )}

         {isProsthesis && (
             <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                 <span className="text-xs font-bold" style={{ color: data.conditionColor === 'blue' ? MODES.TREATMENT.color : MODES.PATHOLOGY.color }}>(---)</span>
             </div>
        )}

        {renderShape()}
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

// --- HELPER COMPONENTS ---

const ToothInput = ({ id, value, onChange }: { id: number, value: string, onChange: (val: string) => void }) => (
  <div className="w-9 md:w-11 mx-[2px] flex justify-center">
      <input 
          type="text" 
          maxLength={1}
          className="w-full h-6 text-center text-xs border border-slate-300 rounded-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none uppercase bg-white/50"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
      />
  </div>
);

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

  const [activeTool, setActiveTool] = useState<any>(TOOLS.SELECT);
  const [activeMode, setActiveMode] = useState<'red' | 'blue'>('red'); // PATHOLOGY vs TREATMENT
  const [viewMode, setViewMode] = useState('mixed'); // 'adult' | 'child' | 'mixed'

  // Atajos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in inputs
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
  }, []);

  const applyTreatment = useCallback((toothId: number, zone: string, tool: any, color: string) => {
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
            tooth.conditionColor = null; // Clear condition color
            tooth.surfaces = { top: null, bottom: null, left: null, right: null, center: null };
            tooth.recession = '';
            tooth.mobility = '';
        } else {
            tooth.surfaces = { ...tooth.surfaces, [zone]: null };
        }
      } else if (tool.type === 'whole') {
        // Toggle condition
        if (tooth.condition === tool.id && tooth.conditionColor === color) {
            tooth.condition = null;
            tooth.conditionColor = null;
        } else {
            tooth.condition = tool.id;
            tooth.conditionColor = color;
        }
      } else {
        // Surface treatment
        const currentVal = tooth.surfaces[zone];
        const newVal = `${tool.id}:${color}`;
        tooth.surfaces = { ...tooth.surfaces, [zone]: currentVal === newVal ? null : newVal };
      }
      newState[toothId] = tooth;
      
      // Propagate changes to parent
      if (onChange) Promise.resolve().then(() => onChange(newState));
      
      return newState;
    });
  }, [onChange]);
  
  const handleInputChange = (id: number, field: 'recession' | 'mobility', value: string) => {
      setTeethState(prev => {
          const newState = { ...prev };
          if (!newState[id]) newState[id] = { id, surfaces: {}, condition: null };
          newState[id] = { ...newState[id], [field]: value };
          if (onChange) Promise.resolve().then(() => onChange(newState));
          return newState;
      });
  };




  const renderRow = (ids: number[], showInputsTop = false, showInputsBottom = false) => (
    <div className="flex flex-col gap-1">
        {showInputsTop && (
            <>
                <div className="flex gap-1 justify-center items-center">
                    <span className="text-[9px] font-bold text-slate-400 w-16 text-right mr-2">RECESIÓN</span>
                    {ids.map(id => (
                        <ToothInput 
                            key={`rec-${id}`} 
                            id={id} 
                            value={teethState[id]?.recession} 
                            onChange={(val) => handleInputChange(id, 'recession', val)}
                        />
                    ))}
                </div>
                <div className="flex gap-1 justify-center items-center">
                    <span className="text-[9px] font-bold text-slate-400 w-16 text-right mr-2">MOVILIDAD</span>
                    {ids.map(id => (
                        <ToothInput 
                            key={`mob-${id}`} 
                            id={id} 
                            value={teethState[id]?.mobility} 
                            onChange={(val) => handleInputChange(id, 'mobility', val)}
                        />
                    ))}
                </div>
            </>
        )}
        
        <div className="flex gap-1 justify-center items-center">
             <span className="w-16 mr-2"></span> {/* Spacer for alignment */}
             {ids.map(id => (
                <Tooth 
                    key={id} 
                    id={id} 
                    data={teethState[id]} 
                    currentTool={activeTool} 
                    currentMode={activeMode}
                    isDeciduous={id > 50}
                    onApply={applyTreatment} 
                />
             ))}
        </div>

        {showInputsBottom && (
            <>
                <div className="flex gap-1 justify-center items-center">
                    <span className="text-[9px] font-bold text-slate-400 w-16 text-right mr-2">MOVILIDAD</span>
                    {ids.map(id => (
                        <ToothInput 
                            key={`mob-${id}`} 
                            id={id} 
                            value={teethState[id]?.mobility} 
                            onChange={(val) => handleInputChange(id, 'mobility', val)}
                        />
                    ))}
                </div>
                <div className="flex gap-1 justify-center items-center">
                    <span className="text-[9px] font-bold text-slate-400 w-16 text-right mr-2">RECESIÓN</span>
                    {ids.map(id => (
                        <ToothInput 
                            key={`rec-${id}`} 
                            id={id} 
                            value={teethState[id]?.recession} 
                            onChange={(val) => handleInputChange(id, 'recession', val)}
                        />
                    ))}
                </div>
            </>
        )}
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
              <div className="flex flex-col xl:flex-row gap-8 items-start justify-center">
                  <div className="flex flex-col items-center gap-4">
                      {/* Q1 Permanent + Inputs */}
                      {(viewMode === 'adult' || viewMode === 'mixed') && (
                          renderRow(ADULT_QUADRANTS.Q1, true, false)
                      )}
                      {/* Q5 Deciduous */}
                      {(viewMode === 'child' || viewMode === 'mixed') && (
                          <div className={viewMode === 'mixed' ? 'pl-[72px]' : ''}>
                              {renderRow(CHILD_QUADRANTS.Q5)}
                          </div>
                      )}
                  </div>
                  
                  <div className="flex flex-col items-center gap-4">
                       {/* Q2 Permanent + Inputs */}
                       {(viewMode === 'adult' || viewMode === 'mixed') && (
                          renderRow(ADULT_QUADRANTS.Q2, true, false)
                       )}
                       {/* Q6 Deciduous */}
                       {(viewMode === 'child' || viewMode === 'mixed') && (
                          <div className={viewMode === 'mixed' ? 'pl-[72px]' : ''}>
                              {renderRow(CHILD_QUADRANTS.Q6)}
                          </div>
                       )}
                  </div>
              </div>

              {/* CENTER DIVIDER LABEL */}
              {(viewMode === 'mixed') && (
                  <div className="w-full flex items-center gap-4 my-2 opacity-50">
                     <div className="h-px bg-slate-300 flex-1"></div>
                     <span className="text-[10px] uppercase font-bold text-slate-400">Lingual</span>
                     <div className="h-px bg-slate-300 flex-1"></div>
                  </div>
              )}

              {/* LOWER ARCH */}
              <div className="flex flex-col xl:flex-row gap-8 items-start justify-center">
                   <div className="flex flex-col-reverse items-center gap-4">
                       {/* Q3 Permanent + Inputs Bottom */}
                       {(viewMode === 'adult' || viewMode === 'mixed') && (
                           renderRow(ADULT_QUADRANTS.Q3, false, true)
                       )}
                       {/* Q7 Deciduous */}
                       {(viewMode === 'child' || viewMode === 'mixed') && (
                           <div className={viewMode === 'mixed' ? 'pl-[72px]' : ''}>
                               {renderRow(CHILD_QUADRANTS.Q7)}
                           </div>
                       )}
                   </div>

                   <div className="flex flex-col-reverse items-center gap-4">
                       {/* Q4 Permanent + Inputs Bottom */}
                       {(viewMode === 'adult' || viewMode === 'mixed') && (
                           renderRow(ADULT_QUADRANTS.Q4, false, true)
                       )}
                       {/* Q8 Deciduous */}
                       {(viewMode === 'child' || viewMode === 'mixed') && (
                           <div className={viewMode === 'mixed' ? 'pl-[72px]' : ''}>
                               {renderRow(CHILD_QUADRANTS.Q8)}
                           </div>
                       )}
                   </div>
              </div>
            </div>
        </div>
      </main>

      {/* 3. FLOATING TOOLBAR - Google Material Dock Style */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-full px-4 w-auto flex flex-col items-center gap-3">
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 shadow-[0_8px_30px_rgba(0,0,0,0.12)] rounded-2xl p-2 flex items-center gap-1.5 md:gap-2 overflow-x-auto scrollbar-hide ring-1 ring-slate-900/5">
            
            {/* 1. Mode Selection (Red vs Blue) */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-100/50 rounded-xl mr-2">
                <button
                    onClick={() => setActiveMode('red')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border ${
                        activeMode === 'red' 
                        ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm" />
                    <span className="text-xs font-bold">Patología</span>
                </button>
                 <button
                    onClick={() => setActiveMode('blue')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all border ${
                        activeMode === 'blue' 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 shadow-sm' 
                        : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}
                >
                    <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm" />
                    <span className="text-xs font-bold">Tratamiento</span>
                </button>
            </div>
            
            <div className="w-px h-8 bg-slate-200 mx-1"></div>

            {/* 2. Utility Tools */}
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

            {/* 3. Clinical Tools */}
            {[TOOLS.CARIES, TOOLS.SEALANT, TOOLS.EXTRACTION, TOOLS.CROWN, TOOLS.ENDODONTICS, TOOLS.PROSTHESIS].map((tool) => {
                const isActive = activeTool.id === tool.id;
                // Determine icon color based on active mode
                const indicatorColor = activeMode === 'red' ? MODES.PATHOLOGY.color : MODES.TREATMENT.color;
                
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
                        {/* Static Color Indicator for tool identity or Dynamic based on mode? 
                            User said "Color red and blue... principally at the beginning".
                            So tools are just "Tools", color is determined by mode.
                        */}
                        <div 
                            className={`w-3 h-3 rounded-full shadow-sm ${isActive ? 'ring-2 ring-white/20' : ''}`}
                            style={{ backgroundColor: indicatorColor }} 
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
