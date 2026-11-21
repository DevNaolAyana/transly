import { requireSupabase } from '../lib/supabase'
import { USE_MOCKS } from '../lib/constants'
import { mockApi } from './mockApi'
import { ApiError, clientTimeoutMs, timeoutError } from './errors'
import type {
  ApiError as ApiErrorBody,
  Block,
  DocStatus,
  DocType,
  ExtractRequest,
  ExtractResponse,
  IssueCompleteRequest,
  IssueCompleteResponse,
  IssueReserveRequest,
  IssueReserveResponse,
  LangCode,
  ReviewRequestBody,
  ReviewRequestResponse,
  RevokeRequest,
  RevokeResponse,
  TranslateRequest,
  TranslateResponse,
  VerifyResponse,
} from '@shared/contract'
import type { DocumentRecord, Role } from '../types'

export { ApiError }

export interface NewDocumentInput {
  file: File
  sourceLang: LangCode
  targetLang: LangCode
  docType: DocType
}

export interface Api {
  // --- documents (Supabase Storage + RLS-protected table) ---
  uploadDocument(input: NewDocumentInput): Promise<DocumentRecord>
  getDocument(id: string): Promise<DocumentRecord>
  getSourceFileUrl(doc: DocumentRecord): Promise<string | null>
  listMyDocuments(): Promise<DocumentRecord[]>
  listReviewQueue(): Promise<DocumentRecord[]>
  getMyRole(): Promise<Role>
  // --- backend API (see shared/contract.ts) ---
  extract(documentId: string, sourceLanguage?: LangCode): Promise<ExtractResponse>
  translate(p: TranslateRequest): Promise<TranslateResponse>
  reserveIssue(p: IssueReserveRequest): Promise<IssueReserveResponse>
  completeIssue(p: IssueCompleteRequest): Promise<IssueCompleteResponse>
  verify(verificationId: string): Promise<VerifyResponse>
  /** POST /api/review/request { documentId } -> { status: 'in_review' } */
  requestHumanReview(documentId: string): Promise<ReviewRequestResponse>
  /** POST /api/issue/revoke { verificationId } -> { result: 'revoked' } (owner only; the API enforces it) */
  revokeDocument(verificationId: string): Promise<RevokeResponse>
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function authHeader(): Promise<Record<string, string>> {
  const { data, error } = await requireSupabase().auth.getSession()
  if (error) throw new ApiError(`Could not read your session: ${error.message}`)
  const token = data.session?.access_token
  if (!token) throw new ApiError('You are signed out. Please sign in again.', 401)
  return { Authorization: `Bearer ${token}` }
}

async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  opts: { body?: unknown; auth?: boolean; acceptStatuses?: number[] } = {},
): Promise<T> {
  const { body, auth = true, acceptStatuses = [] } = opts
  const headers: Record<string, string> = {}
  if (auth) Object.assign(headers, await authHeader())
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  // Extract / translate can take 30-90 s, so wait up to 120 s, then stop with a clear, retryable error.
  const ms = clientTimeoutMs()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), ms)
  let res: Response
  let text: string
  try {
    res = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctrl.signal })
    text = await res.text()
  } catch {
    if (ctrl.signal.aborted) throw timeoutError(ms)
    throw new ApiError('Could not reach the server. Check your connection and try again.')
  } finally {
    clearTimeout(timer)
  }
  let json: unknown = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON body */
  }
  if (!res.ok && !acceptStatuses.includes(res.status)) {
    // Backend format (shared/contract.ts ApiError): { error: { code, message } }. Also tolerate { error: "text" } / { message }.
    const o = json as Partial<ApiErrorBody> & { error?: unknown; message?: unknown } | null
    const eo = o?.error && typeof o.error === 'object' ? (o.error as Partial<ApiErrorBody['error']>) : null
    const code = typeof eo?.code === 'string' ? eo.code : undefined
    const msg =
      (typeof eo?.message === 'string' && eo.message) ||
      (typeof o?.error === 'string' && o.error) ||
      (typeof o?.message === 'string' && o.message) ||
      `Request failed (HTTP ${res.status})`
    throw new ApiError(msg, res.status, code)
  }
  if (json === null) throw new ApiError(`Server returned an empty or invalid response (HTTP ${res.status}).`, res.status)
  return json as T
}

interface DocRow {
  id: string
  owner_id: string
  storage_path: string
  source_lang: LangCode
  target_lang: LangCode
  doc_type: DocType | null
  status: DocStatus
  blocks_original: Block[] | null
  blocks_translated: Block[] | null
  created_at: string
}

const rowToDoc = (r: DocRow): DocumentRecord => ({
  id: r.id,
  ownerId: r.owner_id,
  storagePath: r.storage_path,
  sourceLang: r.source_lang,
  targetLang: r.target_lang,
  docType: r.doc_type,
  status: r.status,
  blocksOriginal: r.blocks_original,
  blocksTranslated: r.blocks_translated,
  createdAt: r.created_at,
})

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, '_').slice(-80) || 'file'

// ---------------------------------------------------------------------------
// real implementation
// ---------------------------------------------------------------------------

const realApi: Api = {
  async uploadDocument({ file, sourceLang, targetLang, docType }) {
    const sb = requireSupabase()
    const { data: u, error: ue } = await sb.auth.getUser()
    if (ue || !u.user) throw new ApiError('You are signed out. Please sign in again.', 401)
    const path = `${u.user.id}/${Date.now()}-${safeName(file.name)}`
    const up = await sb.storage.from('documents').upload(path, file, { contentType: file.type, upsert: false })
    if (up.error) throw new ApiError(`Upload failed: ${up.error.message}`)
    const ins = await sb
      .from('documents')
      .insert({
        owner_id: u.user.id,
        storage_path: path,
        source_lang: sourceLang,
        target_lang: targetLang,
        doc_type: docType,
        status: 'uploaded',
      })
      .select()
      .single()
    if (ins.error) throw new ApiError(`Could not register the document: ${ins.error.message}`)
    return rowToDoc(ins.data as DocRow)
  },

  async getDocument(id) {
    const { data, error } = await requireSupabase().from('documents').select('*').eq('id', id).maybeSingle()
    if (error) throw new ApiError(`Could not load the document: ${error.message}`)
    if (!data) throw new ApiError('Document not found, or you do not have access to it.', 404)
    return rowToDoc(data as DocRow)
  },

  async getSourceFileUrl(doc) {
    const { data, error } = await requireSupabase().storage.from('documents').createSignedUrl(doc.storagePath, 600)
    if (error) throw new ApiError(`Could not open the original file: ${error.message}`)
    return data.signedUrl
  },

  async listMyDocuments() {
    const sb = requireSupabase()
    const { data: u } = await sb.auth.getUser()
    const { data, error } = await sb
      .from('documents')
      .select('*')
      .eq('owner_id', u.user?.id ?? '')
      .order('created_at', { ascending: false })
    if (error) throw new ApiError(`Could not load your documents: ${error.message}`)
    return (data as DocRow[]).map(rowToDoc)
  },

  async listReviewQueue() {
    const { data, error } = await requireSupabase()
      .from('documents')
      .select('*')
      .eq('status', 'in_review')
      .order('created_at', { ascending: true })
    if (error) throw new ApiError(`Could not load the review queue: ${error.message}`)
    return (data as DocRow[]).map(rowToDoc)
  },

  async getMyRole() {
    const sb = requireSupabase()
    const { data: u } = await sb.auth.getUser()
    if (!u.user) return 'customer'
    const { data, error } = await sb.from('profiles').select('role').eq('id', u.user.id).maybeSingle()
    if (error) throw new ApiError(`Could not load your profile: ${error.message}`)
    return (data?.role as Role | undefined) ?? 'customer'
  },

  extract: (documentId, sourceLanguage) => {
    const body: ExtractRequest = { documentId, sourceLanguage }
    return request<ExtractResponse>('POST', '/api/extract', { body })
  },

  translate: (p) => request<TranslateResponse>('POST', '/api/translate', { body: p }),

  reserveIssue: (p) => request<IssueReserveResponse>('POST', '/api/issue/reserve', { body: p }),

  completeIssue: (p) => request<IssueCompleteResponse>('POST', '/api/issue/complete', { body: p }),

  async verify(id) {
    const r = await request<VerifyResponse>('GET', `/api/verify/${encodeURIComponent(id)}`, {
      auth: false,
      acceptStatuses: [404], // a 404 body of { result: 'not_found' } is a valid answer
    })
    if (!r || !['valid', 'revoked', 'not_found'].includes(r.result)) {
      throw new ApiError('The verification service returned an unexpected response.')
    }
    return r
  },

  async requestHumanReview(documentId) {
    const body: ReviewRequestBody = { documentId } // contract v2: documentId only, no translatorId
    const r = await request<ReviewRequestResponse>('POST', '/api/review/request', { body })
    if (r?.status !== 'in_review') throw new ApiError('The server did not confirm that the document is in review.')
    return r
  },

  async revokeDocument(verificationId) {
    const body: RevokeRequest = { verificationId }
    const r = await request<RevokeResponse>('POST', '/api/issue/revoke', { body })
    if (r?.result !== 'revoked') throw new ApiError('The server did not confirm the revocation.')
    return r
  },
}

export const api: Api = USE_MOCKS ? mockApi : realApi
