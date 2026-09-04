import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Field, inputClass } from '../components/ui.jsx'

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

  return (
    <div className="flex min-h-screen bg-ink">
      {/* Left: brand + feature grid */}
      <div className="relative hidden w-1/2 flex-col overflow-hidden p-12 md:flex">
        <div className="absolute right-10 top-10 w-36 opacity-80">
          <PulseWaveform />
        </div>

        <div className="pr-32">
          <span className="font-display text-2xl font-semibold text-paper">MedVerse AI</span>
          <p className="mt-2 max-w-xs text-sm text-paper/60">
            Clinical intelligence platform — RAG-grounded assistant, report understanding, and
            predictive risk, in one console.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center">
          <RiskCardMockup />
        </div>
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

function RiskCardMockup() {
  return (
    <div className="relative w-full max-w-sm">
      <div className="absolute -inset-10 rounded-full bg-pulse/25 blur-3xl" />
      <div className="absolute -inset-10 translate-x-10 rounded-full bg-amber/10 blur-3xl" />

      <div className="absolute inset-0 translate-x-4 translate-y-5 rotate-3 rounded-lg bg-paper/10" />

      <div className="relative -rotate-2 rounded-lg border border-white/10 bg-paper p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-alert/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber/50" />
            <span className="h-2.5 w-2.5 rounded-full bg-pulse/50" />
          </div>
          <span className="readout-label">Disease Risk Check</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="readout-label">Diabetes risk</div>
            <div className="font-mono text-3xl font-medium text-alert">
              77.1<span className="ml-0.5 text-base text-muted">%</span>
            </div>
          </div>
          <div>
            <div className="readout-label">Heart disease</div>
            <div className="font-mono text-3xl font-medium text-alert">
              58.7<span className="ml-0.5 text-base text-muted">%</span>
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2 border-t border-line pt-4">
          <div className="readout-label mb-1">Suggestions</div>
          <div className="h-1.5 w-full rounded-full bg-line" />
          <div className="h-1.5 w-4/5 rounded-full bg-line" />
          <div className="h-1.5 w-3/5 rounded-full bg-line" />
        </div>
      </div>
    </div>
  )
}
