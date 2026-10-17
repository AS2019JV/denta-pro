export const DOCUMENT_LIMIT: number
export const DOCUMENT_HEADERS: Readonly<Record<string, string>>
export function boundedBytes(stream: ReadableStream<Uint8Array> | null, limit: number, signal: AbortSignal): Promise<Uint8Array>
export type DocumentScope = { fileId: string; clinicId: string; patientId: string }
export type DocumentAuthority = { path: string; name: string; userId: string; sessionId: string }
export function documentDeliveryHandler(dependencies: {
  appOrigin: string; providerOrigin: string
  authority(request: Request, bearer: string | null, signal: AbortSignal): Promise<{ authorize(scope: DocumentScope): Promise<DocumentAuthority | null> }>
  download(path: string, signal: AbortSignal): Promise<Response>
  deliveryActive(signal: AbortSignal): Promise<boolean>
  recordAccess(scope: DocumentScope, path: string, signal: AbortSignal): Promise<boolean>
}): (request: Request) => Promise<Response>
