// SHARED CONTRACT. Only the project lead changes this file.
export type LangCode = 'om' | 'am' | 'en';
export type DocType = 'academic' | 'id_certificate' | 'legal' | 'other';
export type BlockType = 'heading' | 'paragraph' | 'table_row' | 'list_item'
  | 'stamp' | 'signature' | 'logo' | 'handwriting';
export interface Block { id: string; type: BlockType; text: string }
export type ReviewStatus = 'machine' | 'human_reviewed';
export type DocStatus = 'draft' | 'in_review' | 'issued' | 'revoked';

// All calls: header "Authorization: Bearer <supabase access token>"
// POST /api/extract   { documentId, sourceLanguage?: LangCode }
//   -> { detectedLanguage: LangCode, documentType: DocType, blocks: Block[] }
// POST /api/translate { documentId, sourceLanguage, targetLanguage, blocks: Block[] }
//   -> { blocks: Block[] }   (same ids, order, count, types)
// POST /api/review/request { documentId, translatorId: string }
//   -> { status: 'in_review' } (Only translators can call this)
// POST /api/issue/reserve  { documentId, issuerName, issuerPhone?, reviewStatus, isPublic }
//   -> { verificationId: string }   (long random id)
// POST /api/issue/complete { verificationId, pdfBase64 }
//   -> { status: 'issued', sha256: string }  (backend hashes the exact bytes)
// POST /api/issue/revoke { verificationId, reason?: string }
//   -> { status: 'revoked' } (Only the issuer or admin can revoke)
// GET  /api/verify/:verificationId   (public, no auth)
//   -> { result: 'valid'|'revoked'|'not_found', issuerName, issuedAt,
//        sourceLanguage, targetLanguage, documentType, reviewStatus,
//        isPublic, pdfUrl?: string /* signed URL, only if isPublic */ }
// GET  /api/v1/verify/:verificationId   (header "Authorization: Bearer <partner key>")
//   -> same as above plus sha256, without pdfUrl. Demo key only. NOT connected to any government system.

// Translators must be authenticated and have the 'translator' role to access /api/review/request.