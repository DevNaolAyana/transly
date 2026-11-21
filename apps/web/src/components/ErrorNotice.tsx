import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { describeError } from '../services/errors'
import { Alert, Button } from './ui'

/**
 * One consistent error box. Shows a clear message for 401, 413, 422, 429, 5xx,
 * RATE_LIMITED and UNSUPPORTED_LANGUAGE. Retry is only offered when it can help
 * (rate limit, server error, network).
 */
export function ErrorNotice({
  title,
  error,
  onRetry,
  retryLabel = 'Try again',
  children,
}: {
  title: string
  error: unknown
  onRetry?: () => void
  retryLabel?: string
  /** Extra actions, e.g. a link back. */
  children?: ReactNode
}) {
  const info = describeError(error)
  const showRetry = info.retryable && !!onRetry
  return (
    <Alert
      tone="error"
      title={title}
      action={
        showRetry || info.needsLogin || children ? (
          <div className="flex flex-wrap items-center gap-2">
            {showRetry && <Button onClick={onRetry}>{retryLabel}</Button>}
            {info.needsLogin && (
              <Link to="/login" className="inline-flex min-h-11 items-center rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white">
                Sign in again
              </Link>
            )}
            {children}
          </div>
        ) : undefined
      }
    >
      <p>{info.message}</p>
      {info.detail && info.detail !== info.message && <p className="mt-1 break-words text-xs opacity-80">Details: {info.detail}</p>}
    </Alert>
  )
}
