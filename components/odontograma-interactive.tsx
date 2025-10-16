"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface OdontogramaInteractiveProps {
  data: Record<string, any>
  onChange: (data: Record<string, any>) => void
}

const TOOTH_CODES = {
  H: { label: "Sano", color: "bg-green-100 border-green-500", icon: "✓" },
  CA: { label: "Caries", color: "bg-red-100 border-red-500", icon: "●" },
  F: { label: "Obturación", color: "bg-blue-100 border-blue-500", icon: "■" },
  E: { label: "Endodoncia", color: "bg-purple-100 border-purple-500", icon: "↓" },
  CRR: { label: "Corona", color: "bg-yellow-100 border-yellow-500", icon: "C" },
  CRI: { label: "Corona indicada", color: "bg-yellow-50 border-yellow-400", icon: "Ci" },
  PRT_I: { label: "Prótesis indicada", color: "bg-orange-50 border-orange-400", icon: "Pi" },
  PRT_R: { label: "Prótesis realizada", color: "bg-orange-100 border-orange-500", icon: "Pr" },
  X: { label: "Ausente", color: "bg-gray-200 border-gray-500", icon: "✕" },
  M: { label: "Movilidad", color: "bg-pink-100 border-pink-500", icon: "M" },
  RE: { label: "Recesión gingival", color: "bg-red-50 border-red-400", icon: "↓" },
  S: { label: "Sellante", color: "bg-teal-100 border-teal-500", icon: "S" },
}

const NUMPAD_SHORTCUTS: Record<string, keyof typeof TOOTH_CODES> = {
  Numpad1: "H",
  Numpad2: "CA",
  Numpad3: "F",
  Numpad4: "E",
  Numpad5: "CRR",
  Numpad6: "X",
  Numpad7: "M",
  Numpad8: "S",
  Numpad9: "PRT_R",
}

// FDI tooth numbering system
const ADULT_TEETH = {
  upper: [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28],
  lower: [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38],
}

export function OdontogramaInteractive({ data, onChange }: OdontogramaInteractiveProps) {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null)
  const [selectedCode, setSelectedCode] = useState<keyof typeof TOOTH_CODES | null>(null)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedTooth) return

      const code = NUMPAD_SHORTCUTS[e.code]
      if (code) {
        e.preventDefault()
        applyCodeToTooth(selectedTooth, code)
      }

      if (e.code === "Backspace") {
        e.preventDefault()
        removeCodeFromTooth(selectedTooth)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedTooth, data])

  const applyCodeToTooth = (tooth: number, code: keyof typeof TOOTH_CODES) => {
    const newData = {
      ...data,
      [tooth]: {
        code,
        surfaces: ["oclusal"],
        updatedAt: new Date().toISOString(),
      },
    }
    onChange(newData)
  }

  const removeCodeFromTooth = (tooth: number) => {
    const newData = { ...data }
    delete newData[tooth]
    onChange(newData)
  }

  const getToothStatus = (tooth: number) => {
    return data[tooth]?.code || null
  }

  const renderTooth = (tooth: number) => {
    const status = getToothStatus(tooth)
    const isSelected = selectedTooth === tooth
    const statusInfo = status ? TOOTH_CODES[status as keyof typeof TOOTH_CODES] : null

    return (
      <TooltipProvider key={tooth}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => setSelectedTooth(tooth)}
              className={cn(
                "relative w-12 h-16 border-2 rounded-lg transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary",
                isSelected && "ring-2 ring-primary scale-110",
                statusInfo ? statusInfo.color : "bg-white border-gray-300",
              )}
            >
              <div className="absolute top-0 left-0 right-0 text-[10px] font-bold text-center">{tooth}</div>
              {statusInfo && (
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  {statusInfo.icon}
                </div>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Diente {tooth}</p>
            {statusInfo && <p className="text-sm">{statusInfo.label}</p>}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-6">
      {/* Odontograma visual */}
      <Card className="p-6">
        <div className="space-y-8">
          {/* Arcada superior */}
          <div>
            <div className="text-sm font-medium text-center mb-2">Arcada Superior</div>
            <div className="flex justify-center gap-1">{ADULT_TEETH.upper.map((tooth) => renderTooth(tooth))}</div>
          </div>

          {/* Arcada inferior */}
          <div>
            <div className="text-sm font-medium text-center mb-2">Arcada Inferior</div>
            <div className="flex justify-center gap-1">{ADULT_TEETH.lower.map((tooth) => renderTooth(tooth))}</div>
          </div>
        </div>
      </Card>

      {/* Panel de control */}
      <Card className="p-4">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">
              {selectedTooth ? `Diente seleccionado: ${selectedTooth}` : "Selecciona un diente"}
            </h4>
            <p className="text-sm text-muted-foreground">
              Usa los atajos NumPad o haz clic en los botones para aplicar códigos
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {Object.entries(TOOTH_CODES).map(([code, info]) => (
              <Button
                key={code}
                variant="outline"
                size="sm"
                disabled={!selectedTooth}
                onClick={() => selectedTooth && applyCodeToTooth(selectedTooth, code as keyof typeof TOOTH_CODES)}
                className={cn("justify-start", info.color)}
              >
                <span className="mr-2">{info.icon}</span>
                {info.label}
              </Button>
            ))}
          </div>

          {selectedTooth && (
            <Button variant="destructive" size="sm" onClick={() => removeCodeFromTooth(selectedTooth)}>
              Limpiar diente {selectedTooth}
            </Button>
          )}
        </div>
      </Card>

      {/* Leyenda */}
      <Card className="p-4">
        <h4 className="font-medium mb-3">Leyenda de símbolos</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(TOOTH_CODES).map(([code, info]) => (
            <div key={code} className="flex items-center gap-2">
              <div className={cn("w-8 h-8 border-2 rounded flex items-center justify-center text-sm", info.color)}>
                {info.icon}
              </div>
              <span className="text-sm">{info.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
