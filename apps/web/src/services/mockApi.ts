import type { Api } from './api'
import { ApiError } from './errors'
import type { Block, DocumentRecord, Role, VerifyResponse } from '../types'

/**
 * MOCK backend (VITE_USE_MOCKS=true). Everything here is fake sample data kept in
 * localStorage so the UI can be built and demoed before the real API exists.
 * Tip: upload a file whose name contains "fail-extract" or "fail-translate" to
 * exercise the error/retry states.
 */

const KEY = 'transly.mock.db.v1'

interface IssuedRec {
  verificationId: string
  documentId: string
  issuerName: string
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
    db.docs[id] = doc
    save(db)
    fileUrls.set(id, URL.createObjectURL(file))
    return doc
  },

  async getDocument(id) {
    await wait(150)
    const d = load().docs[id]
    if (!d) throw new ApiError('Document not found (mock).', 404)
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
    if (!d) throw new ApiError('Document not found (mock).', 404)
    if (d.storagePath.includes('fail-extract')) throw new ApiError('Mock extraction failure (file name contains "fail-extract").', 502)
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
    if (!d) throw new ApiError('Document not found (mock).', 404)
    if (d.storagePath.includes('fail-translate')) throw new ApiError('Mock translation failure (file name contains "fail-translate").', 502)
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

  async requestHumanReview({ documentId, blocksOriginal, blocksTranslated }) {
    await wait(500)
    const db = load()
    const d = db.docs[documentId]
    if (!d) throw new ApiError('Document not found (mock).', 404)
    d.blocksOriginal = blocksOriginal
    d.blocksTranslated = blocksTranslated
    d.status = 'in_review'
    save(db)
  },

  async reserveIssue(p) {
    await wait(400)
    const db = load()
    const d = db.docs[p.documentId]
    if (!d) throw new ApiError('Document not found (mock).', 404)
    const verificationId = hex(16)
    db.issued[verificationId] = {
      verificationId,
      documentId: p.documentId,
      issuerName: p.issuerName,
      reviewStatus: p.reviewStatus,
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
    if (!rec) throw new ApiError('Unknown verification id (mock).', 404)
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
