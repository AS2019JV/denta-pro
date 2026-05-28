"use client"

import React, { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { 
  FileText, 
  Upload, 
  File, 
  Image as ImageIcon, 
  Paperclip, 
  Calendar,
  Send,
  Trash2,
  Download,
  Loader2
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { toast } from "sonner"

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

interface PatientFilesProps {
  patientId: string
  onFilesChange?: () => void
}

export function PatientFiles({ patientId, onFilesChange }: PatientFilesProps) {
  const { user, currentClinicId } = useAuth()
  const [files, setFiles] = useState<FileItem[]>([])
  const [notes, setNotes] = useState<NoteItem[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(true)
  const [isLoadingNotes, setIsLoadingNotes] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  // 1. Fetch Files from Supabase
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoadingFiles(true)
      const { data, error } = await supabase
        .from('patient_files')
        .select('*')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mappedFiles: FileItem[] = (data || []).map(f => {
        // Get public URL from storage
        const { data: urlData } = supabase.storage
          .from('patient-files')
          .getPublicUrl(f.file_path)

        return {
          id: f.id,
          name: f.name,
          size: f.size,
          type: f.type,
          date: f.created_at,
          url: urlData?.publicUrl
        }
      })

      setFiles(mappedFiles)
    } catch (e: any) {
      console.error("Error fetching patient files:", e)
      toast.error(`Error al cargar archivos: ${e.message}`)
    } finally {
      setIsLoadingFiles(false)
    }
  }, [patientId])

  // 2. Fetch Notes from Supabase
  const fetchNotes = useCallback(async () => {
    try {
      setIsLoadingNotes(true)
      const { data, error } = await supabase
        .from('patient_notes')
        .select('*, author:profiles(full_name)')
        .eq('patient_id', patientId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      if (error) throw error

      const mappedNotes: NoteItem[] = (data || []).map(n => ({
        id: n.id,
        content: n.content,
        date: n.created_at,
        author: n.author?.full_name || 'Personal Médico'
      }))

      setNotes(mappedNotes)
    } catch (e: any) {
      console.error("Error fetching patient notes:", e)
    } finally {
      setIsLoadingNotes(false)
    }
  }, [patientId])

  useEffect(() => {
    if (patientId) {
      fetchFiles()
      fetchNotes()
    }
  }, [patientId, fetchFiles, fetchNotes])

  // 3. File Upload handler
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files
    if (!selectedFiles || selectedFiles.length === 0) return

    await uploadFilesBatch(Array.from(selectedFiles))
  }

  const uploadFilesBatch = async (filesToUpload: File[]) => {
    if (!currentClinicId || !user?.id) {
      toast.error("Datos de sesión no válidos para subir archivos.")
      return
    }

    try {
      setUploading(true)
      toast.info(`Iniciando subida de ${filesToUpload.length} archivos...`)

      for (const file of filesToUpload) {
        const fileExt = file.name.split('.').pop() || 'bin'
        const fileExtClean = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '')
        const filePath = `${patientId}/${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExtClean}`

        // A. Upload to storage bucket
        const { error: uploadError } = await supabase.storage
          .from('patient-files')
          .upload(filePath, file, {
            upsert: true,
            contentType: file.type
          })

        if (uploadError) throw uploadError

        // B. Log record in DB
        const { error: dbError } = await supabase
          .from('patient_files')
          .insert({
            patient_id: patientId,
            clinic_id: currentClinicId,
            name: file.name,
            file_path: filePath,
            size: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
            type: file.type,
            uploaded_by: user.id
          })

        if (dbError) throw dbError
      }

      toast.success("Archivos subidos y registrados con éxito")
      fetchFiles()
      if (onFilesChange) onFilesChange()
    } catch (e: any) {
      console.error("Error uploading patient files:", e)
      toast.error(`Error al subir: ${e.message || 'Error desconocido'}`)
    } finally {
      setUploading(false)
    }
  }

  // 4. File Deletion (Soft Delete)
  const handleDeleteFile = async (fileId: string) => {
    try {
      const { error } = await supabase
        .from('patient_files')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', fileId)

      if (error) throw error

      toast.success("Archivo eliminado correctamente")
      setFiles(prev => prev.filter(f => f.id !== fileId))
      if (onFilesChange) onFilesChange()
    } catch (e: any) {
      console.error("Error deleting file:", e)
      toast.error(`Error al eliminar: ${e.message}`)
    }
  }

  // 5. Add Note handler
  const handleAddNote = async () => {
    if (!newNote.trim() || !currentClinicId || !user?.id) return

    try {
      const { error } = await supabase
        .from('patient_notes')
        .insert({
          patient_id: patientId,
          clinic_id: currentClinicId,
          content: newNote.trim(),
          author_id: user.id
        })

      if (error) throw error

      toast.success("Nota agregada correctamente")
      setNewNote("")
      fetchNotes()
    } catch (e: any) {
      console.error("Error adding patient note:", e)
      toast.error(`Error al guardar nota: ${e.message}`)
    }
  }

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFiles = Array.from(e.dataTransfer.files)
    if (droppedFiles.length > 0) {
      await uploadFilesBatch(droppedFiles)
    }
  }

  // Combine files and notes for the timeline feed
  const timelineItems: TimelineItem[] = [
    ...files.map(f => ({ type: 'file' as const, data: f })),
    ...notes.map(n => ({ type: 'note' as const, data: n }))
  ].sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime())

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* File Upload Area */}
      <Card className={`border-2 border-dashed transition-all duration-300 ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-muted-foreground/25'}`}>
        <CardContent 
          className="flex flex-col items-center justify-center py-10 relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {uploading && (
            <div className="absolute inset-0 bg-background/70 z-20 flex flex-col items-center justify-center rounded-xl">
               <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
               <p className="text-sm font-semibold text-foreground">Procesando archivos...</p>
            </div>
          )}

          <div className="p-4 rounded-full bg-primary/10 mb-4">
            <Upload className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Arrastra archivos aquí</h3>
          <p className="text-sm text-muted-foreground mb-4">o haz clic para buscar en tu ordenador</p>
          
          <label className="cursor-pointer">
            <div className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 h-9 px-4 py-2 shadow-sm">
              Seleccionar Archivos
            </div>
            <input 
              type="file" 
              multiple 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Files Grid */}
        <div className="lg:col-span-2 space-y-6">
           <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Paperclip className="h-5 w-5 text-slate-400" />
                Archivos del Paciente
                <Badge variant="secondary" className="font-bold">{files.length}</Badge>
              </h3>
           </div>

           {isLoadingFiles ? (
              <div className="py-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
           ) : files.length === 0 ? (
              <Card className="border-border/50 bg-muted/20">
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  Ningún archivo subido para este paciente todavía.
                </CardContent>
              </Card>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {files.map((file) => (
                   <Card key={file.id} className="group hover:shadow-md hover:border-primary/20 transition-all duration-300">
                     <CardContent className="p-4 flex items-start space-x-4">
                       <div className="p-2 rounded bg-muted flex-none">
                         {file.type.includes('image') ? (
                           <ImageIcon className="h-8 w-8 text-blue-500" />
                         ) : file.type.includes('pdf') ? (
                             <FileText className="h-8 w-8 text-red-500" />
                         ) : (
                             <File className="h-8 w-8 text-slate-500" />
                         )}
                       </div>
                       <div className="flex-1 min-w-0">
                         <p className="font-medium text-sm text-foreground truncate" title={file.name}>{file.name}</p>
                         <div className="flex items-center text-[10px] text-muted-foreground mt-1 gap-1">
                           <span>{file.size}</span>
                           <span>•</span>
                           <span>{new Date(file.date).toLocaleDateString("es-ES")}</span>
                         </div>
                       </div>
                       <div className="flex items-center gap-1.5 flex-none">
                         {file.url && (
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-slate-50"
                             onClick={() => window.open(file.url, '_blank')}
                           >
                             <Download className="h-4 w-4" />
                           </Button>
                         )}
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="h-7 w-7 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                           onClick={() => handleDeleteFile(file.id)}
                         >
                           <Trash2 className="h-4 w-4" />
                         </Button>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
              </div>
           )}
        </div>

        {/* Right Column: Timeline & Notes */}
        <div className="space-y-6">
          <Card className="h-full flex flex-col border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-foreground font-semibold">
                <Calendar className="h-5 w-5 text-slate-400" />
                Historial de Archivos y Notas
              </CardTitle>
              <CardDescription className="text-xs">Línea de tiempo de notas administrativas e imágenes</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-[400px]">
              {/* Add Note Input */}
              <div className="flex gap-2 mb-6">
                <Input 
                  placeholder="Agregar una nota rápida..." 
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  className="h-9 focus-visible:ring-primary/20"
                />
                <Button size="icon" className="h-9 w-9" onClick={handleAddNote}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              {/* Timeline */}
              {isLoadingNotes ? (
                 <div className="py-8 text-center"><Loader2 className="h-5 w-5 animate-spin mx-auto text-primary" /></div>
              ) : timelineItems.length === 0 ? (
                 <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs italic py-8">
                   Sin actividad registrada.
                 </div>
              ) : (
                 <ScrollArea className="flex-1 pr-4 -mr-4 max-h-[350px]">
                   <div className="relative pl-6 border-l border-slate-100 space-y-6">
                     {timelineItems.map((item, index) => (
                       <div key={index} className="relative group">
                         {/* Dot */}
                         <div className={`absolute -left-[31px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-background ${item.type === 'file' ? 'bg-blue-500' : 'bg-orange-500'}`} />
                         
                         <div className="flex flex-col space-y-1">
                           <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                             {new Date(item.data.date).toLocaleString("es-ES", { dateStyle: 'short', timeStyle: 'short' })}
                           </span>
                           
                           {item.type === 'note' ? (
                             <div className="bg-muted/40 p-3 rounded-lg text-sm border border-border/10">
                               <p className="text-foreground leading-relaxed font-normal">{item.data.content}</p>
                               <span className="text-[10px] font-bold text-muted-foreground mt-2 block uppercase tracking-wider">— {item.data.author}</span>
                             </div>
                           ) : (
                             <div className="flex items-center gap-2 text-sm font-medium text-slate-700 bg-blue-50/30 p-2.5 rounded-lg border border-blue-50">
                               <Paperclip className="h-3.5 w-3.5 text-blue-500 flex-none" />
                               <span className="truncate flex-1 font-semibold" title={item.data.name}>{item.data.name}</span>
                             </div>
                           )}
                         </div>
                       </div>
                     ))}
                   </div>
                 </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
