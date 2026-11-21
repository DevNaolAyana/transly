import { api } from '../services/api'
import type { Block, DocType, LangCode, ReviewStatus } from '../types'

export type IssueStage = 'reserve' | 'build' | 'complete'

export class IssueError extends Error {
  stage: IssueStage
  /** Set once reserve succeeded, so a retry doesn't create a second record. */
  verificationId?: string
  constructor(stage: IssueStage, message: string, verificationId?: string) {
    super(message)
    this.name = 'IssueError'
    this.stage = stage
    this.verificationId = verificationId
  }
}

export interface IssueParams {
  documentId: string
  blocks: Block[]
  sourceLang: LangCode
  targetLang: LangCode
  docType?: DocType | null
  issuerName: string
  issuerPhone?: string
  reviewStatus: ReviewStatus
  isPublic: boolean
  /** Pass the id from a previous IssueError to skip reserve on retry. */
  resumeVerificationId?: string
}

export interface IssueResult {
  verificationId: string
  sha256: string
  pdf: Uint8Array
  issuerName: string
  isPublic: boolean
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e))

/** reserve -> build PDF (with QR for that id) -> complete with the exact PDF bytes. */
export async function issueDocument(p: IssueParams, onStage?: (s: IssueStage) => void): Promise<IssueResult> {
  // Fail before reserving anything if the issuer name is empty.
  if (!p.issuerName.trim()) throw new IssueError('build', 'Issuer name is required.')
  let verificationId = p.resumeVerificationId
  if (!verificationId) {
    onStage?.('reserve')
    try {
      const r = await api.reserveIssue({
        documentId: p.documentId,
        issuerName: p.issuerName,
        issuerPhone: p.issuerPhone || undefined,
        reviewStatus: p.reviewStatus,
        isPublic: p.isPublic,
      })
      verificationId = r.verificationId
    } catch (e) {
      throw new IssueError('reserve', msg(e))
    }
  }

  onStage?.('build')
  let built: Awaited<ReturnType<typeof import('./buildPdf').buildTranslationPdf>>
  try {
    const { buildTranslationPdf } = await import('./buildPdf') // heavy (pdf-lib, fonts, qrcode): load on demand
    built = await buildTranslationPdf({
      documentId: p.documentId,
      verificationId,
      blocks: p.blocks,
      sourceLang: p.sourceLang,
      targetLang: p.targetLang,
      docType: p.docType,
      issuerName: p.issuerName,
      issuerPhone: p.issuerPhone || undefined,
      reviewStatus: p.reviewStatus,
    })
  } catch (e) {
    throw new IssueError('build', `Could not create the PDF: ${msg(e)}`, verificationId)
  }

  onStage?.('complete')
  try {
    const done = await api.completeIssue({ verificationId, pdfBase64: built.base64 })
    return { verificationId, sha256: done.sha256, pdf: built.bytes, issuerName: p.issuerName, isPublic: p.isPublic }
  } catch (e) {
    throw new IssueError('complete', msg(e), verificationId)
  }
}

// Issued PDFs are kept in memory so the "done" page can offer download/print.
// (Not persisted: after a reload, a public PDF is re-fetched via the verify API's pdfUrl.)
const issuedPdfs = new Map<string, { pdf: Uint8Array; documentId: string }>()
const MAP_KEY = 'transly.issuedDocs'

function readMap(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

/** Remember which document a verification id belongs to (ids only, no content), so the issued page survives a reload. */
export function rememberIssued(verificationId: string, pdf: Uint8Array, documentId: string) {
  issuedPdfs.set(verificationId, { pdf, documentId })
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify({ ...readMap(), [verificationId]: documentId }))
  } catch {
    /* storage unavailable: revoke button just won't be offered after a reload */
  }
}
export const getIssued = (verificationId: string) => issuedPdfs.get(verificationId)
export const getIssuedDocumentId = (verificationId: string): string | undefined =>
  issuedPdfs.get(verificationId)?.documentId ?? readMap()[verificationId]
