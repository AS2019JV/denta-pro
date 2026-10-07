import { CLINICAL_IMAGE_TYPES } from './clinical-media-limits.mjs'
// Only declared raster media with the corresponding file signature may render.
// SVG/HTML and unknown types never become a same-origin inline response.
export function privateImageMime(bytes, declared) {
  const mime = String(declared || '').split(';')[0].trim().toLowerCase()
  if (!CLINICAL_IMAGE_TYPES.includes(mime)) return null
  if (mime === 'image/png' && bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) return mime
  if (mime === 'image/jpeg' && bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return mime
  if (mime === 'image/webp' && bytes.length >= 12 && String.fromCharCode(...bytes.subarray(0,4)) === 'RIFF'
    && String.fromCharCode(...bytes.subarray(8,12)) === 'WEBP') return mime
  return null
}
