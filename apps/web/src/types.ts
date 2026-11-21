import type { Block, BlockType, DocType, LangCode, ReviewStatus } from '@shared/contract'

export type { Block, BlockType, DocType, LangCode, ReviewStatus }

// Response shapes documented as comments in shared/contract.ts.
export interface ExtractResponse {
  detectedLanguage: LangCode
  documentType: DocType
  blocks: Block[]
}
export interface TranslateResponse {
  blocks: Block[]
}
export interface ReserveRequest {
  documentId: string
  issuerName: string
  issuerPhone?: string
  reviewStatus: ReviewStatus
  isPublic: boolean
}
export interface ReserveResponse {
  verificationId: string
}
export interface CompleteResponse {
  status: 'issued'
  sha256: string
}
export interface ReviewRequestResponse {
  status: 'in_review'
}
export interface RevokeResponse {
  result: 'revoked'
}
export type VerifyResult = 'valid' | 'revoked' | 'not_found'
export interface VerifyResponse {
  result: VerifyResult
  issuerName?: string
  issuedAt?: string
  sourceLanguage?: LangCode
  targetLanguage?: LangCode
  documentType?: DocType
  reviewStatus?: ReviewStatus
  isPublic?: boolean
  pdfUrl?: string
}

// public.documents row (supabase/migrations/001_init.sql). Its status set differs
// from DocStatus in shared/contract.ts, so it is typed here.
export type DbDocStatus = 'uploaded' | 'extracted' | 'translated' | 'in_review' | 'reviewed' | 'issued'

export interface DocumentRecord {
  id: string
  ownerId: string
  storagePath: string
  sourceLang: LangCode
  targetLang: LangCode
  docType: DocType | null
  status: DbDocStatus
  blocksOriginal: Block[] | null
  blocksTranslated: Block[] | null
  createdAt: string
}

export type Role = 'customer' | 'translator'

export interface AuthUser {
  id: string
  email: string
}
