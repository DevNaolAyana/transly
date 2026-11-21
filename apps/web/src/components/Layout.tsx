import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { USE_MOCKS } from '../lib/constants'
import { Alert, PageLoading } from './ui'

export function MockBanner() {
  if (!USE_MOCKS) return null
  return (
    <div
      role="status"
      data-testid="mock-banner"
      className="sticky top-0 z-50 border-b border-amber-600 bg-amber-400 px-3 py-1.5 text-center text-xs font-bold text-amber-950"
    >
      MOCK DATA — fake backend and fake login for UI demo only. Nothing here is real or verifiable.
    </div>
  )
}

export function Layout() {
  const { user, role, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { pathname } = useLocation()
  // Close the mobile menu whenever the page changes (also for links inside the page, not just the menu).
  useEffect(() => setOpen(false), [pathname])
  const headerRef = useRef<HTMLElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  // Open menu: Escape or a tap outside the header closes it.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      menuBtnRef.current?.focus()
    }
    const onDown = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-100 text-brand-900' : 'text-slate-700 hover:bg-slate-100'}`
  return (
    <div className="flex min-h-dvh flex-col">
      <MockBanner />
      <header ref={headerRef} className="no-print relative border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-xl font-extrabold tracking-tight text-brand-700">
            Transly
          </Link>
          <button
            ref={menuBtnRef}
            className="min-h-11 min-w-11 rounded-md p-2 text-slate-700 sm:hidden"
            aria-label="Menu"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen((o) => !o)}
          >
            ☰
          </button>
          <nav id="main-nav" aria-label="Main" className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-full z-10 flex-col gap-1 border-b bg-white p-3 sm:static sm:flex sm:flex-row sm:items-center sm:border-0 sm:p-0`} onClick={() => setOpen(false)}>
            {user ? (
              <>
                <NavLink to="/upload" className={link}>New document</NavLink>
                <NavLink to="/documents" className={link}>My documents</NavLink>
                {role === 'translator' && <NavLink to="/translator" className={link}>Translator queue</NavLink>}
                <span className="break-all px-3 text-xs text-slate-500 sm:max-w-56 sm:truncate" title={user.email ?? undefined}>{user.email}</span>
                <button
                  className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => signOut().catch((e) => setErr(e.message))}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <NavLink to="/login" className={link}>Sign in</NavLink>
                <Link to="/register" className="rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white">Create account</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {err && <div className="mx-auto w-full max-w-5xl px-4 pt-3"><Alert tone="error" title="Sign-out failed">{err}</Alert></div>}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="no-print border-t border-slate-200 bg-white px-4 py-4 text-center text-xs text-slate-500">
        Transly is an independent project. It is not a government service and is not certified by or affiliated with any government body.
      </footer>
    </div>
  )
}

export function RequireAuth() {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <PageLoading />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  return <Outlet />
}

export function RequireTranslator() {
  const { role, loading, profileError } = useAuth()
  if (loading) return <PageLoading />
  if (role !== 'translator') {
    return (
      <Alert tone="warn" title="Translator access only">
        Your account does not have the translator role.
        {profileError ? ` (Profile check failed: ${profileError})` : ''}
      </Alert>
    )
  }
  return <Outlet />
}
