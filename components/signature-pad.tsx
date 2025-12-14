"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Eraser, Check, X } from "lucide-react"

interface SignaturePadProps {
  onSave: (dataUrl: string) => void
  onCancel: () => void
}

export function SignaturePad({ onSave, onCancel }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasSignature, setHasSignature] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.lineWidth = 2
        ctx.lineCap = "round"
        ctx.strokeStyle = "#000000"
      }
      
      // Set canvas size to match visual size for better resolution
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * 2 // Retina support
      canvas.height = rect.height * 2
      ctx?.scale(2, 2)
    }
    
    // Resize observer to handle window resizing
    const resizeObserver = new ResizeObserver(() => {
        if (canvasRef.current) {
            const canvas = canvasRef.current
            const rect = canvas.getBoundingClientRect()
            // Save current content? For complexity we might skip preserving on resize for now, 
            // or we could just set dimensions once on mount which is simpler for a modal.
            // Let's stick to mount dimensions or simple reset.
        }
    })
    
    if (canvasRef.current?.parentElement) {
        resizeObserver.observe(canvasRef.current.parentElement)
    }
    
    return () => resizeObserver.disconnect()
  }, [])

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.beginPath()
      ctx.moveTo(x, y)
      setIsDrawing(true)
    }
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return

    e.preventDefault() // Prevent scrolling on touch

    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY

    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top

    const ctx = canvas.getContext("2d")
    if (ctx) {
      ctx.lineTo(x, y)
      ctx.stroke()
      if (!hasSignature) setHasSignature(true)
    }
  }

  const stopDrawing = () => {
    setIsDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    if (canvas) {
      const ctx = canvas.getContext("2d")
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        setHasSignature(false)
      }
    }
  }

  const save = () => {
    const canvas = canvasRef.current
    if (canvas && hasSignature) {
      onSave(canvas.toDataURL("image/png"))
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-2 border-dashed rounded-lg bg-white touch-none" style={{ cursor: 'crosshair' }}>
        <canvas
          ref={canvasRef}
          className="w-full h-64 rounded-lg block"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
      </div>
      <div className="flex justify-between items-center text-sm text-muted-foreground px-1">
        <p>Dibuje su firma en el recuadro superior</p>
        <Button variant="ghost" size="sm" onClick={clear} disabled={!hasSignature}>
          <Eraser className="h-4 w-4 mr-2" />
          Limpiar
        </Button>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="h-4 w-4 mr-2" />
          Cancelar
        </Button>
        <Button onClick={save} disabled={!hasSignature}>
          <Check className="h-4 w-4 mr-2" />
          Confirmar Firma
        </Button>
      </div>
    </div>
  )
}
