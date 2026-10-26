// Storage v1.78+ accepts the public project ref as SigV4 signing material.
// The provider still verifies the session JWT and applies RLS on every request.
// Never use generated S3 keys (they bypass RLS), presigned URLs or REST fallback.
export function storageOriginConfig(providerOrigin, region, token) {
  const url = new URL(providerOrigin)
  const project = /^([a-z]{20})\.supabase\.co$/.exec(url.hostname)?.[1]
  if (!project || url.protocol !== 'https:' || url.port || url.username || url.password
    || url.pathname !== '/' || url.search || url.hash) throw new Error('Storage origin configuration invalid')
  if (typeof region !== 'string' || !/^[a-z]{2}(?:-[a-z]+)+-\d$/.test(region)) throw new Error('Storage region configuration invalid')
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) throw new Error('Storage session absent')
  return {
    endpoint: `https://${project}.storage.supabase.co/storage/v1/s3`, region,
    forcePathStyle: true, maxAttempts: 1,
    credentials: { accessKeyId: project, secretAccessKey: project, sessionToken: token },
  }
}
