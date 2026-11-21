import type { Api } from './api'
import { ApiError, withTimeout } from './errors'
import type { ApiError as ApiErrorBody, Block, VerifyResponse } from '@shared/contract'
import type { DocumentRecord, Role } from '../types'

/**
 * MOCK backend (VITE_USE_MOCKS=true). Everything here is fake sample data kept in
 * localStorage so the UI can be built and demoed before the real API exists.
 *
 * Failure triggers: upload a file whose name contains "<kind>-<stage>", e.g.
 * "rate-extract.png". Stages: upload, extract, translate, reserve, complete.
 * Kinds: fail (503, fails once), rate (429 RATE_LIMITED, fails once), down (500, always),
 * lang (422 UNSUPPORTED_LANGUAGE), auth (401), big (413), bad (422).
 * Daily limit (extract and translate): file name containing "daily" -> RATE_LIMITED, "Daily limit reached..." (no Retry).
 * Slow triggers (extract and translate): file name containing "slow" waits 8 s; containing "hang" never answers,
 * so the client timeout (150 s, or localStorage 'transly.mock.timeoutMs' in mock mode) shows its Retry message.
 * Verify triggers: id "revoked-demo" -> revoked, id "missing-demo" -> not_found.
 */

// Error codes are limited to the ones in shared/contract.ts (ApiError.error.code).
type ErrCode = ApiErrorBody['error']['code']
const FAILURES: Record<string, { status: number; code: ErrCode; msg: string; once?: boolean }> = {
  fail: { status: 503, code: 'INTERNAL', msg: 'Mock server failure', once: true },
  rate: { status: 429, code: 'RATE_LIMITED', msg: 'Too many requests. Please wait a minute and try again.', once: true },
  down: { status: 500, code: 'INTERNAL', msg: 'Mock server is down' },
  lang: { status: 422, code: 'UNSUPPORTED_LANGUAGE', msg: 'Mock unsupported language' },
  auth: { status: 401, code: 'UNAUTHORIZED', msg: 'Mock invalid token' },
  big: { status: 413, code: 'PAYLOAD_TOO_LARGE', msg: 'Mock payload too large' },
  bad: { status: 422, code: 'BAD_REQUEST', msg: 'Mock: the document could not be processed' },
}
// key -> time of the first failure. Calls within 500 ms count as the same attempt (React StrictMode runs effects twice in dev).
const failedOnce = new Map<string, number>()

type Stage = 'upload' | 'extract' | 'translate' | 'reserve' | 'complete'
function maybeFail(doc: DocumentRecord | undefined, stage: Stage) {
  if (!doc) return
  for (const [kind, f] of Object.entries(FAILURES)) {
    if (!doc.storagePath.includes(`${kind}-${stage}`)) continue
    const key = `${doc.id}:${stage}:${kind}`
    if (f.once) {
      const first = failedOnce.get(key)
      if (first === undefined) failedOnce.set(key, Date.now())
      else if (Date.now() - first > 500) return // a later retry succeeds
    }
    throw new ApiError(f.msg, f.status, f.code)
  }
}

/** "slow" in the file name: extract and translate wait 8 s. "hang": they never answer (shows the client timeout). */
async function slowTrigger(doc: DocumentRecord) {
  const name = doc.storagePath.toLowerCase()
  // "daily": the daily limit is used up (always fails, retrying cannot help)
  if (name.includes('daily')) throw new ApiError('Daily limit reached. You can process more documents tomorrow.', 429, 'RATE_LIMITED')
  if (name.includes('hang')) await new Promise(() => {})
  if (name.includes('slow')) await wait(8000)
}

const KEY = 'transly.mock.db.v1'

interface IssuedRec {
  verificationId: string
  documentId: string
  issuerName: string
  issuedBy?: string // user id that reserved it; like the backend, the issuer may revoke as well as the owner
  reviewStatus: 'machine' | 'human_reviewed'
  isPublic: boolean
  status: 'reserved' | 'issued' | 'revoked'
  issuedAt?: string
  pdfDataUrl?: string
  sha256?: string
}
interface Db {
  docs: Record<string, DocumentRecord>
  issued: Record<string, IssuedRec>
}

const SAMPLE_AM: Block[] = [
  { id: 'b1', type: 'logo', text: '' },
  { id: 'b2', type: 'heading', text: 'የኢትዮጵያ ፌዴራላዊ ዴሞክራሲያዊ ሪፐብሊክ' },
  { id: 'b3', type: 'heading', text: 'የትምህርት ማስረጃ' },
  { id: 'b4', type: 'paragraph', text: 'ይህ ሰነድ አበበ ከበደ የተባሉ ተማሪ በ2015 ዓ.ም ትምህርታቸውን በሚገባ ማጠናቀቃቸውን ያረጋግጣል።' },
  // block text can contain "\n" (address-style lines); the blank line must survive too
  { id: 'b4a', type: 'paragraph', text: 'ለ: የአዲስ አበባ ዩኒቨርሲቲ\nየተማሪዎች አገልግሎት መምሪያ\n\nአዲስ አበባ፣ ኢትዮጵያ' },
  { id: 'b5', type: 'table_row', text: 'የትምህርት ዓይነት | ውጤት' },
  { id: 'b6', type: 'table_row', text: 'ሒሳብ | 85' },
  { id: 'b7', type: 'table_row', text: 'እንግሊዝኛ | [unclear]' },
  { id: 'b8', type: 'list_item', text: 'ጠቅላላ አማካይ ውጤት: 3.4' },
  { id: 'b9', type: 'stamp', text: '' },
  { id: 'b10', type: 'signature', text: '' },
]

const SAMPLE_EN: Block[] = [
  { id: 'b1', type: 'logo', text: '' },
  { id: 'b2', type: 'heading', text: 'Federal Democratic Republic of Ethiopia' },
  { id: 'b3', type: 'heading', text: 'Education Certificate' },
  { id: 'b4', type: 'paragraph', text: 'This document confirms that the student Abebe Kebede completed their studies in 2023.' },
  { id: 'b4a', type: 'paragraph', text: 'To: Addis Ababa University\nStudent Services Office\n\nAddis Ababa, Ethiopia' },
  { id: 'b5', type: 'table_row', text: 'Subject | Result' },
  { id: 'b6', type: 'table_row', text: 'Mathematics | 85' },
  { id: 'b7', type: 'table_row', text: 'English | [unclear]' },
  { id: 'b8', type: 'list_item', text: 'Cumulative average: 3.4' },
  { id: 'b9', type: 'stamp', text: '' },
  { id: 'b10', type: 'signature', text: '' },
]

const SAMPLE_EN_TRANSLATED: Block[] = [
  { id: 'b1', type: 'logo', text: '' },
  { id: 'b2', type: 'heading', text: '[MOCK] Federal Democratic Republic of Ethiopia' },
  { id: 'b3', type: 'heading', text: '[MOCK] Education Certificate' },
  { id: 'b4', type: 'paragraph', text: '[MOCK] This document confirms that the student Abebe Kebede completed their studies in 2023.' },
  { id: 'b4a', type: 'paragraph', text: '[MOCK] To: Addis Ababa University\nStudent Services Office\n\nAddis Ababa, Ethiopia' },
  { id: 'b5', type: 'table_row', text: '[MOCK] Subject | Result' },
  { id: 'b6', type: 'table_row', text: '[MOCK] Mathematics | 85' },
  { id: 'b7', type: 'table_row', text: '[MOCK] English | [unclear]' },
  { id: 'b8', type: 'list_item', text: '[MOCK] Cumulative average: 3.4' },
  { id: 'b9', type: 'stamp', text: '' },
  { id: 'b10', type: 'signature', text: '' },
]

function load(): Db {
  let db: Db | null = null
  try {
    db = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Db | null
  } catch {
    db = null
  }
  if (!db) {
    db = { docs: {}, issued: {} }
    // seed one document waiting for a translator, so that screen is not empty
    db.docs['mock-seed-1'] = {
      id: 'mock-seed-1',
      ownerId: 'mock-customer',
      storagePath: 'mock-customer/seed-certificate.pdf',
      sourceLang: 'am',
      targetLang: 'en',
      docType: 'academic',
      status: 'in_review',
      blocksOriginal: SAMPLE_AM,
      blocksTranslated: SAMPLE_EN_TRANSLATED,
      createdAt: new Date().toISOString(),
    }
    save(db)
  }
  return db
}
function save(db: Db) {
  localStorage.setItem(KEY, JSON.stringify(db))
}
const wait = (ms = 700) => new Promise((r) => setTimeout(r, ms))
const hex = (n: number) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')

export function mockCurrentUserId(): string {
  try {
    return (JSON.parse(localStorage.getItem('transly.mock.user') ?? 'null') as { id: string } | null)?.id ?? 'mock-customer'
  } catch {
    return 'mock-customer'
  }
}

const fileUrls = new Map<string, string>()

export const mockApi: Api = {
  async uploadDocument({ file, sourceLang, targetLang, docType }) {
    await wait(500)
    const db = load()
    const id = `mock-${hex(6)}`
    const doc: DocumentRecord = {
      id,
      ownerId: mockCurrentUserId(),
      storagePath: `${mockCurrentUserId()}/${file.name}`,
      sourceLang,
      targetLang,
      docType,
      status: 'uploaded',
      blocksOriginal: null,
      blocksTranslated: null,
      createdAt: new Date().toISOString(),
    }
    // keyed by file name: a retry creates a new id, so "once" must not depend on it
    maybeFail({ ...doc, id: file.name }, 'upload')
    db.docs[id] = doc
    save(db)
    fileUrls.set(id, URL.createObjectURL(file))
    return doc
  },

  async getDocument(id) {
    await wait(150)
    const d = load().docs[id]
    if (!d) throw new ApiError('Document not found (mock).', 404, 'NOT_FOUND')
    return d
  },

  async getSourceFileUrl(doc) {
    return fileUrls.get(doc.id) ?? null
  },

  async listMyDocuments() {
    await wait(200)
    return Object.values(load().docs)
      .filter((d) => d.ownerId === mockCurrentUserId())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  },

  async listReviewQueue() {
    await wait(300)
    return Object.values(load().docs).filter((d) => d.status === 'in_review')
  },

  async getMyRole(): Promise<Role> {
    try {
      return (JSON.parse(localStorage.getItem('transly.mock.user') ?? 'null') as { role: Role } | null)?.role ?? 'customer'
    } catch {
      return 'customer'
    }
  },

  async extract(documentId, sourceLanguage) {
    await wait(1200)
    const db = load()
    const d = db.docs[documentId]
    if (!d) throw new ApiError('Document not found (mock).', 404, 'NOT_FOUND')
    maybeFail(d, 'extract')
    await slowTrigger(d)
    const lang = sourceLanguage ?? d.sourceLang
    const blocks = lang === 'en' ? SAMPLE_EN : SAMPLE_AM
    d.blocksOriginal = blocks
    d.status = 'extracted'
    save(db)
    return { detectedLanguage: lang, documentType: d.docType ?? 'academic', blocks }
  },

  async translate({ documentId, blocks }) {
    await wait(1400)
    const db = load()
    const d = db.docs[documentId]
    if (!d) throw new ApiError('Document not found (mock).', 404, 'NOT_FOUND')
    maybeFail(d, 'translate')
    await slowTrigger(d)
    const out: Block[] = blocks.map((b) =>
      ['stamp', 'signature', 'logo', 'handwriting'].includes(b.type) || !b.text.trim()
        ? { ...b }
        : { ...b, text: `[MOCK] ${b.text}` },
    )
    d.blocksOriginal = blocks
    d.blocksTranslated = out
    d.status = 'translated'
    save(db)
    return { blocks: out }
  },

  async requestHumanReview(documentId) {
    await wait(500)
    const db = load()
    const d = db.docs[documentId]
    if (!d) throw new ApiError('Document not found (mock).', 404, 'NOT_FOUND')
    if (d.ownerId !== mockCurrentUserId()) throw new ApiError('Only the owner can request a review (mock).', 403, 'FORBIDDEN')
    if (!d.blocksTranslated) throw new ApiError('Translate the document before requesting a review (mock).', 422, 'BAD_REQUEST')
    // Like the real endpoint (body is only { documentId }): the status changes, the stored blocks are NOT replaced
    // by any edits the user made in the browser.
    d.status = 'in_review'
    save(db)
    return { status: 'in_review' }
  },

  async revokeDocument(verificationId) {
    await wait(500)
    const db = load()
    const rec = db.issued[verificationId]
    if (!rec || rec.status === 'reserved') throw new ApiError('No issued document with this verification ID (mock).', 404, 'NOT_FOUND')
    const d = db.docs[rec.documentId]
    const me = mockCurrentUserId()
    if (!d || (d.ownerId !== me && rec.issuedBy !== me)) {
      throw new ApiError('Only the owner or the issuer of the document can revoke it (mock).', 403, 'FORBIDDEN')
    }
    if (rec.status === 'revoked') throw new ApiError('This document is already revoked (mock).', 409, 'BAD_REQUEST')
    rec.status = 'revoked'
    save(db)
    return { result: 'revoked' }
  },

  async reserveIssue(p) {
    await wait(400)
    const db = load()
    const d = db.docs[p.documentId]
    if (!d) throw new ApiError('Document not found (mock).', 404, 'NOT_FOUND')
    maybeFail(d, 'reserve')
    // Contract: 'human_reviewed' is accepted only for a translator profile, otherwise forced to 'machine'.
    const role = await mockApi.getMyRole()
    const reviewStatus = p.reviewStatus === 'human_reviewed' && role === 'translator' ? 'human_reviewed' : 'machine'
    const verificationId = hex(16)
    db.issued[verificationId] = {
      verificationId,
      documentId: p.documentId,
      issuerName: p.issuerName,
      issuedBy: mockCurrentUserId(),
      reviewStatus,
      isPublic: p.isPublic,
      status: 'reserved',
    }
    save(db)
    return { verificationId }
  },

  async completeIssue({ verificationId, pdfBase64 }) {
    await wait(500)
    const db = load()
    const rec = db.issued[verificationId]
    if (!rec) throw new ApiError('Unknown verification id (mock).', 404, 'NOT_FOUND')
    maybeFail(db.docs[rec.documentId], 'complete')
    if (pdfBase64.length > 4_500_000) throw new ApiError('Mock: request body too large (Vercel limit ~4.5 MB).', 413, 'PAYLOAD_TOO_LARGE')
    const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0))
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    rec.sha256 = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
    rec.status = 'issued'
    rec.issuedAt = new Date().toISOString()
    if (rec.isPublic && pdfBase64.length < 2_500_000) rec.pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`
    const d = db.docs[rec.documentId]
    if (d) d.status = 'issued'
    save(db)
    return { status: 'issued', sha256: rec.sha256 }
  },

  async verify(verificationId): Promise<VerifyResponse> {
    await wait(400)
    // Demo triggers so the Revoked / Not found screens can be shown without issuing anything.
    if (verificationId === 'revoked-demo') {
      return {
        result: 'revoked',
        issuerName: 'Demo Issuer (mock)',
        issuedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(),
        sourceLanguage: 'am',
        targetLanguage: 'en',
        documentType: 'academic',
        reviewStatus: 'machine',
        isPublic: false,
      }
    }
    if (verificationId === 'missing-demo') return { result: 'not_found' }
    const db = load()
    const rec = db.issued[verificationId]
    if (!rec || rec.status === 'reserved') return { result: 'not_found' }
    const d = db.docs[rec.documentId]
    return {
      result: rec.status === 'revoked' ? 'revoked' : 'valid',
      issuerName: rec.issuerName,
      issuedAt: rec.issuedAt,
      sourceLanguage: d?.sourceLang,
      targetLanguage: d?.targetLang,
      documentType: d?.docType ?? undefined,
      reviewStatus: rec.reviewStatus,
      isPublic: rec.isPublic,
      pdfUrl: rec.isPublic ? rec.pdfDataUrl : undefined,
    }
  },
}

// Same client timeout as the real API (whose fetch is aborted), so a "hang" file shows the timeout message.
const rawExtract = mockApi.extract
mockApi.extract = (...a: Parameters<Api['extract']>) => withTimeout(rawExtract(...a))
const rawTranslate = mockApi.translate
mockApi.translate = (...a: Parameters<Api['translate']>) => withTimeout(rawTranslate(...a))
