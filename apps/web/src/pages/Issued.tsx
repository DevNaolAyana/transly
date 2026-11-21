import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Alert, Button, Card } from '../components/ui'
import { ErrorNotice } from '../components/ErrorNotice'
import { getIssued, getIssuedDocumentId } from '../lib/issue'
import { verifyUrl } from '../lib/links'
import { api } from '../services/api'
import { errMsg } from '../services/errors'
import { useAuth } from '../context/AuthContext'
import { ShareButtons, usePdfActions } from '../components/PdfActions'
import type { VerifyResult } from '../types'

export default function Issued() {
  const { verificationId = '' } = useParams()
  const loc = useLocation()
  const { user } = useAuth()
  const sha = (loc.state as { sha256?: string } | null)?.sha256
  const mem = getIssued(verificationId)
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [remoteErr, setRemoteErr] = useState<string | null>(null)
  const [status, setStatus] = useState<VerifyResult | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [revoking, setRevoking] = useState(false)
  const [revokeError, setRevokeError] = useState<unknown>(null)

  // Current status (valid/revoked) and, after a reload, a public PDF via pdfUrl.
  useEffect(() => {
    api
      .verify(verificationId)
      .then((v) => {
        setStatus(v.result)
        if (!mem) {
          if (v.pdfUrl) setRemoteUrl(v.pdfUrl)
          else setRemoteErr('The PDF is not kept in this browser after a reload, and this document is not public, so it cannot be downloaded again here.')
        }
      })
      .catch((e) => {
        if (!mem) setRemoteErr(errMsg(e))
      })
  }, [mem, verificationId])

  // Only the document owner sees "Revoke" (the API enforces it as well).
  useEffect(() => {
    const docId = getIssuedDocumentId(verificationId)
    if (!docId || !user) return
    api
      .getDocument(docId)
      .then((d) => setIsOwner(d.ownerId === user.id))
      .catch(() => setIsOwner(false))
  }, [verificationId, user])

  const revoke = useCallback(async () => {
    setRevoking(true)
    setRevokeError(null)
    try {
      await api.revokeDocument(verificationId)
      setStatus('revoked')
      setConfirming(false)
    } catch (e) {
      setRevokeError(e)
    } finally {
      setRevoking(false)
    }
  }, [verificationId])

  const blobUrl = useMemo(
    () => (mem ? URL.createObjectURL(new Blob([mem.pdf as BlobPart], { type: 'application/pdf' })) : null),
    [mem],
  )
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  const pdfUrl = blobUrl ?? remoteUrl
  const link = verifyUrl(verificationId)
  const actions = usePdfActions(pdfUrl, `transly-${verificationId.slice(0, 8)}.pdf`)
  const revoked = status === 'revoked'

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {revoked ? (
        <Alert tone="error" title="Document revoked">
          This document has been revoked. Anyone who scans its QR code will see that it is no longer valid.
        </Alert>
      ) : (
        <Alert tone="success" title="Document issued">
          Your PDF has been created and registered. Anyone can check it at the link below.
        </Alert>
      )}

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Verification link (in the PDF's QR code)</p>
          <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs">{link}</p>
          {sha && <p className="mt-1 break-all text-xs text-slate-500">SHA-256: {sha}</p>}
        </div>

        {pdfUrl ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => void actions.download()}>⬇ Download PDF</Button>
            <Button variant="secondary" onClick={actions.print}>🖨 Print</Button>
          </div>
        ) : (
          remoteErr && <Alert tone="warn">{remoteErr}</Alert>
        )}
        <ShareButtons link={link} />
        {actions.error && <Alert tone="error" title="Action failed">{actions.error}</Alert>}
        <div>
          <Link to={`/v/${verificationId}`} className="text-sm font-semibold text-brand-700 underline">Open the public verification page</Link>
        </div>
      </Card>

      {isOwner && !revoked && (
        <Card className="space-y-3 border-red-200">
          <h2 className="font-bold text-red-800">Revoke this document</h2>
          <p className="text-sm text-slate-600">
            Revoking marks the document as no longer valid. Anyone who scans the QR code will see “Revoked”. This cannot be undone.
          </p>
          {revokeError != null && <ErrorNotice title="Could not revoke" error={revokeError} onRetry={() => void revoke()} />}
          {!confirming ? (
            <Button variant="danger" onClick={() => setConfirming(true)}>Revoke…</Button>
          ) : (
            <div className="space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-900">Are you sure you want to revoke this document?</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="danger" loading={revoking} onClick={() => void revoke()}>Yes, revoke it</Button>
                <Button variant="secondary" disabled={revoking} onClick={() => { setConfirming(false); setRevokeError(null) }}>Cancel</Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {pdfUrl && (
        <Card className="!p-2">
          <iframe title="Issued PDF" src={pdfUrl} className="h-[70vh] w-full rounded" />
        </Card>
      )}
      <Link to="/documents" className="inline-block text-sm text-slate-600 underline">Back to my documents</Link>
    </div>
  )
}
