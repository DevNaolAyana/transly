import { useEffect, useState } from 'react'
import { Card, Spinner } from './ui'

/**
 * Progress state for calls that can take 30 to 90 seconds (extract, translate):
 * a spinner, the message, and the seconds waited so far. The caller is responsible for
 * not offering any button that would start the same call again while this is shown.
 */
export function LongWait({ message }: { message: string }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    const t0 = Date.now()
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])
  return (
    <Card className="text-center">
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-6 text-slate-700">
        <Spinner className="h-8 w-8 text-brand-600" />
        <p className="font-semibold">{message}</p>
        <p className="text-sm text-slate-500" data-testid="elapsed">Waiting for {secs} s</p>
        {secs >= 45 && <p className="text-sm text-amber-800">Still working. Please keep this page open.</p>}
      </div>
    </Card>
  )
}
