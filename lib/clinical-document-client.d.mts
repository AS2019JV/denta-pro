export function fetchClinicalDocument(scope: { clinicId: string; patientId: string; fileId: string }, signal: AbortSignal,
  isCurrent: () => boolean, fetcher?: typeof fetch): Promise<Blob | null>
