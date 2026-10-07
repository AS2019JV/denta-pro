export function storageOriginConfig(providerOrigin: string, anonKey: string, region: string | undefined, token: string): {
  endpoint: string; region: string; forcePathStyle: boolean; maxAttempts: number
  credentials: { accessKeyId: string; secretAccessKey: string; sessionToken: string }
}
