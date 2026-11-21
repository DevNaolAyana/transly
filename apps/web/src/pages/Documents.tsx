import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, PageLoading } from '../components/ui'
import { docTypeLabel, langLabel } from '../lib/constants'
import { api } from '../services/api'
import { errMsg } from '../services/errors'
import type { DocumentRecord } from '../types'

const STATUS_LABEL: Record<string, string> = {
  uploaded: 'Uploaded',
  extracted: 'Text extracted',
  translated: 'Translated (draft)',
  in_review: 'Waiting for human review',
  reviewed: 'Reviewed',
  issued: 'Issued',
}

export default function Documents() {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    setError(null)
    setDocs(null)
    api.listMyDocuments().then(setDocs).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])

  function next(d: DocumentRecord) {
    if (d.status === 'uploaded') return `/documents/${d.id}/review`
    if (d.status === 'extracted') return `/documents/${d.id}/review`
    return `/documents/${d.id}/translate`
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">My documents</h1>
        <Link to="/upload" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">New document</Link>
      </div>
      {error && <Alert tone="error" title="Could not load documents" action={<Button variant="secondary" onClick={load}>Retry</Button>}>{error}</Alert>}
      {!docs && !error && <PageLoading />}
      {docs && docs.length === 0 && <Card>No documents yet. <Link className="text-brand-700 underline" to="/upload">Upload your first one.</Link></Card>}
      <ul className="space-y-3">
        {docs?.map((d) => (
          <li key={d.id}>
            <Card className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.storagePath.split('/').pop()}</p>
                <p className="text-xs text-slate-500">
                  {langLabel(d.sourceLang)} → {langLabel(d.targetLang)} · {docTypeLabel(d.docType)} · {new Date(d.createdAt).toLocaleDateString()}
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-700">{STATUS_LABEL[d.status] ?? d.status}</p>
              </div>
              {d.status !== 'issued' && d.status !== 'in_review' && (
                <Link to={next(d)} className="shrink-0 text-sm font-semibold text-brand-700 underline">Continue</Link>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
