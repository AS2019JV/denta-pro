import 'server-only'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { Readable } from 'node:stream'
import { storageOriginConfig } from './storage-origin-config.mjs'
import { privateMediaPath, type PrivateMediaBucket } from './private-media.mjs'
import { CLINICAL_MEDIA_LIMIT } from './clinical-media-limits.mjs'
import { env } from './env'

/** Header-signed S3 with session JWT/RLS. Only the backend sees the provider
 * request; the application repeats live human authorization before publication.
 */
export async function downloadStorageOrigin(bucket: PrivateMediaBucket, path: string, token: string, signal: AbortSignal): Promise<Response> {
  signal.throwIfAborted()
  if (privateMediaPath(path, bucket, env.NEXT_PUBLIC_SUPABASE_URL) !== path) throw new Error('Storage reference denied')
  const client = new S3Client(storageOriginConfig(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.CLINIA_STORAGE_REGION, token))
  let release = () => client.destroy()
  try {
    const object = await client.send(new GetObjectCommand({ Bucket: bucket, Key: path }), { abortSignal: signal })
    if (object.$metadata.httpStatusCode !== 200 || !(object.Body instanceof Readable)
      || !Number.isSafeInteger(object.ContentLength) || object.ContentLength! > CLINICAL_MEDIA_LIMIT || object.ContentLength! < 1) {
      if (object.Body instanceof Readable) object.Body.destroy()
      throw new Error('Storage bytes denied')
    }
    const body = object.Body
    const reader = (Readable.toWeb(body) as ReadableStream<Uint8Array>).getReader()
    let released = false, received = 0
    let abort = () => {}
    release = () => {
      if (released) return
      released = true
      signal.removeEventListener('abort', abort)
      // Explicit cleanup also covers streams configured not to emit close.
      void reader.cancel().catch(() => {})
      body.destroy()
      client.destroy()
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        abort = () => { controller.error(new Error('Storage request canceled')); release() }
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      },
      async pull(controller) {
        try {
          const { done, value } = await reader.read()
          if (released) return
          if (done) {
            if (received !== object.ContentLength) throw new Error('Storage bytes denied')
            controller.close()
            release()
            return
          }
          received += value.byteLength
          if (received > object.ContentLength! || received > CLINICAL_MEDIA_LIMIT) throw new Error('Storage bytes denied')
          controller.enqueue(value)
        } catch {
          if (!released) controller.error(new Error('Storage transport denied'))
          release()
        }
      },
      cancel() { release() },
    })
    return new Response(stream, {
      headers: { 'Content-Type': object.ContentType || 'application/octet-stream', 'Content-Length': String(object.ContentLength) },
    })
  } catch { release(); throw new Error('Storage transport denied') }
}
