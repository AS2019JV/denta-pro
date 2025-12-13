"use client"

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  FileText, 
  Upload, 
  X, 
  File, 
  Image as ImageIcon, 
  Paperclip, 
  Calendar,
  Send,
  Trash2,
  Download
} from "lucide-react"

interface FileItem {
  id: string
  name: string
  size: string
  type: string
  date: string
  url?: string
}

interface NoteItem {
  id: string
  content: string
  date: string
  author: string
}

type TimelineItem = 
  | { type: 'file', data: FileItem }
  | { type: 'note', data: NoteItem }

export function PatientFiles() {
  const [files, setFiles] = useState<FileItem[]>([
    { id: '1', name: 'Radiografía Panorámica.jpg', size: '2.4 MB', type: 'image/jpeg', date: '2023-10-15T10:30:00' },
    { id: '2', name: 'Consentimiento Informado.pdf', size: '156 KB', type: 'application/pdf', date: '2023-10-15T10:35:00' },
    { id: '3', name: 'Foto Intraoral 1.jpg', size: '1.2 MB', type: 'image/jpeg', date: '2023-11-02T14:20:00' },
  ])

  const [notes, setNotes] = useState<NoteItem[]>([
    { id: '1', content: 'Paciente reporta sensibilidad en el diente 24.', date: '2023-11-02T14:25:00', author: 'Dr. Smith' }
  ])

  const [newNote, setNewNote] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    // Simulate file upload
    const droppedFiles = Array.from(e.dataTransfer.files)
    const newFileItems: FileItem[] = droppedFiles.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      name: file.name,
      size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      type: file.type,
      date: new Date().toISOString()
    }))

    setFiles(prev => [...prev, ...newFileItems])
  }

  const handleAddNote = () => {
    if (!newNote.trim()) return
    
    const note: NoteItem = {
      id: `note-${Date.now()}`,
      content: newNote,
      date: new Date().toISOString(),
      author: 'Dr. Actual' // Replace with logged in user
    }
    
    setNotes(prev => [...prev, note])
    setNewNote("")
  }

  const timelineItems: TimelineItem[] = [
    ...files.map(f => ({ type: 'file' as const, data: f })),
    ...notes.map(n => ({ type: 'note' as const, data: n }))
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* File Upload Area */}
      <Card className={`border-2 border-dashed transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}>
        <CardContent 
          className="flex flex-col items-center justify-center py-10"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Arrastra archivos aquí</h3>
          <p className="text-sm text-muted-foreground mb-4">o haz clic para buscar en tu ordenador</p>
          <Button variant="outline">Seleccionar Archivos</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Files Grid */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Paperclip className="h-5 w-5" />
                Archivos Recientes
                <Badge variant="secondary">{files.length}</Badge>
              </h3>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {files.map((file) => (
                <Card key={file.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-start space-x-4">
                    <div className="p-2 rounded bg-muted">
                      {file.type.includes('image') ? (
                        <ImageIcon className="h-8 w-8 text-blue-500" />
                      ) : file.type.includes('pdf') ? (
                          <FileText className="h-8 w-8 text-red-500" />
                      ) : (
                          <File className="h-8 w-8 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate" title={file.name}>{file.name}</p>
                      <div className="flex items-center text-xs text-muted-foreground mt-1">
                        <span>{file.size}</span>
                        <span className="mx-1">•</span>
                        <span>{new Date(file.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
           </div>
        </div>

        {/* Right Column: Timeline & Notes */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Línea de Tiempo
              </CardTitle>
              <CardDescription>Actividad y Notas</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-[400px]">
              {/* Add Note Input */}
              <div className="flex gap-2 mb-6">
                <Input 
                  placeholder="Agregar una nota rápida..." 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                />
                <Button size="icon" onClick={handleAddNote}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Timeline */}
              <ScrollArea className="flex-1 pr-4 -mr-4">
                <div className="relative pl-6 border-l space-y-6">
                  {timelineItems.map((item, index) => (
                    <div key={index} className="relative">
                      {/* Dot */}
                      <div className={`absolute -left-[29px] top-1 h-3 w-3 rounded-full border-2 border-background ${item.type === 'file' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                      
                      <div className="flex flex-col space-y-1">
                        <span className="text-xs text-muted-foreground">
                          {new Date(item.data.date).toLocaleString()}
                        </span>
                        
                        {item.type === 'note' ? (
                          <div className="bg-muted/50 p-3 rounded-lg text-sm">
                            <p>{item.data.content}</p>
                            <span className="text-xs font-semibold text-muted-foreground mt-2 block">- {item.data.author}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm font-medium">
                            <span className="text-blue-500">Archivo subido:</span>
                            {item.data.name}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
