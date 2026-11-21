import type { ButtonHTMLAttributes, ReactNode } from 'react'

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-slate-300',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-slate-300',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-slate-400',
}

export function Button({
  variant = 'primary',
  className = '',
  loading,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 ${className}`}>{children}</div>
}

type Tone = 'error' | 'warn' | 'info' | 'success'
const TONES: Record<Tone, string> = {
  error: 'border-red-300 bg-red-50 text-red-800',
  warn: 'border-amber-300 bg-amber-50 text-amber-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
  success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: Tone
  title?: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border p-3 text-sm ${TONES[tone]}`}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export const inputCls =
  'block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/30 disabled:bg-slate-100'

export function PageLoading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-600">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function StepBar({ step }: { step: 1 | 2 | 3 | 4 }) {
  const steps = ['Upload', 'Review text', 'Translate', 'Issue PDF']
  return (
    <ol className="mb-5 flex items-stretch gap-1 text-xs sm:text-sm" aria-label="Progress">
      {steps.map((s, i) => (
        <li
          key={s}
          className={`flex flex-1 items-center justify-center rounded-full px-2 py-1 text-center leading-tight ${
            i + 1 === step ? 'bg-brand-600 font-semibold text-white' : i + 1 < step ? 'bg-brand-100 text-brand-900' : 'bg-slate-200 text-slate-600'
          }`}
        >
          {i + 1}. {s}
        </li>
      ))}
    </ol>
  )
}
