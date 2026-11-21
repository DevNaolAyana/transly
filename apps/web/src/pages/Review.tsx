import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Alert, Button, Card, PageLoading, StepBar } from '../components/ui'
import { ErrorNotice } from '../components/ErrorNotice'
import { BlockField, hasUnclear, isNonText } from '../components/BlockEditor'
import { BLOCK_TYPE_LABEL, docTypeLabel, langLabel } from '../lib/constants'
import { loadDraft, saveDraft } from '../lib/draft'
import { api } from '../services/api'
import type { Block, DocumentRecord, ExtractResponse } from '../types'

type Phase = 'loading' | 'extracting' | 'ready' | 'error'

export default function Review() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const [doc, setDoc] = useState<DocumentRecord | null>(null)
  const [blocks, setBlocks] = useState<Block[]>([])
  const [phase, setPhase] = useState<Phase>('loading')
  const [error, setError] = useState<unknown>(null)
  const [detected, setDetected] = useState<ExtractResponse | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  const run = useCallback(async () => {
    setPhase('loading')
    setError(null)
    try {
      const d = await api.getDocument(id)
      setDoc(d)
      api.getSourceFileUrl(d).then(setFileUrl).catch(() => setFileUrl(null))
      const draft = loadDraft(id)
      const existing = draft.original ?? d.blocksOriginal
      if (existing && existing.length) {
        setBlocks(existing)
        setPhase('ready')
        return
      }
      setPhase('extracting')
      const res = await api.extract(id, d.sourceLang)
      if (!Array.isArray(res.blocks) || res.blocks.length === 0) {
        throw new Error('No text could be found in this document. Try a sharper photo or a different file.')
      }
      setDetected(res)
      setBlocks(res.blocks)
      saveDraft(id, { original: res.blocks })
      setPhase('ready')
    } catch (e) {
      setError(e)
      setPhase('error')
    }
  }, [id])

  useEffect(() => {
    void run()
  }, [run])

  function edit(i: number, text: string) {
    setBlocks((prev) => {
      const next = prev.map((b, j) => (j === i ? { ...b, text } : b))
      saveDraft(id, { original: next })
      return next
    })
  }

  function onContinue() {
    // The translate page re-translates if the text differs from what the stored translation was made from.
    saveDraft(id, { original: blocks })
    nav(`/documents/${id}/translate`)
  }

  const unclearCount = blocks.filter((b) => hasUnclear(b.text)).length

  if (phase === 'loading') return <PageLoading label="Loading document…" />
  if (phase === 'extracting') {
    return (
      <div className="mx-auto max-w-2xl">
        <StepBar step={2} />
        <PageLoading label="Reading the text in your document… this can take up to a minute." />
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <StepBar step={2} />
        <ErrorNotice title="Could not read the document" error={error} onRetry={() => void run()}>
          <Link to="/upload" className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold">Upload a different file</Link>
        </ErrorNotice>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <StepBar step={2} />
      <h1 className="text-2xl font-bold">Check the extracted text</h1>
      <p className="mb-3 text-sm text-slate-600">
        {doc && (<>{langLabel(doc.sourceLang)} → {langLabel(doc.targetLang)} · {docTypeLabel(doc.docType)}. </>)}
        Fix any mistakes. Nothing is translated until you press Continue.
      </p>

      <div className="mb-4 space-y-2">
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-brand-700 underline">
            Open the original file to compare
          </a>
        )}
        {detected && doc && detected.detectedLanguage !== doc.sourceLang && (
          <Alert tone="warn" title="Language mismatch">
            You chose {langLabel(doc.sourceLang)}, but the document looks like {langLabel(detected.detectedLanguage)}. If that is right, go back and
            upload again with the correct language.
          </Alert>
        )}
        {detected && doc && detected.documentType !== doc.docType && (
          <Alert tone="info">The document looks like type “{docTypeLabel(detected.documentType)}”. You selected “{docTypeLabel(doc.docType)}”.</Alert>
        )}
        {unclearCount > 0 ? (
          <Alert tone="warn" title={`${unclearCount} unclear ${unclearCount === 1 ? 'part' : 'parts'} to check`}>
            Parts marked <mark className="rounded bg-amber-300 px-1">[unclear]</mark> could not be read. Type the correct text, or leave the marker if it really is unreadable.
          </Alert>
        ) : (
          <Alert tone="success">No unclear parts were marked. Please still read it carefully.</Alert>
        )}
      </div>

      <ol className="space-y-3">
        {blocks.map((b, i) => (
          <li key={b.id}>
            <Card className="!p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {i + 1}. {BLOCK_TYPE_LABEL[b.type]}
                {isNonText(b) && ' (not text — shown as a placeholder in the PDF)'}
              </p>
              <BlockField block={b} onChange={(t) => edit(i, t)} />
            </Card>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-200 bg-white/95 p-4 backdrop-blur">
        <Button className="w-full sm:w-auto" onClick={onContinue}>
          Continue to translation →
        </Button>
        {unclearCount > 0 && <p className="mt-2 text-xs text-amber-800">{unclearCount} unclear marker(s) will be sent as-is if you continue.</p>}
      </div>
    </div>
  )
}
