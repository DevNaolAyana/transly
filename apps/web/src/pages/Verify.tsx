import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Alert, Button, Card, PageLoading } from '../components/ui'
import { ErrorNotice } from '../components/ErrorNotice'
import { ShareButtons, usePdfActions } from '../components/PdfActions'
import { docTypeLabel, langLabel } from '../lib/constants'
import { verifyUrl } from '../lib/links'
import { api } from '../services/api'
import type { VerifyResponse } from '@shared/contract'

const BANNER = {
  valid: { cls: 'border-emerald-500 bg-emerald-50 text-emerald-900', icon: '✔', title: 'Valid', text: 'This document was issued through Transly and has not been revoked.' },
  revoked: { cls: 'border-red-500 bg-red-50 text-red-900', icon: '✖', title: 'Revoked', text: 'This document was issued through Transly but has since been revoked. Do not rely on it.' },
  not_found: { cls: 'border-amber-500 bg-amber-50 text-amber-900', icon: '?', title: 'Not found', text: 'No document with this verification ID exists in Transly. The code may be wrong, incomplete or forged.' },
} as const

export default function Verify() {
  const { id = '' } = useParams()
  const [data, setData] = useState<VerifyResponse | null>(null)
  const [error, setError] = useState<unknown>(null)

  const load = useCallback(() => {
    setData(null)
    setError(null)
    api.verify(id).then(setData).catch((e) => setError(e))
  }, [id])
  useEffect(load, [load])

  const actions = usePdfActions(data?.pdfUrl ?? null, `transly-${id.slice(0, 8)}.pdf`)

  if (error != null) {
    return (
      <div className="mx-auto max-w-xl">
        <ErrorNotice title="Could not check this document" error={error} onRetry={load} retryLabel="Try again">
          <span className="text-xs">This is a connection or server problem. It does not mean the document is invalid.</span>
        </ErrorNotice>
      </div>
    )
  }
  if (!data) return <PageLoading label="Checking document…" />

  const b = BANNER[data.result]
  const found = data.result !== 'not_found'

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className={`rounded-xl border-2 p-5 text-center ${b.cls}`} role="status">
        <div className="text-5xl font-black">{b.icon}</div>
        <h1 className="mt-1 text-3xl font-extrabold">{b.title}</h1>
        <p className="mt-1 text-sm">{b.text}</p>
      </div>

      {found && (
        <Card>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Item label="Issued by" value={data.issuerName} />
            <Item label="Issue date" value={data.issuedAt ? new Date(data.issuedAt).toLocaleDateString(undefined, { dateStyle: 'long' }) : undefined} />
            <Item label="Languages" value={data.sourceLanguage && data.targetLanguage ? `${langLabel(data.sourceLanguage)} → ${langLabel(data.targetLanguage)}` : undefined} />
            <Item label="Document type" value={data.documentType ? docTypeLabel(data.documentType) : undefined} />
            <div className="sm:col-span-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Review status</dt>
              <dd className="mt-1">
                {data.reviewStatus === 'human_reviewed' ? (
                  <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-900">Human reviewed</span>
                ) : data.reviewStatus === 'machine' ? (
                  <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-900">Machine translated, not human reviewed</span>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      {data.result === 'valid' && (
        <Card className="space-y-3">
          {data.pdfUrl ? (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={actions.download}>⬇ Download PDF</Button>
                <Button variant="secondary" onClick={actions.print}>🖨 Print</Button>
              </div>
              {actions.error && <Alert tone="error">{actions.error}</Alert>}
              <iframe title="Document PDF" src={data.pdfUrl} className="h-[65vh] w-full rounded border border-slate-200" />
            </>
          ) : (
            <p className="text-sm text-slate-600">The issuer has not made the PDF public, so it is not shown here.</p>
          )}
          <ShareButtons link={verifyUrl(id)} />
        </Card>
      )}

      <p className="text-center text-xs text-slate-500">
        This page only confirms that the document exists in Transly. Transly is not a government service and is not connected to any government system.{' '}
        <Link to="/" className="underline">About Transly</Link>
      </p>
    </div>
  )
}

function Item({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium">{value ?? '—'}</dd>
    </div>
  )
}
