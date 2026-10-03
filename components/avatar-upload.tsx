"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/components/auth-context"
import { usePrivateMediaUrl } from "@/hooks/use-private-media"
import { privateMediaUploadPath } from "@/lib/private-media.mjs"
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
  clinicId?: string
}

export function AvatarUpload({ 
  uid, 
  url, 
  size = 128, 
  onUpload, 
  bucket,
  editable = true,
  fallbackName = "",
  clinicId
}: AvatarUploadProps) {
  const { user, currentClinicId, isLoading, isRevalidating, authError } = useAuth()
  const authority = !isLoading && !isRevalidating && !authError && user?.id && currentClinicId
    ? `${user.id}:${currentClinicId}:${user.role}:${uid}:${bucket}:${url}` : ''
  const currentAuthority = useRef(authority)
  currentAuthority.current = authority
  const publication = useRef({ authority, valid: true })
  if (publication.current.authority !== authority) {
    publication.current.valid = false
    publication.current = { authority, valid: true }
  }
  const [uploaded, setUploaded] = useState<{ authority: string; path: string } | null>(null)
  const avatarUrl = usePrivateMediaUrl(bucket, uploaded?.authority === authority ? uploaded.path : url)
  const [uploadAuthority, setUploadAuthority] = useState<string | null>(null)
  const uploading = !!authority && uploadAuthority === authority
  useEffect(() => {
    const token = publication.current
    token.valid = true
    currentAuthority.current = authority
    return () => { token.valid = false; currentAuthority.current = '' }
  }, [authority])

  async function uploadAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const captured = authority
    const token = publication.current
    const current = () => token.valid && !!captured && currentAuthority.current === captured
    if (!editable || !current()) return
    try {
      setUploadAuthority(captured)

      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('Debe seleccionar una imagen para subir.')
      }

      const file = event.target.files[0]
      const originalExt = file.name.split('.').pop() || 'png'
      const fileExt = originalExt.toLowerCase().replace(/[^a-z0-9]/g, '')
      
      const filePath = privateMediaUploadPath(bucket, uid, clinicId, `${crypto.randomUUID()}.${fileExt || 'png'}`)

      const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, file, {
        upsert: false,
        contentType: file.type
      })

      if (uploadError) {
        throw uploadError
      }

      if (!current()) return
      setUploaded({ authority: captured, path: filePath })
      onUpload(filePath)
      
      toast.success("Imagen subida correctamente")
    } catch (error: any) {
      if (current()) toast.error(`Error al subir imagen: ${error.message || 'Error desconocido'}`)
    } finally {
      if (current()) setUploadAuthority(null)
    }
  }

  return (
    <div className="relative group" style={{ width: size, height: size }}>
      <Avatar className="w-full h-full border-4 border-background shadow-md">
        <AvatarImage 
          src={avatarUrl || ""} 
          className="object-cover" 
        />
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
              disabled={uploading || !authority}
              className="hidden"
            />
          </label>
        </div>
      )}
    </div>
  )
}
