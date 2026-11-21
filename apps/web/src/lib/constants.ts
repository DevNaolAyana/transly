import type { BlockType, DocType, LangCode } from '../types'

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true'

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

export const MAX_FILE_BYTES = 10 * 1024 * 1024 // matches the storage bucket limit

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
