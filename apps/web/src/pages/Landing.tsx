import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  { n: 1, t: 'Upload', d: 'Take a photo or upload a JPG, PNG or PDF of your document.' },
  { n: 2, t: 'Check the text', d: 'We read the document for you. You fix anything that was unclear.' },
  { n: 3, t: 'Translate', d: 'Machine translation between Afaan Oromo, Amharic and English. You can edit it, or send it to a human translator for review.' },
  { n: 4, t: 'Get a PDF with a QR code', d: 'Anyone who scans the QR code can check the document on Transly.' },
]

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-brand-900 px-5 py-10 text-white sm:px-10 sm:py-14">
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-brand-100">Afaan Oromo · አማርኛ · English</p>
        <h1 className="text-3xl font-extrabold leading-tight sm:text-5xl">Translate your documents. Let anyone verify them.</h1>
        <p className="mt-4 max-w-2xl text-base text-brand-100 sm:text-lg">
          Transly translates documents between Afaan Oromo, Amharic and English, lets a human translator review them, and
          adds a QR code so the recipient can check the translation online.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to={user ? '/upload' : '/register'}
            className="rounded-lg bg-white px-5 py-3 text-center font-semibold text-brand-900 hover:bg-brand-50"
          >
            {user ? 'Translate a document' : 'Create a free account'}
          </Link>
          {!user && (
            <Link to="/login" className="rounded-lg border border-white/50 px-5 py-3 text-center font-semibold hover:bg-white/10">
              Sign in
            </Link>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">How it works</h2>
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 font-bold text-white">{s.n}</span>
              <div>
                <p className="font-semibold">{s.t}</p>
                <p className="text-sm text-slate-600">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Machine or human reviewed — always labelled</h2>
          <p className="mt-1 text-sm text-slate-600">
            Every PDF says clearly whether it was machine translated or reviewed by a named human translator. We never hide which one it is.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="font-bold">Honest about what we are</h2>
          <p className="mt-1 text-sm text-slate-600">
            Transly is an independent service. It is not a government body, and it is not certified by or partnered with any government office.
            Check whether the office you submit to accepts it.
          </p>
        </div>
      </section>
    </div>
  )
}
