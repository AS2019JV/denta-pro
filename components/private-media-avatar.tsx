"use client"

import type { ComponentProps } from 'react'
import { AvatarImage } from '@/components/ui/avatar'
import { usePrivateMediaUrl } from '@/hooks/use-private-media'
import type { PrivateImageKind } from '@/lib/private-media-delivery.mjs'

export function PrivateMediaAvatar({ kind, entityId, reference, ...props }: Omit<ComponentProps<typeof AvatarImage>, 'src'> & {
  kind: PrivateImageKind; entityId: string; reference: string | null | undefined
}) {
  const url = usePrivateMediaUrl(kind, entityId, reference)
  return <AvatarImage {...props} src={url || undefined} />
}
