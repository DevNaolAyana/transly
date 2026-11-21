import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Field, inputCls } from './ui'
import { IssueError, issueDocument, rememberIssued, type IssueStage } from '../lib/issue'
import type { Block, DocumentRecord, ReviewStatus } from '../types'

const STAGE_TEXT: Record<IssueStage, string> = {
  reserve: 'Reserving the verification ID…',
  build: 'Creating the PDF with its QR code…',
  complete: 'Saving the issued PDF…',
}
const STAGE_NAME: Record<IssueStage, string> = {
  reserve: 'Reserving the verification ID',
  build: 'Creating the PDF',
  complete: 'Saving the issued PDF',
}

/** Issuer form + reserve -> build PDF -> complete pipeline. */
export function IssuePanel({
  doc,
  blocks,
  reviewStatus,
  title,
  submitLabel,
  defaultName = '',
  nameLabel = 'Issuer name',
  intro,
}: {
  doc: DocumentRecord
  blocks: Block[]
  reviewStatus: ReviewStatus
  title: string
  submitLabel: string
  defaultName?: string
  nameLabel?: string
  intro?: string
}) {
  const nav = useNavigate()
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [stage, setStage] = useState<IssueStage | null>(null)
  const [error, setError] = useState<IssueError | Error | null>(null)
  const [resumeId, setResumeId] = useState<string | undefined>()
  const busy = stage !== null

  async function submit(e?: FormEvent) {
    e?.preventDefault()
    if (!name.trim()) return
    setError(null)
    try {
      const res = await issueDocument(
        {
          documentId: doc.id,
          blocks,
          sourceLang: doc.sourceLang,
          targetLang: doc.targetLang,
          docType: doc.docType,
          issuerName: name.trim(),
          issuerPhone: phone.trim() || undefined,
          reviewStatus,
          isPublic,
          resumeVerificationId: resumeId,
        },
        setStage,
      )
      rememberIssued(res.verificationId, res.pdf, doc.id)
      nav(`/issued/${res.verificationId}`, { state: { sha256: res.sha256, isPublic } })
    } catch (err) {
      if (err instanceof IssueError) setResumeId(err.verificationId)
      setError(err instanceof Error ? err : new Error(String(err)))
      setStage(null)
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-bold">{title}</h2>
      {intro && <p className="mb-3 mt-1 text-sm text-slate-600">{intro}</p>}
      <form onSubmit={submit} className="space-y-4">
        <Field label={nameLabel}>
          <input className={inputCls} required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" disabled={busy} />
        </Field>
        <Field label="Phone number (optional)" hint="Printed on the PDF and shown to anyone who opens it.">
          <input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" disabled={busy} />
        </Field>
        <label className="flex items-start gap-3">
          <input type="checkbox" className="mt-1 h-5 w-5" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} disabled={busy} />
          <span className="text-sm">
            <span className="font-medium">Make the PDF public</span>
            <span className="block text-slate-600">If checked, anyone who scans the QR code can view the full PDF. If not, they only see that it is valid, who issued it and when.</span>
          </span>
        </label>

        {error && (
          <Alert tone="error" title={error instanceof IssueError ? `Failed: ${STAGE_NAME[error.stage]}` : 'Failed'}>
            {error.message}
            {resumeId && <p className="mt-1">Your verification ID is already reserved. Retrying will reuse it.</p>}
          </Alert>
        )}
        {busy && stage && <Alert tone="info">{STAGE_TEXT[stage]}</Alert>}

        <Button type="submit" className="w-full" loading={busy} disabled={!name.trim()}>
          {error ? 'Try again' : submitLabel}
        </Button>
      </form>
    </Card>
  )
}
