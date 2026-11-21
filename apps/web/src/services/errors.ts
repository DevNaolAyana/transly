import { USE_MOCKS } from '../lib/constants'

export class ApiError extends Error {
  status: number
  /** Backend error code from { error: { code, message } }, e.g. RATE_LIMITED. */
  code?: string
  constructor(message: string, status = 0, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

/** Extract and translate can take 30 to 90 s, so the client waits up to 150 s before giving up. */
export const CLIENT_TIMEOUT_MS = 150_000

/** Mock mode only: lets a test shorten the timeout (localStorage 'transly.mock.timeoutMs'). */
export function clientTimeoutMs(): number {
  try {
    const v = Number(localStorage.getItem('transly.mock.timeoutMs'))
    if (USE_MOCKS && Number.isFinite(v) && v >= 1000) return v
  } catch {
    /* storage unavailable */
  }
  return CLIENT_TIMEOUT_MS
}

export function timeoutError(ms: number): ApiError {
  // whole minutes only when exact: 150 s must not read as "3 minutes"
  const wait = ms >= 60_000 && ms % 60_000 === 0 ? `${ms / 60_000} minutes` : `${Math.round(ms / 1000)} seconds`
  return new ApiError(
    `This is taking too long (more than ${wait}), so we stopped waiting. Nothing is lost. Please try again.`,
    0,
    'CLIENT_TIMEOUT',
  )
}

/** Reject with a CLIENT_TIMEOUT ApiError if `p` does not settle in time. */
export function withTimeout<T>(p: Promise<T>, ms = clientTimeoutMs()): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(timeoutError(ms)), ms)
    p.then(
      (v) => { clearTimeout(t); resolve(v) },
      (e) => { clearTimeout(t); reject(e) },
    )
  })
}

export interface ErrorInfo {
  /** Clear text for the user. */
  message: string
  /** Raw server/technical detail, shown small. */
  detail?: string
  /** Show a Retry button. */
  retryable: boolean
  /** The user must sign in again. */
  needsLogin?: boolean
}

/**
 * Turn any error into a clear message. Handles the backend's
 * { error: { code, message } } with HTTP 401, 413, 422, 429 and 5xx.
 */
export function describeError(e: unknown): ErrorInfo {
  if (!(e instanceof ApiError)) return { message: errMsg(e), retryable: false }
  const { status, code } = e
  const detail = e.message
  if (code === 'RATE_LIMITED' || status === 429) {
    // The backend's message says what kind of limit it is. A daily limit will not clear in a minute, so no Retry then.
    const fromServer = detail.trim()
    const usable = fromServer && !/^Request failed \(HTTP \d+\)$/.test(fromServer) // that text is our own fallback, not the server's
    const message = usable ? fromServer : 'Too many requests right now. Please try again in a minute.'
    return { message, retryable: !/daily/i.test(message) }
  }
  if (code === 'UNSUPPORTED_LANGUAGE') {
    return {
      message: 'This language or language pair is not supported. Go back and choose a different source or target language.',
      detail,
      retryable: false,
    }
  }
  if (code === 'CLIENT_TIMEOUT') return { message: e.message, retryable: true }
  if (code === 'PDF_TOO_LARGE') return { message: e.message, retryable: false }
  if (code === 'BUILD_FAILED') return { message: e.message, retryable: true }
  if (status === 401) {
    return { message: 'Your session has expired or you are not signed in. Please sign in again.', detail, retryable: false, needsLogin: true }
  }
  if (status === 413) {
    return {
      message: 'This is too large for the server. Use a smaller file (under 8 MB) or a shorter document.',
      detail,
      retryable: false,
    }
  }
  if (status === 422) {
    return { message: 'The server could not process this document.', detail, retryable: false }
  }
  if (status >= 500) {
    return { message: 'The server had a problem. It is not your fault. Please try again.', detail: code ? `${code}: ${detail}` : detail, retryable: true }
  }
  if (status === 0) {
    // No HTTP answer: network failure (e.g. Storage "Failed to fetch") or a local error. Trying again is the useful action.
    return { message: e.message, retryable: true }
  }
  return { message: e.message, retryable: false }
}
