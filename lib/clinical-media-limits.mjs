// Browser-safe plaintext bound. Leaves room below the hosted 4.5 MB payload
// limit for request metadata and the server's encrypted object envelope.
export const CLINICAL_MEDIA_LIMIT = 4_000_000
export const CLINICAL_MEDIA_LIMIT_LABEL = '4 MB'
export const CLINICAL_IMAGE_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/webp'])
