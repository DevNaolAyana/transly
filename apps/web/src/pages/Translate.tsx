import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, PageLoading, StepBar } from '../components/ui'
import { SideBySide } from '../components/SideBySide'
import { IssuePanel } from '../components/IssuePanel'
import { ErrorNotice } from '../components/ErrorNotice'
import { LongWait } from '../components/LongWait'
import { checkTranslated, loadDraft, sameBlocks, saveDraft } from '../lib/draft'
import { langLabel } from '../lib/constants'
import { api } from '../services/api'
import type { Block } from '@shared/contract'
import type { DocumentRecord } from '../types'

type Phase = 'loading' | 'translating' | 'ready' | 'error'

export default function Translate() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [doc, setDoc] = useState<DocumentRecord | null>(null)
  const [original, setOriginal] = useState<Block[]>([])
  const [translated, setTranslated] = useState<Block[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<unknown>(null)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [reviewError, setReviewError] = useState<unknown>(null)

  // Never run the (slow, billable) translate twice at once.
  const translating = useRef(false)
  const translateNow = useCallback(
    async (d: DocumentRecord, src: Block[]) => {
      if (translating.current) return
      translating.current = true
      setPhase('translating')
      setError(null)
      try {
        const res = await api.translate({
          documentId: id,
          sourceLanguage: d.sourceLang,
          targetLanguage: d.targetLang,
          blocks: src,
        })
        const problem = checkTranslated(src, res.blocks)
        if (problem) throw new Error(problem)
        setTranslated(res.blocks)
        saveDraft(id, { translated: res.blocks, translatedSource: src })
        setPhase('ready')
      } catch (e) {
        setError(e)
        setPhase('error')
      } finally {
        translating.current = false
      }
    },
    [id],
  )

  const initOnce = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      const d = await api.getDocument(id)
      setDoc(d)
      const draft = loadDraft(id)
      const src = draft.original ?? d.blocksOriginal
      if (!src || src.length === 0) {
        nav(`/documents/${id}/review`, { replace: true })
        return
      }
      setOriginal(src)
      if (draft.translated && sameBlocks(draft.translatedSource, src)) {
        setTranslated(draft.translated)
        setPhase('ready')
      } else if (!draft.original && d.blocksTranslated && !checkTranslated(src, d.blocksTranslated)) {
        setTranslated(d.blocksTranslated)
        setPhase('ready')
      } else {
        await translateNow(d, src)
      }
    } catch (e) {
      setError(e)
      setPhase('error')
    }
  }, [id, nav, translateNow])

  const initInFlight = useRef<Promise<void> | null>(null)
  const init = useCallback(() => {
    if (!initInFlight.current) initInFlight.current = initOnce().finally(() => { initInFlight.current = null })
    return initInFlight.current
  }, [initOnce])

  useEffect(() => {
    void init()
  }, [init])

  function edit(i: number, text: string) {
    setTranslated((prev) => {
      const next = prev.map((b, j) => (j === i ? { ...b, text } : b))
      saveDraft(id, { translated: next })
      return next
    })
  }

  const sendingReview = useRef(false)
  async function sendForReview() {
    if (sendingReview.current) return
    sendingReview.current = true
    setReviewBusy(true)
    setReviewError(null)
    try {
      await api.requestHumanReview(id)
      nav('/documents', { state: { notice: 'Sent for human review. A translator will check it and issue the PDF.' } })
    } catch (e) {
      setReviewError(e)
      setReviewBusy(false)
      sendingReview.current = false
    }
  }

  if (phase === 'loading') return <PageLoading label="Loading…" />
  if (phase === 'translating') {
    return (
      <div className="mx-auto max-w-2xl">
        <StepBar step={3} />
        <LongWait message="Translating your document. This can take up to a minute." />
      </div>
    )
  }
  if (phase === 'error' || !doc) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <StepBar step={3} />
        <ErrorNotice title="Translation failed" error={error} onRetry={() => void init()}>
          <Link to={`/documents/${id}/review`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold">Back to the text</Link>
          <Link to="/upload" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold">Start over</Link>
        </ErrorNotice>
      </div>
    )
  }

  return (
    <div>
      <StepBar step={3} />
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Translation</h1>
          <p className="text-sm text-slate-600">{langLabel(doc.sourceLang)} → {langLabel(doc.targetLang)}</p>
        </div>
        <div className="flex gap-2">
          <Link to={`/documents/${id}/review`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold">
            ← Edit original text
          </Link>
          <Button
            variant="secondary"
            onClick={() => {
              if (confirm('Translate again? Your edits to the translation will be replaced.')) void translateNow(doc, original)
            }}
          >
            Re-translate
          </Button>
        </div>
      </div>

      <div className="mb-3">
        <Alert tone="warn" title="PREVIEW — not issued yet">
          This is a machine translation draft. It has no QR code and cannot be verified until you issue it. Read it carefully and edit anything that is wrong.
        </Alert>
      </div>

      <SideBySide
        original={original}
        translated={translated}
        onEdit={edit}
        originalLabel={langLabel(doc.sourceLang)}
        translatedLabel={langLabel(doc.targetLang)}
        preview
      />

      <div className="mt-4">
        <IssuePanel
          doc={doc}
          blocks={translated}
          reviewStatus="machine"
          title="Issue the PDF now (machine translated)"
          submitLabel="Issue PDF with QR code"
          intro="The PDF will clearly say “Machine translated, not human reviewed”. If you want a person to check it first, use the human review option below."
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="font-bold">Option: human review</h2>
          <p className="mt-1 text-sm text-slate-600">A human translator checks the translation and issues the final PDF with their name on it.</p>
          <p className="mb-3 mt-1 text-xs text-amber-800">
            The translator reviews the translation saved on the server. Edits you made in this browser are not sent.
          </p>
          {reviewError != null && (
            <div className="mb-3">
              <ErrorNotice title="Could not send for review" error={reviewError} onRetry={() => void sendForReview()} />
            </div>
          )}
          <Button variant="secondary" loading={reviewBusy} onClick={() => void sendForReview()}>Send to human translator</Button>
        </Card>
        <Card>
          <h2 className="font-bold">Payment</h2>
          <p className="mt-1 text-sm text-slate-600">Payments are not set up yet. (Placeholder — nothing is charged.)</p>
        </Card>
      </div>
    </div>
  )
}
