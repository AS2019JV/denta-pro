import type { PrivateImageScope } from './private-media-delivery.mjs'
export function fetchPrivateMedia(scope: PrivateImageScope, signal: AbortSignal, isCurrent: () => boolean, fetcher?: typeof fetch): Promise<Blob | null>
