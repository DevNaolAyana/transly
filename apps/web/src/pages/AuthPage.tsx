import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { USE_MOCKS } from '../lib/constants'
import { Alert, Button, Card, Field, inputCls } from '../components/ui'

export default function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { user, signIn, signUp } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/upload'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  if (user) return <Navigate to={from} replace />

  const isLogin = mode === 'login'

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (!isLogin && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    setBusy(true)
    try {
      if (isLogin) {
        await signIn(email.trim(), password)
        nav(from, { replace: true })
      } else {
        const signedIn = await signUp(email.trim(), password)
        if (signedIn) nav(from, { replace: true })
        else setNotice('Account created. Check your email for a confirmation link, then sign in.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="mb-4 text-2xl font-bold">{isLogin ? 'Sign in' : 'Create your account'}</h1>
        {USE_MOCKS && (
          <div className="mb-4">
            <Alert tone="warn" title="Mock login">
              Any email and password works. Use an email containing “translator” to see the translator screen.
            </Alert>
          </div>
        )}
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Password" hint={isLogin ? undefined : 'At least 8 characters.'}>
            <input
              className={inputCls}
              type="password"
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <Alert tone="error" title={isLogin ? 'Could not sign in' : 'Could not create account'}>{error}</Alert>}
          {notice && <Alert tone="success">{notice}</Alert>}
          <Button type="submit" className="w-full" loading={busy}>
            {isLogin ? 'Sign in' : 'Create account'}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-600">
          {isLogin ? (
            <>New to Transly? <Link className="font-semibold text-brand-700 underline" to="/register">Create an account</Link></>
          ) : (
            <>Already have an account? <Link className="font-semibold text-brand-700 underline" to="/login">Sign in</Link></>
          )}
        </p>
      </Card>
    </div>
  )
}
