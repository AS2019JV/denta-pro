"use client"

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-context'
import { supabase } from '@/lib/supabase'
import { PRIVATE_MEDIA_TTL, resolvePrivateMedia, type PrivateMediaBucket } from '@/lib/private-media.mjs'

export function usePrivateMediaUrl(bucket: PrivateMediaBucket, raw: string | null | undefined) {
  const { user, currentClinicId, isLoading, isRevalidating, authError } = useAuth()
  const scope = !isLoading && !isRevalidating && !authError && user?.id && currentClinicId
    ? `${user.id}:${currentClinicId}:${user.role}` : ''
  const key = JSON.stringify([scope, bucket, raw])
  const publication = useRef({ key, valid: true })
  if (publication.current.key !== key) {
    publication.current.valid = false
    publication.current = { key, valid: true }
  }
  const [result, setResult] = useState<{ token: typeof publication.current; url: string | null } | null>(null)
  useEffect(() => {
    const token = publication.current
    token.valid = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const current = () => token.valid && !!scope && publication.current === token
    async function load() {
      const url = await resolvePrivateMedia(supabase, bucket, raw, process.env.NEXT_PUBLIC_SUPABASE_URL, current)
      if (!current()) return
      setResult({ token, url })
      if (url) timer = setTimeout(() => { void load() }, (PRIVATE_MEDIA_TTL - 60) * 1000)
    }
    if (scope && raw) void load()
    return () => { token.valid = false; if (timer) clearTimeout(timer) }
  }, [key, scope, bucket, raw])
  return scope && result?.token === publication.current && result.token.valid ? result.url : null
}
