"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useTranslation } from "@/components/translations"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Treatment = "healthy" | "cavity" | "filling" | "crown" | "root-canal" | "extraction" | "implant" | "bridge"

interface ToothData {
  id: string
  treatment: Treatment
  notes?: string
}

const treatmentColors: Record<Treatment, string> = {
  healthy: "#10b981", // green
  cavity: "#ef4444", // red
  filling: "#3b82f6", // blue
  crown: "#f59e0b", // yellow
  "root-canal": "#8b5cf6", // purple
  extraction: "#6b7280", // gray
  implant: "#06b6d4", // cyan
  bridge: "#f97316", // orange
}

const treatmentLabels: Record<Treatment, string> = {
  healthy: "Sano",
  cavity: "Caries",
  filling: "Empaste",
  crown: "Corona",
  "root-canal": "Endodoncia",
  extraction: "Extracción",
  implant: "Implante",
  bridge: "Puente",
}

const adultTeeth = [
  // Upper jaw
  { id: "18", position: { x: 0, y: 0 }, quadrant: 1 },
  { id: "17", position: { x: 1, y: 0 }, quadrant: 1 },
  { id: "16", position: { x: 2, y: 0 }, quadrant: 1 },
  { id: "15", position: { x: 3, y: 0 }, quadrant: 1 },
  { id: "14", position: { x: 4, y: 0 }, quadrant: 1 },
  { id: "13", position: { x: 5, y: 0 }, quadrant: 1 },
  { id: "12", position: { x: 6, y: 0 }, quadrant: 1 },
  { id: "11", position: { x: 7, y: 0 }, quadrant: 1 },
  { id: "21", position: { x: 8, y: 0 }, quadrant: 2 },
  { id: "22", position: { x: 9, y: 0 }, quadrant: 2 },
  { id: "23", position: { x: 10, y: 0 }, quadrant: 2 },
  { id: "24", position: { x: 11, y: 0 }, quadrant: 2 },
  { id: "25", position: { x: 12, y: 0 }, quadrant: 2 },
  { id: "26", position: { x: 13, y: 0 }, quadrant: 2 },
  { id: "27", position: { x: 14, y: 0 }, quadrant: 2 },
  { id: "28", position: { x: 15, y: 0 }, quadrant: 2 },
  // Lower jaw
  { id: "48", position: { x: 0, y: 2 }, quadrant: 4 },
  { id: "47", position: { x: 1, y: 2 }, quadrant: 4 },
  { id: "46", position: { x: 2, y: 2 }, quadrant: 4 },
  { id: "45", position: { x: 3, y: 2 }, quadrant: 4 },
  { id: "44", position: { x: 4, y: 2 }, quadrant: 4 },
  { id: "43", position: { x: 5, y: 2 }, quadrant: 4 },
  { id: "42", position: { x: 6, y: 2 }, quadrant: 4 },
  { id: "41", position: { x: 7, y: 2 }, quadrant: 4 },
  { id: "31", position: { x: 8, y: 2 }, quadrant: 3 },
  { id: "32", position: { x: 9, y: 2 }, quadrant: 3 },
  { id: "33", position: { x: 10, y: 2 }, quadrant: 3 },
  { id: "34", position: { x: 11, y: 2 }, quadrant: 3 },
  { id: "35", position: { x: 12, y: 2 }, quadrant: 3 },
  { id: "36", position: { x: 13, y: 2 }, quadrant: 3 },
  { id: "37", position: { x: 14, y: 2 }, quadrant: 3 },
  { id: "38", position: { x: 15, y: 2 }, quadrant: 3 },
]

const childTeeth = [
  // Upper jaw
  { id: "E", position: { x: 2, y: 0 }, quadrant: 1 },
  { id: "D", position: { x: 3, y: 0 }, quadrant: 1 },
  { id: "C", position: { x: 4, y: 0 }, quadrant: 1 },
  { id: "B", position: { x: 5, y: 0 }, quadrant: 1 },
  { id: "A", position: { x: 6, y: 0 }, quadrant: 1 },
  { id: "F", position: { x: 9, y: 0 }, quadrant: 2 },
  { id: "G", position: { x: 10, y: 0 }, quadrant: 2 },
  { id: "H", position: { x: 11, y: 0 }, quadrant: 2 },
  { id: "I", position: { x: 12, y: 0 }, quadrant: 2 },
  { id: "J", position: { x: 13, y: 0 }, quadrant: 2 },
  // Lower jaw
  { id: "T", position: { x: 2, y: 2 }, quadrant: 4 },
  { id: "S", position: { x: 3, y: 2 }, quadrant: 4 },
  { id: "R", position: { x: 4, y: 2 }, quadrant: 4 },
  { id: "Q", position: { x: 5, y: 2 }, quadrant: 4 },
  { id: "P", position: { x: 6, y: 2 }, quadrant: 4 },
  { id: "K", position: { x: 9, y: 2 }, quadrant: 3 },
  { id: "L", position: { x: 10, y: 2 }, quadrant: 3 },
  { id: "M", position: { x: 11, y: 2 }, quadrant: 3 },
  { id: "N", position: { x: 12, y: 2 }, quadrant: 3 },
  { id: "O", position: { x: 13, y: 2 }, quadrant: 3 },
]

export function Odontogram() {
  const { t } = useTranslation()
  const [teethData, setTeethData] = useState<Record<string, ToothData>>({})
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null)
  const [selectedTreatment, setSelectedTreatment] = useState<Treatment>("healthy")
  const [odontogramType, setOdontogramType] = useState<"adult" | "child">("adult")

  const currentTeeth = odontogramType === "adult" ? adultTeeth : childTeeth

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!selectedTooth) return

      const keyMap: Record<string, Treatment> = {
        "1": "healthy",
        "2": "cavity",
        "3": "filling",
        "4": "crown",
        "5": "root-canal",
        "6": "extraction",
        "7": "implant",
        "8": "bridge",
      }

      const treatment = keyMap[event.key]
      if (treatment) {
        applyTreatment(selectedTooth, treatment)
        event.preventDefault()
      }
    }

    window.addEventListener("keydown", handleKeyPress)
    return () => window.removeEventListener("keydown", handleKeyPress)
  }, [selectedTooth])

  const applyTreatment = (toothId: string, treatment: Treatment) => {
    setTeethData((prev) => ({
      ...prev,
      [toothId]: {
        id: toothId,
        treatment,
        notes: prev[toothId]?.notes || "",
      },
    }))
  }

  const getToothColor = (toothId: string): string => {
    const tooth = teethData[toothId]
    return tooth ? treatmentColors[tooth.treatment] : treatmentColors.healthy
  }

  const ToothComponent = ({ tooth }: { tooth: (typeof currentTeeth)[0] }) => {
    const isSelected = selectedTooth === tooth.id
    const color = getToothColor(tooth.id)

    return (
      <div
        key={tooth.id}
        className={`
          relative cursor-pointer transition-all duration-200 hover:scale-110
          ${isSelected ? "ring-2 ring-primary ring-offset-2" : ""}
        `}
        style={{
          gridColumn: tooth.position.x + 1,
          gridRow: tooth.position.y + 1,
        }}
        onClick={() => setSelectedTooth(tooth.id)}
        title={`Diente ${tooth.id} - ${treatmentLabels[teethData[tooth.id]?.treatment || "healthy"]}`}
      >
        <div
          className="w-8 h-10 md:w-10 md:h-12 lg:w-12 lg:h-14 rounded-lg border-2 border-gray-300 flex items-center justify-center text-xs font-bold text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {tooth.id}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              {t("odontogram")}
              {selectedTooth && (
                <Badge variant="outline" className="ml-2">
                  Diente {selectedTooth}
                </Badge>
              )}
            </CardTitle>
            <Tabs value={odontogramType} onValueChange={(value) => setOdontogramType(value as "adult" | "child")}>
              <TabsList>
                <TabsTrigger value="adult">{t("adult")}</TabsTrigger>
                <TabsTrigger value="child">{t("child")}</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Odontogram Grid */}
          <div className="flex justify-center">
            <div
              className="grid gap-1 p-4 bg-muted/20 rounded-lg"
              style={{
                gridTemplateColumns: "repeat(16, 1fr)",
                gridTemplateRows: "repeat(3, 1fr)",
              }}
            >
              {currentTeeth.map((tooth) => (
                <ToothComponent key={tooth.id} tooth={tooth} />
              ))}
            </div>
          </div>

          {/* Treatment Selection */}
          {selectedTooth && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Diente {selectedTooth}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-medium mb-2">{t("select-treatment")}:</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {Object.entries(treatmentLabels).map(([treatment, label]) => (
                        <Button
                          key={treatment}
                          variant={selectedTreatment === treatment ? "default" : "outline"}
                          size="sm"
                          className="justify-start"
                          onClick={() => {
                            setSelectedTreatment(treatment as Treatment)
                            applyTreatment(selectedTooth, treatment as Treatment)
                          }}
                        >
                          <div
                            className="w-3 h-3 rounded mr-2"
                            style={{ backgroundColor: treatmentColors[treatment as Treatment] }}
                          />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Leyenda</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(treatmentLabels).map(([treatment, label]) => (
                  <div key={treatment} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: treatmentColors[treatment as Treatment] }}
                    />
                    <span className="text-sm">{label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Shortcuts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{t("keyboard-shortcuts")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">1</Badge>
                  <span>Sano</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">2</Badge>
                  <span>Caries</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">3</Badge>
                  <span>Empaste</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">4</Badge>
                  <span>Corona</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">5</Badge>
                  <span>Endodoncia</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">6</Badge>
                  <span>Extracción</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">7</Badge>
                  <span>Implante</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">8</Badge>
                  <span>Puente</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Selecciona un diente y usa las teclas numéricas para aplicar tratamientos rápidamente
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  )
}
