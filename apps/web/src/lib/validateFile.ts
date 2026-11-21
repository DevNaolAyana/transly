import { MAX_FILE_BYTES, MAX_IMAGE_INPUT_BYTES } from './constants'

export type FileKind = 'pdf' | 'jpg' | 'png'

export interface FileCheck {
  ok: boolean
  error?: string
  kind?: FileKind
}

const mb = (n: number) => (n / 1048576).toFixed(1)

/** Detect the real type from the first bytes, not just the extension/MIME the browser reports. */
async function sniff(file: File): Promise<FileKind | null> {
  const b = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return 'pdf' // %PDF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png'
  return null
}

/**
 * First check on the picked file. Photos may be large here because they are shrunk
 * afterwards (see prepareImage.ts, which enforces the final 8 MB limit). PDFs are uploaded as they are.
 */
export async function validateFile(file: File): Promise<FileCheck> {
  if (file.size === 0) return { ok: false, error: 'This file is empty.' }
  const kind = await sniff(file)
  if (!kind) {
    return {
      ok: false,
      error: 'Unsupported file. Please upload a JPG, PNG or PDF. (Other formats such as HEIC, WEBP or Word files are not supported.)',
    }
  }
  if (kind === 'pdf' && file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      error: `This PDF is ${mb(file.size)} MB. The maximum for a PDF is ${mb(MAX_FILE_BYTES)} MB. Use a smaller PDF, or take a photo of the page instead.`,
    }
  }
  if (kind !== 'pdf' && file.size > MAX_IMAGE_INPUT_BYTES) {
    return { ok: false, error: `This picture is ${mb(file.size)} MB, which is too large to process. Take the photo again at a lower resolution.` }
  }
  return { ok: true, kind }
}
