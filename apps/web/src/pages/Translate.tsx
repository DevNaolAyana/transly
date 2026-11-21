import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, PageLoading, StepBar } from '../components/ui'
import { SideBySide } from '../components/SideBySide'
import { IssuePanel } from '../components/IssuePanel'
import { ErrorNotice } from '../components/ErrorNotice'
import { LongWait } from '../components/LongWait'
import { checkTranslated, loadDraft, sameBlocks, saveDraft } from '../lib/draft'
import { DEMO_PRICE_ETB, REQUIRE_PAYMENT, USE_MOCKS, langLabel } from '../lib/constants'
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

  // Paywall state
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [simulatedSuccess, setSimulatedSuccess] = useState(false)
  const [payLoading, setPayLoading] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)
  const [payCanRetry, setPayCanRetry] = useState(false)

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

  const checkPendingPayment = useCallback(async (d: DocumentRecord) => {
    // Check if already marked as paid
    const isPaidInSession = sessionStorage.getItem(`transly.paid.${d.id}`) === 'true'
    const isSimulatedInSession = sessionStorage.getItem(`transly.simulated.${d.id}`) === 'true'
    if (d.paid || isPaidInSession) {
      setIsUnlocked(true)
      if (isSimulatedInSession) setSimulatedSuccess(true)
      return
    }

    // Check if returning from checkout
    const params = new URLSearchParams(window.location.search)
    const urlTxRef = params.get('txRef') || params.get('tx_ref')
    const pendingTxRef = urlTxRef || sessionStorage.getItem(`transly.txRef.${d.id}`) || sessionStorage.getItem('transly.txRef')

    if (pendingTxRef) {
      setPayLoading(true)
      setPayError(null)
      try {
        const verifyRes = await api.verifyPayment(pendingTxRef)
        if (verifyRes.paid) {
          setIsUnlocked(true)
          sessionStorage.setItem(`transly.paid.${d.id}`, 'true')
          sessionStorage.removeItem(`transly.txRef.${d.id}`)
          sessionStorage.removeItem('transly.txRef')
          setPayCanRetry(false)
        } else {
          setPayError('Payment not confirmed')
          setPayCanRetry(true)
        }
      } catch (err: unknown) {
        const e = err as { status?: number; code?: string; message?: string } | undefined
        if (e?.status === 404 || e?.code === 'NOT_FOUND' || String(e?.message).includes('404')) {
          setPayError('Payment is not available in this build')
          sessionStorage.removeItem(`transly.txRef.${d.id}`)
          sessionStorage.removeItem('transly.txRef')
          setPayCanRetry(false)
        } else {
          setPayError('Payment not confirmed')
          setPayCanRetry(true)
        }
      } finally {
        setPayLoading(false)
      }
    }
  }, [])

  const initOnce = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      const d = await api.getDocument(id)
      setDoc(d)
      await checkPendingPayment(d)

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
  }, [id, nav, translateNow, checkPendingPayment])

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

  const handlePay = async () => {
    if (payLoading) return
    setPayLoading(true)
    setPayError(null)
    setPayCanRetry(false)

    if (USE_MOCKS) {
      // Mock mode: simulates a payment (2 s spinner), shows "SIMULATED PAYMENT (mock mode)" label, and unlocks all blocks.
      setTimeout(() => {
        setIsUnlocked(true)
        setSimulatedSuccess(true)
        sessionStorage.setItem(`transly.paid.${id}`, 'true')
        sessionStorage.setItem(`transly.simulated.${id}`, 'true')
        setPayLoading(false)
      }, 2000)
      return
    }

    // Real mode: call POST /api/payment/init {documentId}, store txRef in sessionStorage, then window.location to checkoutUrl.
    try {
      const res = await api.initPayment(id)
      sessionStorage.setItem(`transly.txRef.${id}`, res.txRef)
      sessionStorage.setItem('transly.txRef', res.txRef)
      window.location.href = res.checkoutUrl
    } catch (err: unknown) {
      setPayLoading(false)
      const e = err as { status?: number; code?: string; message?: string } | undefined
      if (e?.status === 404 || e?.code === 'NOT_FOUND' || String(e?.message).includes('404')) {
        setPayError('Payment is not available in this build')
        setPayCanRetry(false)
      } else {
        setPayError(e?.message || 'Payment initiation failed')
        setPayCanRetry(true)
      }
    }
  }

  const handleRetryPay = async () => {
    const pendingTxRef = sessionStorage.getItem(`transly.txRef.${id}`) || sessionStorage.getItem('transly.txRef')
    if (pendingTxRef) {
      setPayLoading(true)
      setPayError(null)
      try {
        const verifyRes = await api.verifyPayment(pendingTxRef)
        if (verifyRes.paid) {
          setIsUnlocked(true)
          sessionStorage.setItem(`transly.paid.${id}`, 'true')
          sessionStorage.removeItem(`transly.txRef.${id}`)
          sessionStorage.removeItem('transly.txRef')
          setPayCanRetry(false)
        } else {
          setPayError('Payment not confirmed')
          setPayCanRetry(true)
        }
      } catch (err: unknown) {
        const e = err as { status?: number; code?: string; message?: string } | undefined
        if (e?.status === 404 || e?.code === 'NOT_FOUND' || String(e?.message).includes('404')) {
          setPayError('Payment is not available in this build')
          sessionStorage.removeItem(`transly.txRef.${id}`)
          sessionStorage.removeItem('transly.txRef')
          setPayCanRetry(false)
        } else {
          setPayError('Payment not confirmed')
          setPayCanRetry(true)
        }
      } finally {
        setPayLoading(false)
      }
    } else {
      void handlePay()
    }
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
        <LongWait message="Translating your document. This can take a minute or two." />
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

      {simulatedSuccess && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          <span className="flex items-center gap-2">
            <span>✔</span> SIMULATED PAYMENT (mock mode) — All {original.length} blocks unlocked
          </span>
        </div>
      )}

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
        sourceLang={doc.sourceLang}
        targetLang={doc.targetLang}
        preview
        isUnlocked={isUnlocked}
        onPay={handlePay}
        payLoading={payLoading}
        payError={payError}
        onRetryPay={payCanRetry ? handleRetryPay : undefined}
        priceEtb={DEMO_PRICE_ETB}
      />

      <div className="mt-4">
        {REQUIRE_PAYMENT && !isUnlocked && (
          <div className="mb-2">
            <Alert tone="warn" title="Payment required to issue">
              Issuing requires an unlock. Please complete payment above before issuing the document.
            </Alert>
          </div>
        )}
        <IssuePanel
          doc={doc}
          blocks={translated}
          reviewStatus="machine"
          title="Issue the PDF now (machine translated)"
          submitLabel="Issue PDF with QR code"
          intro="The PDF will clearly say “Machine translated, not human reviewed”. If you want a person to check it first, use the human review option below."
          disabled={REQUIRE_PAYMENT && !isUnlocked}
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
          {isUnlocked ? (
            <div className="mt-2 space-y-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <span>✔</span> Payment confirmed · All blocks unlocked
              </p>
              {simulatedSuccess && (
                <div className="inline-block rounded bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                  SIMULATED PAYMENT (mock mode)
                </div>
              )}
            </div>
          ) : (
            <div className="mt-2 space-y-3">
              <p className="text-sm text-slate-600">
                Unlock full document translation and verification:
              </p>
              <p className="text-base font-bold text-slate-800">
                {DEMO_PRICE_ETB} ETB <span className="text-xs font-normal text-slate-500">(demo price)</span>
              </p>
              <Button
                variant="primary"
                loading={payLoading}
                onClick={handlePay}
              >
                Pay with Chapa (test mode)
              </Button>
              {payError && (
                <div className="text-sm text-red-600">
                  <span>{payError}</span>
                  {payCanRetry && (
                    <button
                      type="button"
                      onClick={handleRetryPay}
                      className="ml-2 font-semibold underline hover:text-red-800"
                    >
                      Retry
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
