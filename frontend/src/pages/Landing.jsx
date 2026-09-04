import { Link } from 'react-router-dom'
import {
  Stethoscope,
  UserCircle,
  MessageSquareText,
  Activity,
  Pill,
  FileText,
  LogIn,
  Search,
  Sparkles,
} from 'lucide-react'
import { Button } from '../components/ui.jsx'

const HERO_IMG = 'https://images.unsplash.com/photo-1758691461990-03b49d969495?auto=format&fit=crop&w=1400&q=80'
const CLINIC_IMG = 'https://images.unsplash.com/photo-1720180246446-d1738fe8ca76?auto=format&fit=crop&w=1400&q=80'
const TECH_IMG = 'https://images.unsplash.com/photo-1758691462848-31a39258dbd8?auto=format&fit=crop&w=1400&q=80'
const TABLET_IMG = 'https://images.unsplash.com/photo-1666886573301-b5d526cfd518?auto=format&fit=crop&w=1400&q=80'

const STACK = ['React', 'FastAPI', 'scikit-learn', 'sentence-transformers', 'FAISS', 'SQLAlchemy']

const STEPS = [
  { icon: LogIn, title: 'Sign in', body: 'Use a demo account or create your own patient login — no setup required.' },
  { icon: Search, title: 'Ask, check, or assess', body: 'Chat with the assistant, run a medication check, or calculate disease risk.' },
  { icon: Sparkles, title: 'Get grounded answers', body: 'Every answer shows its sources — retrieved from a real knowledge base, not invented.' },
]

export default function Landing() {
  return (
    <div className="bg-paper">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-line/0 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="font-display text-xl font-semibold text-ink">MedVerse AI</span>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-ink hover:text-pulse-dark">
              Sign in
            </Link>
            <Link to="/register">
              <Button>Create account</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 md:items-center md:py-20">
        <div>
          <div className="mb-4 w-40 text-pulse/70">
            <PulseWaveform />
          </div>
          <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            Clinical intelligence, grounded in your own data.
          </h1>
          <p className="mt-4 max-w-md text-base text-muted">
            A RAG-powered assistant, real NLP report extraction, trained risk models, and a
            medication interaction checker — behind role-based dashboards for patients, doctors,
            and admins.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link to="/login">
              <Button className="px-6 py-3 text-base">Sign in</Button>
            </Link>
            <Link to="/register" className="text-sm font-medium text-ink underline hover:text-pulse-dark">
              Create a patient account
            </Link>
          </div>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 -z-10 rounded-full bg-pulse/15 blur-3xl" />
          <img
            src={HERO_IMG}
            alt="Clinician and patient in a consultation"
            className="aspect-[4/3] w-full rounded-lg object-cover shadow-2xl"
          />
        </div>
      </section>

      {/* "We connect" sentence */}
      <section className="border-y border-line bg-surface py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="readout-label mb-4">Our approach</div>
          <p className="font-display text-2xl leading-relaxed text-ink md:text-3xl">
            We connect{' '}
            <InlineBadge icon={UserCircle} label="patients" />, {' '}
            <InlineBadge icon={Stethoscope} label="doctors" />, and{' '}
            <InlineBadge icon={MessageSquareText} label="AI-grounded insight" /> — so care
            decisions happen with context, not guesswork.
          </p>
        </div>
      </section>

      {/* Patients */}
      <AudienceSection
        img={TABLET_IMG}
        alt="Reviewing health information on a tablet"
        eyebrow="For patients"
        title="Your own record, always at hand"
        body="See your medical history, ask the assistant plain-language questions, check a
          medication combination before you take it, and get an educational risk estimate — all
          from one dashboard."
        icon={UserCircle}
        imageSide="left"
      />

      {/* Doctors */}
      <AudienceSection
        img={TECH_IMG}
        alt="Clinician reviewing records on a laptop"
        eyebrow="For doctors"
        title="Patient context, without the digging"
        body="Pull up any patient's panel and fuse their real record into the assistant. Ask a
          clinical question and get an answer grounded in their actual history — sourced, not
          guessed."
        icon={Stethoscope}
        imageSide="right"
      />

      {/* Admins */}
      <AudienceSection
        img={CLINIC_IMG}
        alt="Bright clinic corridor"
        eyebrow="For admins"
        title="Platform-wide visibility"
        body="Track patients, staff, and usage across the whole platform from a single
          role-aware dashboard — built for oversight, not just individual charts."
        icon={FileText}
        imageSide="left"
      />

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="mb-10 text-center">
          <div className="readout-label">Get started</div>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
            Get started in three easy steps
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title} className="card relative overflow-hidden p-6">
              <span className="font-mono text-xs text-pulse-dark">0{i + 1}</span>
              <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
                <Icon size={20} />
              </div>
              <div className="mt-4 font-display text-lg font-medium text-ink">{title}</div>
              <p className="mt-1.5 text-sm text-muted">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="border-y border-line bg-surface py-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <div className="readout-label">Real engineering, not a chatbot wrapper</div>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Best-in-class technology</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-muted">
            Sentence-transformer embeddings and FAISS retrieval ground every AI answer in a real
            knowledge base. Regex-based lab-value extraction runs with zero API keys. Two
            scikit-learn models score diabetes and heart-disease risk with explainable factors.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <Activity size={20} className="text-pulse-dark" />
            <Pill size={20} className="text-pulse-dark" />
            <MessageSquareText size={20} className="text-pulse-dark" />
            <FileText size={20} className="text-pulse-dark" />
          </div>
        </div>
      </section>

      {/* Honest tech-stack row (dark) */}
      <section className="bg-ink py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="readout-label text-paper/50">Built with</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {STACK.map((name) => (
              <span key={name} className="font-display text-lg text-paper/70">
                {name}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-display text-3xl font-semibold text-ink">Ready to take a look?</h2>
        <p className="mt-3 text-muted">Sign in with a demo account or create your own patient login.</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link to="/login">
            <Button className="px-6 py-3 text-base">Sign in</Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted md:flex-row">
          <span>MedVerse AI</span>
          <div className="flex gap-5">
            <Link to="/login" className="hover:text-ink">Sign in</Link>
            <Link to="/register" className="hover:text-ink">Create account</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function AudienceSection({ img, alt, eyebrow, title, body, icon: Icon, imageSide }) {
  const imageEl = (
    <div className="relative">
      <img src={img} alt={alt} className="aspect-[4/3] w-full rounded-lg object-cover shadow-lg" />
    </div>
  )
  const textEl = (
    <div>
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
        <Icon size={20} />
      </div>
      <div className="readout-label mt-4">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h2>
      <p className="mt-4 text-base text-muted">{body}</p>
    </div>
  )

  return (
    <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
      {imageSide === 'left' ? (
        <>
          {imageEl}
          {textEl}
        </>
      ) : (
        <>
          <div className="md:order-2">{imageEl}</div>
          <div className="md:order-1">{textEl}</div>
        </>
      )}
    </section>
  )
}

function InlineBadge({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
        <Icon size={14} />
      </span>
      <span className="font-medium text-ink">{label}</span>
    </span>
  )
}

function PulseWaveform() {
  return (
    <svg viewBox="0 0 400 120" className="w-full" role="img" aria-label="Animated vitals waveform">
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
