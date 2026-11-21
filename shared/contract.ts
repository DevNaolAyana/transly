// SHARED CONTRACT v2. Only the project lead edits this file. Types only.
export type LangCode = 'om' | 'am' | 'en';
export type DocType = 'academic' | 'id_certificate' | 'legal' | 'other';
export type BlockType =
  | 'heading' | 'paragraph' | 'table_row' | 'list_item'
  | 'stamp' | 'signature' | 'logo' | 'handwriting';
export interface Block { id: string; type: BlockType; text: string }
export type ReviewStatus = 'machine' | 'human_reviewed';
// documents.status (database). 'revoked' exists only on the issued record, as a verify result.
export type DocStatus = 'uploaded' | 'extracted' | 'translated' | 'in_review' | 'reviewed' | 'issued';
export type VerifyResult = 'valid' | 'revoked' | 'not_found';

// Every error: HTTP 4xx/5xx with this body.
export interface ApiError {
  error: {
    code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'BAD_REQUEST' | 'PAYLOAD_TOO_LARGE'
      | 'UNSUPPORTED_LANGUAGE' | 'RATE_LIMITED' | 'BAD_GATEWAY' | 'INTERNAL';
    message: string;
  };
}

// All calls except public verify: header "Authorization: Bearer <supabase access token>"

// POST /api/extract
export interface ExtractRequest { documentId: string; sourceLanguage?: LangCode }
export interface ExtractResponse { detectedLanguage: LangCode; documentType: DocType; blocks: Block[] }

// POST /api/translate  (same ids, order, count and types back)
export interface TranslateRequest { documentId: string; sourceLanguage: LangCode; targetLanguage: LangCode; blocks: Block[] }
export interface TranslateResponse { blocks: Block[] }

// POST /api/review/request  (document owner; document must have translated blocks)
export interface ReviewRequestBody { documentId: string }
export interface ReviewRequestResponse { status: 'in_review' }

// POST /api/issue/reserve
// reviewStatus 'human_reviewed' is accepted only if the caller's profile role is 'translator'; otherwise forced to 'machine'.
export interface IssueReserveRequest {
  documentId: string; issuerName: string; issuerPhone?: string;
  reviewStatus: ReviewStatus; isPublic: boolean;
}
export interface IssueReserveResponse { verificationId: string }

// POST /api/issue/complete  (pdfBase64 max ~3 MB, must be a real PDF; backend hashes the exact bytes)
export interface IssueCompleteRequest { verificationId: string; pdfBase64: string }
export interface IssueCompleteResponse { status: 'issued'; sha256: string }

// POST /api/issue/revoke  (document owner or the issuing translator)
export interface RevokeRequest { verificationId: string }
export interface RevokeResponse { result: 'revoked' }

// GET /api/verify/:verificationId  (public, no auth). Unknown or reserved ids -> not_found (HTTP 404 or 200).
export interface VerifyResponse {
  result: VerifyResult;
  issuerName?: string; issuedAt?: string;
  sourceLanguage?: LangCode; targetLanguage?: LangCode;
  documentType?: DocType; reviewStatus?: ReviewStatus;
  isPublic?: boolean;
  pdfUrl?: string; // short-lived signed URL, only when isPublic is true
}

// GET /api/v1/verify/:verificationId  (header "Authorization: Bearer <partner key>").
// Demo key only. NOT connected to any government system. Wrong or missing key -> 401.
export interface PartnerVerifyResponse extends Omit<VerifyResponse, 'pdfUrl'> { sha256?: string }