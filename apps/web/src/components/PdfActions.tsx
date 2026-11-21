import { useState } from 'react'
import { Alert, Button } from './ui'

/** Download + print for a PDF at `url` (blob: or https:). */
export function usePdfActions(url: string | null, filename: string) {
  const [error, setError] = useState<string | null>(null)

  async function download() {
    setError(null)
    if (!url) return
    try {
      let href = url
      let revoke: string | null = null
      if (!url.startsWith('blob:') && !url.startsWith('data:')) {
        // cross-origin signed URL: fetch so the `download` attribute is honoured
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Could not fetch the PDF (HTTP ${res.status}).`)
        href = revoke = URL.createObjectURL(await res.blob())
      }
      const a = document.createElement('a')
      a.href = href
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      if (revoke) setTimeout(() => URL.revokeObjectURL(revoke), 10_000)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  function print() {
    setError(null)
    if (!url) return
    // Phones can't print from a hidden iframe reliably: open the PDF so the viewer's print menu is available.
    if (window.matchMedia('(pointer: coarse)').matches) {
      if (!window.open(url, '_blank')) setError('Your browser blocked the new tab. Allow pop-ups, or download the PDF and print it.')
      return
    }
    const f = document.createElement('iframe')
    f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
    f.src = url
    f.onload = () => {
      try {
        f.contentWindow?.focus()
        f.contentWindow?.print()
      } catch {
        if (!window.open(url, '_blank')) setError('Could not start printing. Download the PDF and print it instead.')
      }
      setTimeout(() => f.remove(), 60_000)
    }
    document.body.appendChild(f)
  }

  return { download, print, error }
}

/** Copy-link and (when the device supports it) native share. */
export function ShareButtons({ link }: { link: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle')
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(link)
      else {
        const t = document.createElement('textarea')
        t.value = link
        document.body.appendChild(t)
        t.select()
        const ok = document.execCommand('copy')
        t.remove()
        if (!ok) throw new Error('copy failed')
      }
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('error')
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" onClick={() => void copy()}>
          {state === 'copied' ? '✓ Link copied' : '🔗 Copy share link'}
        </Button>
        {canShare && (
          <Button
            variant="secondary"
            onClick={() => navigator.share({ title: 'Transly verification', url: link }).catch((e) => { if (e?.name !== 'AbortError') setState('error') })}
          >
            Share…
          </Button>
        )}
      </div>
      {state === 'error' && <Alert tone="error">Could not copy automatically. Select and copy the link manually: {link}</Alert>}
    </div>
  )
}
