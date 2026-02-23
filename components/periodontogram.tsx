"use client"

import React, { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AlertCircle } from "lucide-react"

// Types
export interface PeriodontalData {
  [toothId: string]: {
    buccal: [number | null, number | null, number | null] // Distal, Center, Mesial
    lingual: [number | null, number | null, number | null] // Distal, Center, Mesial
    bleeding?: {
       buccal: [boolean, boolean, boolean]
       lingual: [boolean, boolean, boolean]
    }
    mobility?: number | null
    furcation?: number | null
  }
}

interface PeriodontogramProps {
  data?: PeriodontalData
  onChange?: (data: PeriodontalData) => void
  readOnly?: boolean
}

// Tooth Numbering
const UPPER_TEETH = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28
]

const LOWER_TEETH = [
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38
]

const MeasurementInput = ({ 
  value, 
  onChange, 
  disabled 
}: { 
  value: number | null, 
  onChange: (val: number | null) => void,
  disabled?: boolean 
}) => {
  const isHigh = value !== null && value > 4
  
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      maxLength={1}
      disabled={disabled}
      className={`
        w-6 h-8 text-center text-xs border rounded-sm outline-none transition-colors
        focus:ring-1 focus:ring-teal-500 focus:border-teal-500
        ${isHigh ? 'bg-red-50 text-red-600 font-bold border-red-200' : 'bg-white text-slate-700 border-slate-200'}
        ${disabled ? 'bg-slate-50 opacity-50 cursor-not-allowed' : ''}
      `}
      value={value ?? ''}
      onChange={(e) => {
        const val = e.target.value
        if (val === '') {
          onChange(null)
          return
        }
        const num = parseInt(val)
        if (!isNaN(num) && num >= 0 && num <= 9) {
          onChange(num)
        }
      }}
    />
  )
}

const ToothColumn = ({ 
  id, 
  data, 
  onUpdate, 
  position, // 'top' or 'bottom' arch
  readOnly 
}: { 
  id: number
  data: PeriodontalData
  onUpdate: (id: number, type: 'buccal' | 'lingual', index: number, val: number | null) => void
  position: 'top' | 'bottom'
  readOnly?: boolean
}) => {
  const toothData = data[id] || { buccal: [null, null, null], lingual: [null, null, null] }
  
  // For UI consistency:
  // Top Arch: Buccal on Top, Lingual on Bottom relative to Tooth Number
  // Bottom Arch: Lingual on Top, Buccal on Bottom relative to Tooth Number
  
  const TopMeasurements = position === 'top' ? toothData.buccal : toothData.lingual
  const TopType = position === 'top' ? 'buccal' : 'lingual'
  
  const BottomMeasurements = position === 'top' ? toothData.lingual : toothData.buccal
  const BottomType = position === 'top' ? 'lingual' : 'buccal'

  return (
    <div className="flex flex-col items-center gap-1 min-w-[50px]">
      {/* Top Rows (3 inputs) */}
      <div className="flex gap-[1px]">
        {TopMeasurements.map((val, idx) => (
          <MeasurementInput
            key={`${TopType}-${idx}`}
            value={val}
            onChange={(v) => onUpdate(id, TopType, idx, v)}
            disabled={readOnly}
          />
        ))}
      </div>

      {/* Tooth Number Visualization */}
      <div className="py-2 flex items-center justify-center">
        <span className="text-sm font-bold text-slate-400 bg-slate-50 px-2 rounded">
          {id}
        </span>
      </div>

      {/* Bottom Rows (3 inputs) */}
      <div className="flex gap-[1px]">
        {BottomMeasurements.map((val, idx) => (
            <MeasurementInput
              key={`${BottomType}-${idx}`}
              value={val}
              onChange={(v) => onUpdate(id, BottomType, idx, v)}
              disabled={readOnly}
            />
          ))}
      </div>
    </div>
  )
}

export function Periodontogram({ data = {}, onChange, readOnly = false }: PeriodontogramProps) {
  const [localData, setLocalData] = useState<PeriodontalData>(data)

  useEffect(() => {
    setLocalData(data)
  }, [data])

  const handleUpdate = (id: number, type: 'buccal' | 'lingual', index: number, val: number | null) => {
    if (readOnly) return

    const newData = { ...localData }
    if (!newData[id]) {
        newData[id] = { buccal: [null, null, null], lingual: [null, null, null] }
    }
    
    // Create new array to trigger update
    const newMeasurements = [...newData[id][type]] as [number|null, number|null, number|null]
    newMeasurements[index] = val
    
    newData[id] = {
        ...newData[id],
        [type]: newMeasurements
    }

    setLocalData(newData)
    onChange?.(newData)
  }

  // Calculate stats
  const diseaseCount = Object.values(localData).reduce((acc, tooth) => {
    const highBuccal = tooth.buccal.filter(v => v !== null && v > 4).length
    const highLingual = tooth.lingual.filter(v => v !== null && v > 4).length
    return acc + highBuccal + highLingual
  }, 0)

  return (
    <div className="w-full bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex justify-between items-center">
             <div className="flex items-center gap-2">
                 <h3 className="font-bold text-slate-800">Periodontograma</h3>
                 {diseaseCount > 0 && (
                     <Badge variant="destructive" className="flex items-center gap-1">
                         <AlertCircle size={12} />
                         {diseaseCount} Alertas ({">"}4mm)
                     </Badge>
                 )}
             </div>
             
             <div className="flex gap-4 text-xs text-slate-500">
                 <div className="flex items-center gap-1">
                     <div className="w-3 h-3 bg-red-50 border border-red-200 rounded-sm"></div>
                     <span>{'>'} 4mm (Patología)</span>
                 </div>
                 <div className="flex items-center gap-1">
                     <div className="w-3 h-3 bg-white border border-slate-200 rounded-sm"></div>
                     <span>Normal</span>
                 </div>
             </div>
        </div>

        {/* Key Labels */}
        <div className="p-1 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest flex justify-between bg-slate-50/50">
             <span>Vestibular (Buccal)</span>
             <span>Lingual / Palatino</span>
        </div>

        {/* 1. Upper Arch */}
        <div className="overflow-x-auto scrollbar-hide pb-4">
             <div className="min-w-max p-4 md:p-8 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Maxilar Superior</span>
                  
                  {/* Row of Teeth */}
                  <div className="flex gap-1 md:gap-2">
                       {UPPER_TEETH.map(id => (
                          <div key={id} className={`flex flex-col items-center ${id === 21 ? 'ml-6 border-l pl-6 border-slate-300' : ''}`}>
                             <ToothColumn 
                                id={id}
                                data={localData}
                                onUpdate={handleUpdate}
                                position="top"
                                readOnly={readOnly}
                             />
                          </div>
                       ))}
                  </div>

                  {/* Labels for Top Row */}
                  <div className="w-full flex justify-between text-[10px] font-bold text-slate-400 px-2 mt-1">
                       <span>Der.</span>
                       <span>Vestibular (Arriba) / Palatino (Abajo)</span>
                       <span>Izq.</span>
                  </div>
             </div>
        </div>

        <div className="h-px bg-slate-200 w-full"></div>

        {/* 2. Lower Arch */}
        <div className="overflow-x-auto scrollbar-hide pb-4">
             <div className="min-w-max p-4 md:p-8 flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Mandíbula (Inferior)</span>
                  
                  {/* Row of Teeth */}
                  <div className="flex gap-1 md:gap-2">
                       {LOWER_TEETH.map(id => (
                          <div key={id} className={`flex flex-col items-center ${id === 31 ? 'ml-6 border-l pl-6 border-slate-300' : ''}`}>
                             <ToothColumn 
                                id={id}
                                data={localData}
                                onUpdate={handleUpdate}
                                position="bottom"
                                readOnly={readOnly}
                             />
                          </div>
                       ))}
                  </div>
                   {/* Labels for Bottom Row */}
                   <div className="w-full flex justify-between text-[10px] font-bold text-slate-400 px-2 mt-1">
                       <span>Der.</span>
                       <span>Lingual (Arriba) / Vestibular (Abajo)</span>
                       <span>Izq.</span>
                  </div>
             </div>
        </div>

    </div>
  )
}
