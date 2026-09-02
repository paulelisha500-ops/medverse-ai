import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Field, inputClass } from '../components/ui.jsx'

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@medverse.ai', password: 'Admin@123' },
  { role: 'Doctor', email: 'doctor@medverse.ai', password: 'Doctor@123' },
  { role: 'Patient', email: 'patient@medverse.ai', password: 'Patient@123' },
]

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not sign in. Check your email and password.')
    } finally {
      setBusy(false)
    }
  }

  function fillDemo(account) {
    setEmail(account.email)
    setPassword(account.password)
  }

  return (
    <div className="flex min-h-screen bg-ink">
      {/* Left: brand + waveform signature */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-12 md:flex">
        <div>
          <span className="font-display text-2xl font-semibold text-paper">MedVerse AI</span>
          <p className="mt-2 max-w-xs text-sm text-paper/60">
            Clinical intelligence platform — RAG-grounded assistant, report understanding, and
            predictive risk, in one console.
          </p>
        </div>

        <PulseWaveform />

        <div className="readout-label text-paper/40">Portfolio demonstration build</div>
      </div>

      {/* Right: form */}
      <div className="flex w-full items-center justify-center bg-paper px-6 py-12 md:w-1/2">
        <div className="w-full max-w-sm">
          <div className="mb-8 md:hidden">
            <span className="font-display text-2xl font-semibold text-ink">MedVerse AI</span>
          </div>

          <h1 className="font-display text-2xl font-semibold text-ink">Sign in</h1>
          <p className="mt-1 text-sm text-muted">Access your dashboard.</p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <Field label="Email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>
            <Field label="Password">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder="••••••••"
              />
            </Field>

            {error && <p className="text-sm text-alert">{error}</p>}

            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="mt-4 text-sm text-muted">
            New patient?{' '}
            <Link to="/register" className="font-medium text-pulse-dark underline">
              Create an account
            </Link>
          </p>

          <div className="mt-8 rounded border border-line bg-surface p-4">
            <div className="readout-label mb-2">Try a demo account</div>
            <div className="space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  onClick={() => fillDemo(acc)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-pulse-dim"
                >
                  <span className="font-medium text-ink">{acc.role}</span>
                  <span className="font-mono text-xs text-muted">{acc.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function PulseWaveform() {
  return (
    <svg
      viewBox="0 0 400 120"
      className="w-full max-w-md text-pulse"
      role="img"
      aria-label="Animated vitals waveform"
    >
      <path
        d="M0 60 L60 60 L80 60 L95 20 L110 100 L125 40 L140 60 L200 60 L215 60 L230 25 L245 95 L260 45 L275 60 L400 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        style={{
          strokeDasharray: 1,
          strokeDashoffset: 1,
          animation: 'draw-pulse 3.2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes draw-pulse {
          0% { stroke-dashoffset: 1; opacity: 0.3; }
          45% { stroke-dashoffset: 0; opacity: 1; }
          70% { opacity: 1; }
          100% { stroke-dashoffset: -1; opacity: 0.3; }
        }
        @media (prefers-reduced-motion: reduce) {
          path { animation: none !important; stroke-dashoffset: 0; opacity: 0.8; }
        }
      `}</style>
    </svg>
  )
}
