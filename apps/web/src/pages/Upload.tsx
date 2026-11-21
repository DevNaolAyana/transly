import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field, StepBar, inputCls } from '../components/ui'
import { ErrorNotice } from '../components/ErrorNotice'
import { DOC_TYPES, LANGUAGES } from '../lib/constants'
import { prepareFile, type PreparedFile } from '../lib/prepareImage'
import { validateFile, type FileKind } from '../lib/validateFile'
import { api } from '../services/api'
import type { DocType, LangCode } from '@shared/contract'

const fmt = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(0)} KB` : `${n} bytes`

export default function Upload() {
  const nav = useNavigate()
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState<FileKind | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [source, setSource] = useState<LangCode>('am')
  const [target, setTarget] = useState<LangCode>('en')
  const [docType, setDocType] = useState<DocType>('other')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<unknown>(null)
  const [prep, setPrep] = useState<PreparedFile | null>(null)
  const [preparing, setPreparing] = useState(false)
  const pickTicket = useRef(0)
  const cameraRef = useRef<HTMLInputElement>(null)
  const pickRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!file || kind === 'pdf') {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file, kind])

  async function onPick(f: File | undefined) {
    setError(null)
    setFileError(null)
    if (!f) return
    const ticket = ++pickTicket.current
    setPreparing(true)
    try {
      const res = await validateFile(f)
      if (!res.ok || !res.kind) throw new Error(res.error ?? 'Invalid file.')
      // Photos are shrunk here (max 2000 px, JPEG ~0.85); PDFs stay as they are.
      const p = await prepareFile(f, res.kind)
      if (ticket !== pickTicket.current) return // a newer pick replaced this one
      setFile(p.file)
      setKind(p.reencoded ? 'jpg' : res.kind)
      setPrep(p)
    } catch (e) {
      if (ticket !== pickTicket.current) return
      setFile(null)
      setKind(null)
      setPrep(null)
      setFileError(e instanceof Error ? e.message : String(e))
    } finally {
      if (ticket === pickTicket.current) setPreparing(false)
    }
  }

  const sameLang = source === target

  async function onSubmit(e?: FormEvent) {
    e?.preventDefault()
    if (!file || sameLang || submitting.current) return
    submitting.current = true // blocks a second tap before React has disabled the button
    setBusy(true)
    setError(null)
    try {
      const doc = await api.uploadDocument({ file, sourceLang: source, targetLang: target, docType })
      nav(`/documents/${doc.id}/review`)
    } catch (err) {
      setError(err)
      setBusy(false)
      submitting.current = false
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <StepBar step={1} />
      <Card>
        <h1 className="mb-1 text-2xl font-bold">Upload a document</h1>
        <p className="mb-4 text-sm text-slate-600">JPG, PNG or PDF. Photos are made smaller automatically; a PDF can be up to 8 MB. Make sure the text is sharp and the whole page is in the picture.</p>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => cameraRef.current?.click()}>
              📷 Take a photo
            </Button>
            <Button type="button" variant="secondary" disabled={busy} onClick={() => pickRef.current?.click()}>
              📁 Choose a file
            </Button>
          </div>
          {/* capture opens the rear camera on phones; ignored on desktop */}
          <input ref={cameraRef} type="file" accept="image/jpeg,image/png" capture="environment" hidden onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={pickRef} type="file" accept="image/jpeg,image/png,application/pdf,.jpg,.jpeg,.png,.pdf" hidden onChange={(e) => { void onPick(e.target.files?.[0]); e.target.value = '' }} />

          {fileError && <Alert tone="error" title="File not accepted">{fileError}</Alert>}

          {preparing && (
            <p role="status" className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Preparing your picture…
            </p>
          )}

          {file && !preparing && (
            <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              {preview ? (
                <img src={preview} alt="Selected document preview" className="h-16 w-16 shrink-0 rounded object-cover sm:h-20 sm:w-20" />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-red-100 text-sm font-bold text-red-700">PDF</div>
              )}
              <div className="min-w-0 flex-1">
                <p className="break-all font-medium">{file.name}</p>
                <p className="text-xs text-slate-500" data-testid="file-size">
                  {prep?.reencoded
                    ? `${fmt(prep.originalBytes)} → ${fmt(prep.finalBytes)} · ${prep.from?.w}×${prep.from?.h} → ${prep.to?.w}×${prep.to?.h} px · JPG`
                    : `${fmt(file.size)} · ${kind?.toUpperCase()}`}
                </p>
              </div>
              <Button type="button" variant="ghost" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => { pickTicket.current++; setFile(null); setKind(null); setPrep(null); setError(null) }}>Remove</Button>
            </div>
          )}
          {file && !preparing && prep?.warning && <Alert tone="warn" title="The text may be hard to read">{prep.warning}</Alert>}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Document language (source)">
              <select className={inputCls} value={source} disabled={busy} onChange={(e) => setSource(e.target.value as LangCode)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} — {l.native}</option>)}
              </select>
            </Field>
            <Field label="Translate into (target)">
              <select className={inputCls} value={target} disabled={busy} onChange={(e) => setTarget(e.target.value as LangCode)}>
                {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label} — {l.native}</option>)}
              </select>
            </Field>
          </div>
          {sameLang && <Alert tone="warn">Source and target language must be different.</Alert>}

          <Field label="Document type">
            <select className={inputCls} value={docType} disabled={busy} onChange={(e) => setDocType(e.target.value as DocType)}>
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </Field>

          {error != null && <ErrorNotice title="Upload failed" error={error} onRetry={() => void onSubmit()} />}

          <Button type="submit" className="w-full" disabled={!file || sameLang || preparing} loading={busy}>
            {busy ? 'Uploading…' : 'Upload and read the text'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
