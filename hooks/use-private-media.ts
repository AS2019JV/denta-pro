"use client"

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/auth-context'
import { fetchPrivateMedia } from '@/lib/private-media-client.mjs'
import type { PrivateImageKind } from '@/lib/private-media-delivery.mjs'

// The reference only invalidates the UI after an entity update. The request
// contains entity IDs; the server resolves the registered current object.
export function usePrivateMediaUrl(kind: PrivateImageKind, entityId: string | null | undefined, reference: string | null | undefined) {
  const { user, currentClinicId, isLoading, isRevalidating, authError } = useAuth()
  const scope = !isLoading && !isRevalidating && !authError && user?.id && currentClinicId
    ? `${user.id}:${currentClinicId}:${user.role}` : ''
  const key = JSON.stringify([scope, kind, entityId, reference])
  const publication = useRef({ key, valid: true })
  if (publication.current.key !== key) {
    publication.current.valid = false
    publication.current = { key, valid: true }
  }
  const [result, setResult] = useState<{ token: typeof publication.current; url: string | null } | null>(null)
  useEffect(() => {
    const token = publication.current, controller = new AbortController()
    token.valid = true
    let ownedUrl: string | null = null, timer: ReturnType<typeof setTimeout> | undefined
    const current = () => token.valid && !!scope && publication.current === token && !controller.signal.aborted
    function clearUrl() { if (ownedUrl) URL.revokeObjectURL(ownedUrl); ownedUrl = null }
    async function load() {
      try {
        if (!currentClinicId || !entityId) return
        const blob = await fetchPrivateMedia({ kind, clinicId: currentClinicId, entityId }, controller.signal, current)
        if (!current()) return
        clearUrl()
        ownedUrl = blob ? URL.createObjectURL(blob) : null
        setResult({ token, url: ownedUrl })
        if (ownedUrl) timer = setTimeout(() => { void load() }, 60000)
      } catch {
        if (current()) { clearUrl(); setResult({ token, url: null }) }
      }
    }
    if (scope && entityId && reference) void load()
    return () => { token.valid = false; controller.abort(); if (timer) clearTimeout(timer); clearUrl() }
  }, [key, scope, kind, entityId, reference, currentClinicId])
  return scope && result?.token === publication.current && result.token.valid ? result.url : null
}
