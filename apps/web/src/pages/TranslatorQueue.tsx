import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Alert, Button, Card, PageLoading } from '../components/ui'
import { docTypeLabel, langLabel } from '../lib/constants'
import { api } from '../services/api'
import { errMsg } from '../services/errors'
import type { DocumentRecord } from '../types'

export default function TranslatorQueue() {
  const [docs, setDocs] = useState<DocumentRecord[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const load = useCallback(() => {
    setDocs(null)
    setError(null)
    api.listReviewQueue().then(setDocs).catch((e) => setError(errMsg(e)))
  }, [])
  useEffect(load, [load])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Review queue</h1>
        <Button variant="secondary" onClick={load}>Refresh</Button>
      </div>
      {error && <Alert tone="error" title="Could not load the queue" action={<Button onClick={load}>Retry</Button>}>{error}</Alert>}
      {!docs && !error && <PageLoading />}
      {docs && docs.length === 0 && <Card>No documents are waiting for review.</Card>}
      <ul className="space-y-3">
        {docs?.map((d) => (
          <li key={d.id}>
            <Card className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium">{d.storagePath.split('/').pop()}</p>
                <p className="text-xs text-slate-500">
                  {langLabel(d.sourceLang)} → {langLabel(d.targetLang)} · {docTypeLabel(d.docType)} · {new Date(d.createdAt).toLocaleString()}
                </p>
              </div>
              <Link to={`/translator/${d.id}`} className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white">Review</Link>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}
