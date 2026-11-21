// App-only types. Everything that crosses the API (request/response bodies, DocStatus,
// Block, VerifyResult, ...) lives in shared/contract.ts and is imported from '@shared/contract'.
import type { Block, DocStatus, DocType, LangCode } from '@shared/contract'

/** A row of public.documents as the UI uses it (mapped from the database columns). */
export interface DocumentRecord {
  id: string
  ownerId: string
  storagePath: string
  sourceLang: LangCode
  targetLang: LangCode
  docType: DocType | null
  status: DocStatus
  blocksOriginal: Block[] | null
  blocksTranslated: Block[] | null
  createdAt: string
}

export type Role = 'customer' | 'translator'

export interface AuthUser {
  id: string
  email: string
}
