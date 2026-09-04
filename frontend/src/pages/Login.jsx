import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { HeartPulse, Stethoscope, Pill, Activity, MessageSquareText, FileText } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { Button, Field, inputClass } from '../components/ui.jsx'

const TRUST_BADGES = ['RAG-Grounded', 'Role-Based Access', 'MIT Licensed']

const ORBIT_ICONS = [
  { icon: Stethoscope, top: '14%', left: '50%' },
  { icon: Pill, top: '39%', left: '84%' },
  { icon: Activity, top: '79%', left: '71%' },
  { icon: MessageSquareText, top: '79%', left: '29%' },
  { icon: FileText, top: '39%', left: '16%' },
]

const STEPS = [
  'Sign in to your dashboard',
  'Ask, check, or assess',
  'Get grounded, sourced answers',
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

        <div className="mt-6 flex flex-wrap gap-2">
          {TRUST_BADGES.map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-paper/70"
            >
              {label}
            </span>
          ))}
        </div>

        <div className="flex flex-1 items-center justify-center">
          <CareOrbit />
        </div>

        <div className="grid grid-cols-3 gap-3">
          {STEPS.map((label, i) => (
            <div key={label} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <span className="font-mono text-xs text-pulse">0{i + 1}</span>
              <div className="mt-1 text-xs leading-snug text-paper/60">{label}</div>
            </div>
          ))}
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

function CareOrbit() {
  return (
    <div className="relative h-64 w-64">
      <div className="absolute inset-0 rounded-full bg-pulse/15 blur-3xl" />

      {/* Orbit rings */}
      <div className="absolute inset-0 rounded-full border border-dashed border-white/15" />
      <div className="absolute inset-8 rounded-full border border-dashed border-white/10" />

      {/* Center: platform icon */}
      <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-pulse shadow-lg">
        <HeartPulse size={24} className="text-paper" />
      </div>

      {/* Orbiting feature icons */}
      {ORBIT_ICONS.map(({ icon: Icon, top, left }) => (
        <div
          key={top + left}
          className="absolute flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-paper shadow-md"
          style={{ top, left }}
        >
          <Icon size={16} className="text-pulse-dark" />
        </div>
      ))}
    </div>
  )
}
