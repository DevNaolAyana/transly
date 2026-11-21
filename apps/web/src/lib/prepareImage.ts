import { IMAGE_JPEG_QUALITY, IMAGE_MAX_SIDE, MAX_FILE_BYTES } from './constants'
import type { FileKind } from './validateFile'

export interface PreparedFile {
  /** The file to upload (a JPEG for photos, the untouched file for PDFs). */
  file: File
  originalBytes: number
  finalBytes: number
  /** Pixel size before / after (images only). */
  from?: { w: number; h: number }
  to?: { w: number; h: number }
  /** True when the image was re-encoded (always for JPG/PNG photos). */
  reencoded: boolean
}

const mb = (n: number) => (n / 1048576).toFixed(1)

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Shrink a photo in the browser before upload: longest side at most IMAGE_MAX_SIDE px,
 * JPEG at about 0.85 quality, EXIF rotation applied (imageOrientation 'from-image') so the
 * picture is upright for the server. PDFs are returned unchanged.
 * Throws an Error with a clear message if the result is still over MAX_FILE_BYTES.
 */
export async function prepareFile(file: File, kind: FileKind): Promise<PreparedFile> {
  if (kind === 'pdf') {
    if (file.size > MAX_FILE_BYTES) {
      throw new Error(`This PDF is ${mb(file.size)} MB. The maximum is ${mb(MAX_FILE_BYTES)} MB.`)
    }
    return { file, originalBytes: file.size, finalBytes: file.size, reencoded: false }
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    throw new Error('This picture could not be read. It may be damaged. Try taking the photo again.')
  }
  try {
    const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Your browser could not prepare the picture. Try another browser.')
    ctx.fillStyle = '#ffffff' // JPEG has no transparency (PNG scans with transparent areas)
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await toBlob(canvas, IMAGE_JPEG_QUALITY)
    if (!blob) throw new Error('Your browser could not prepare the picture. Try another browser.')
    if (blob.size > MAX_FILE_BYTES) {
      throw new Error(
        `This picture is still ${mb(blob.size)} MB after shrinking. The maximum is ${mb(MAX_FILE_BYTES)} MB. Try a simpler photo, or take it again.`,
      )
    }
    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return {
      file: new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() }),
      originalBytes: file.size,
      finalBytes: blob.size,
      from: { w: bitmap.width, h: bitmap.height },
      to: { w, h },
      reencoded: true,
    }
  } finally {
    bitmap.close()
  }
}
