import type { BlockType, DocType, LangCode } from '@shared/contract'

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'
export const DEMO_PRICE_ETB = Number(import.meta.env.VITE_DEMO_PRICE_ETB) || 100
export const REQUIRE_PAYMENT = import.meta.env.VITE_REQUIRE_PAYMENT === 'true'

export const LANGUAGES: { code: LangCode; label: string; native: string }[] = [
  { code: 'om', label: 'Afaan Oromo', native: 'Afaan Oromoo' },
  { code: 'am', label: 'Amharic', native: 'አማርኛ' },
  { code: 'en', label: 'English', native: 'English' },
]

export const langLabel = (c?: LangCode | null) => LANGUAGES.find((l) => l.code === c)?.label ?? c ?? '—'

export const DOC_TYPES: { value: DocType; label: string }[] = [
  { value: 'academic', label: 'Academic (transcript, diploma)' },
  { value: 'id_certificate', label: 'ID / certificate' },
  { value: 'legal', label: 'Legal' },
  { value: 'other', label: 'Other' },
]

export const docTypeLabel = (t?: DocType | null) => DOC_TYPES.find((d) => d.value === t)?.label ?? t ?? '—'

// What we upload must be under 8 MB (the storage bucket limit is 10 MB; this leaves headroom).
export const MAX_FILE_BYTES = 8 * 1024 * 1024
// Photos are shrunk in the browser before upload, so the *input* may be bigger (limited by decode memory).
export const MAX_IMAGE_INPUT_BYTES = 40 * 1024 * 1024
export const IMAGE_MAX_SIDE = 2000
export const IMAGE_JPEG_QUALITY = 0.85

export const BLOCK_TYPE_LABEL: Record<BlockType, string> = {
  heading: 'Heading',
  paragraph: 'Paragraph',
  table_row: 'Table row',
  list_item: 'List item',
  stamp: 'Stamp',
  signature: 'Signature',
  logo: 'Logo',
  handwriting: 'Handwriting',
}

/** Non-text elements: never translated or faked, rendered as a placeholder line. */
export const NON_TEXT_TYPES: BlockType[] = ['stamp', 'signature', 'logo', 'handwriting']

export const NON_TEXT_PLACEHOLDER: Record<string, string> = {
  stamp: '[Stamp present in original]',
  signature: '[Signature present in original]',
  logo: '[Logo present in original]',
  handwriting: '[Handwriting present in original]',
}
