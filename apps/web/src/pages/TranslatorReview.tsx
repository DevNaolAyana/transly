import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageLoading } from '../components/ui'
import { ErrorNotice } from '../components/ErrorNotice'
import { SideBySide } from '../components/SideBySide'
import { IssuePanel } from '../components/IssuePanel'
import { checkTranslated } from '../lib/draft'
import { langLabel } from '../lib/constants'
import { api } from '../services/api'
import type { Block } from '@shared/contract'
import type { DocumentRecord } from '../types'

export default function TranslatorReview() {
  const { id = '' } = useParams()
  const [doc, setDoc] = useState<DocumentRecord | null>(null)
  const [translated, setTranslated] = useState<Block[]>([])
  const [error, setError] = useState<unknown>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setDoc(null)
    try {
      const d = await api.getDocument(id)
      if (!d.blocksOriginal || !d.blocksTranslated) throw new Error('This document has no extracted/translated text stored yet.')
      const problem = checkTranslated(d.blocksOriginal, d.blocksTranslated)
      if (problem) throw new Error(problem)
      setDoc(d)
      setTranslated(d.blocksTranslated)
      api.getSourceFileUrl(d).then(setFileUrl).catch(() => setFileUrl(null))
    } catch (e) {
      setError(e)
    }
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  if (error != null) {
    return (
      <div className="mx-auto max-w-2xl">
        <ErrorNotice title="Could not open this document" error={error} onRetry={() => void load()} />
        <Link to="/translator" className="mt-3 inline-block text-sm underline">Back to the queue</Link>
      </div>
    )
  }
  if (!doc || !doc.blocksOriginal) return <PageLoading />

  return (
    <div className="space-y-4">
      <div>
        <Link to="/translator" className="text-sm text-slate-600 underline">← Review queue</Link>
        <h1 className="mt-1 text-2xl font-bold">Review translation</h1>
        <p className="text-sm text-slate-600">{langLabel(doc.sourceLang)} → {langLabel(doc.targetLang)}</p>
        {fileUrl && (
          <a href={fileUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-700 underline">Open the original file</a>
        )}
      </div>
      <SideBySide
        original={doc.blocksOriginal}
        translated={translated}
        onEdit={(i, text) => setTranslated((p) => p.map((b, j) => (j === i ? { ...b, text } : b)))}
        originalLabel={langLabel(doc.sourceLang)}
        translatedLabel={langLabel(doc.targetLang)}
        sourceLang={doc.sourceLang}
        targetLang={doc.targetLang}
        preview
      />
      <IssuePanel
        doc={doc}
        blocks={translated}
        reviewStatus="human_reviewed"
        title="Approve and issue"
        submitLabel="Approve and issue"
        nameLabel="Issuer name (your name, printed as the reviewer)"
        intro="By approving, the PDF will say it was human reviewed by the name below."
      />
    </div>
  )
}
