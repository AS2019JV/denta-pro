"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2, Camera, User } from "lucide-react"
import { toast } from "sonner"

interface AvatarUploadProps {
  uid: string
  url: string | null
  size?: number
  onUpload: (url: string) => void
  bucket: "doctor-avatars" | "patient-avatars" | "clinic-branding"
  editable?: boolean
  fallbackName?: string
}

export function AvatarUpload({ 
  uid, 
  url, 
  size = 128, 
  onUpload, 
  bucket,
  editable = true,
  fallbackName = ""
}: AvatarUploadProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (url) {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        setAvatarUrl(url)
      } else {
        const { data } = supabase.storage.from(bucket).getPublicUrl(url)
        setAvatarUrl(data.publicUrl)
      }
    } else {
      setAvatarUrl(null)
    }
  }, [url, bucket])

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    try {
      setUploading(true)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debe seleccionar una imagen para subir.')
      }

      const file = event.target.files[0]
      const originalExt = file.name.split('.').pop() || 'png'
      const fileExt = originalExt.toLowerCase().replace(/[^a-z0-9]/g, '')
      const filePath = bucket === "clinic-branding"
        ? `${uid}/${uid}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`
        : `${uid}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
        upsert: true,
        contentType: file.type
      })

      if (uploadError) {
        throw uploadError
      }

      onUpload(filePath)
      
      // Refresh the view
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath)
      setAvatarUrl(data.publicUrl)
      
      toast.success("Imagen subida correctamente")
    } catch (error: any) {
      toast.error(`Error al subir imagen: ${error.message || 'Error desconocido'}`)
      console.error(error)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      <Avatar className="w-full h-full border-4 border-background shadow-md">
        <AvatarImage src={avatarUrl || ""} className="object-cover" />
        <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
            {fallbackName ? (
                <>
                    {fallbackName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </>
            ) : <User className="h-10 w-10" />}
        </AvatarFallback>
      </Avatar>
      
      {editable && (
        <div className="absolute -bottom-1 -right-1">
          <label htmlFor={`avatar-upload-${uid}`} className="cursor-pointer">
            <div className="bg-primary hover:bg-primary/90 text-primary-foreground p-2 rounded-full shadow-lg transition-colors border-2 border-background">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </div>
            <input
              id={`avatar-upload-${uid}`}
              type="file"
              accept="image/*"
              onChange={uploadAvatar}
              disabled={uploading}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  )
}
