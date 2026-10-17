import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { PrivateImageBucket } from './private-media-delivery.mjs'
import { downloadStorageOrigin } from './storage-origin'

/** Raw session credential is forwarded only after verified caller authority.
 * Supabase verifies it again and applies RLS on every S3 origin request.
 */
export async function downloadPrivateMedia(client: SupabaseClient, bucket: PrivateImageBucket, path: string, signal: AbortSignal, bearer: string | null): Promise<Response> {
  signal.throwIfAborted()
  const session = bearer ? null : await client.auth.getSession()
  signal.throwIfAborted()
  const token = bearer || session?.data.session?.access_token
  if (session?.error || !token) throw new Error('Image transport denied')
  return downloadStorageOrigin(bucket, path, token, signal)
}
