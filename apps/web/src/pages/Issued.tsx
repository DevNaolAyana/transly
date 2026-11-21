import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Alert, Button, Card } from '../components/ui'
import { getIssued } from '../lib/issue'
import { verifyUrl } from '../lib/links'
import { api } from '../services/api'
import { errMsg } from '../services/errors'
import { ShareButtons, usePdfActions } from '../components/PdfActions'

export default function Issued() {
  const { verificationId = '' } = useParams()
  const loc = useLocation()
  const sha = (loc.state as { sha256?: string } | null)?.sha256
  const mem = getIssued(verificationId)
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null)
  const [remoteErr, setRemoteErr] = useState<string | null>(null)

  // After a reload the bytes are gone; a public PDF can still be fetched via the API.
  useEffect(() => {
    if (mem) return
    api
      .verify(verificationId)
      .then((v) => {
        if (v.pdfUrl) setRemoteUrl(v.pdfUrl)
        else setRemoteErr('The PDF is not kept in this browser after a reload, and this document is not public, so it cannot be downloaded again here.')
      })
      .catch((e) => setRemoteErr(errMsg(e)))
  }, [mem, verificationId])

  const blobUrl = useMemo(
    () => (mem ? URL.createObjectURL(new Blob([mem.pdf as BlobPart], { type: 'application/pdf' })) : null),
    [mem],
  )
  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl) }, [blobUrl])

  const pdfUrl = blobUrl ?? remoteUrl
  const link = verifyUrl(verificationId)
  const actions = usePdfActions(pdfUrl, `transly-${verificationId.slice(0, 8)}.pdf`)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Alert tone="success" title="Document issued">
        Your PDF has been created and registered. Anyone can check it at the link below.
      </Alert>

      <Card className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-slate-700">Verification link (in the PDF's QR code)</p>
          <p className="break-all rounded bg-slate-100 p-2 font-mono text-xs">{link}</p>
          {sha && <p className="mt-1 break-all text-xs text-slate-500">SHA-256: {sha}</p>}
        </div>

        {pdfUrl ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={actions.download}>⬇ Download PDF</Button>
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

      {pdfUrl && (
        <Card className="!p-2">
          <iframe title="Issued PDF" src={pdfUrl} className="h-[70vh] w-full rounded" />
        </Card>
      )}
      <Link to="/documents" className="inline-block text-sm text-slate-600 underline">Back to my documents</Link>
    </div>
  )
}
