import { useState } from 'react'
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
  ChevronDown,
  Plus,
  Minus,
  BrainCircuit,
  ScanText,
  LineChart,
  ShieldCheck,
  ArrowRight,
} from 'lucide-react'
import { Button } from '../components/ui.jsx'
import { Reveal, Counter, TiltCard, Marquee, BorderBeam, GlowBackdrop } from '../components/motion.jsx'

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

const STATS = [
  { value: 990, label: 'Medications in the directory' },
  { value: 230, label: 'Documented interactions' },
  { value: 674, label: 'Brand names recognized' },
  { value: 0, label: 'API keys required to run' },
]

const TRUST_PILLS = [
  'RAG-grounded answers', 'FDA pharmacologic classes', 'Typo-tolerant matching',
  'Role-based access', 'Opioid dose conversion', 'Zero API keys', 'MIT licensed',
  '74 knowledge-base topics', 'Explainable risk models',
]

const PLATFORM_ITEMS = [
  { icon: MessageSquareText, label: 'AI Assistant', body: 'RAG-grounded chat over a real knowledge base' },
  { icon: FileText, label: 'Report Analysis', body: 'Regex + LLM extraction of labs, meds, diagnoses' },
  { icon: Activity, label: 'Risk Check', body: 'Trained diabetes & heart-disease risk models' },
  { icon: Pill, label: 'Medication Checker', body: '990 drugs, 230 curated interactions' },
]

const TECH_DETAILS = [
  {
    icon: BrainCircuit,
    title: 'RAG Assistant',
    body: 'sentence-transformers (all-MiniLM-L6-v2) embeds a hand-written knowledge base; FAISS does the vector search. Answers cite their retrieved passages. LLM generation is pluggable — OpenAI, Anthropic, Ollama, or a retrieval-only fallback with zero keys.',
  },
  {
    icon: ScanText,
    title: 'NLP Report Extraction',
    body: 'Lab values are pulled out with hand-written regex patterns — no API key needed for that part. Diagnosis and medication extraction, plus dual patient/clinical summaries, use the configured LLM.',
  },
  {
    icon: LineChart,
    title: 'Risk Prediction',
    body: 'Two scikit-learn logistic regression models — one for diabetes, one for heart disease — trained on synthetic data at first run, with coefficient-based "top contributing factor" explainability.',
  },
  {
    icon: ShieldCheck,
    title: 'Medication Interactions',
    body: '990 medications — 484 hand-curated with typical dosing, 506 more imported from the FDA drug directory — across 674 brand/generic aliases, with 230 hand-reviewed interaction pairs and typo-tolerant fuzzy matching (difflib) so near-miss spellings still resolve.',
  },
]

const FAQS = [
  {
    q: 'Is this connected to a real hospital system or EHR?',
    a: 'No. This is a self-contained portfolio project with its own database, seeded with synthetic demo data — it has no connection to any real patient records or health system.',
  },
  {
    q: 'Do I need an API key to try it?',
    a: 'No. The RAG assistant works with zero keys in retrieval-only mode. Setting an OpenAI, Anthropic, or local Ollama key unlocks full generated answers, but nothing else in the app requires one.',
  },
  {
    q: 'Can I use this for real medical decisions?',
    a: 'No — it\'s a demonstration of RAG, NLP, and ML engineering, not a certified medical device. Risk scores, extracted report data, and assistant answers are educational, not diagnostic.',
  },
  {
    q: 'What can I actually do without creating an account?',
    a: 'You can look around this page and the demo accounts\' credentials are available on request — sign in to explore the AI Assistant, Report Analysis, Risk Check, Medication Checker, and role-based dashboards.',
  },
  {
    q: 'Is the medication database exhaustive?',
    a: 'No. 484 medications are hand-curated with typical adult dosing, alongside 230 hand-reviewed interaction pairs. A further 506 come from the FDA drug directory as reference entries — those carry no dosing regimen and are deliberately excluded from interaction checking. It is illustrative, not a substitute for a pharmacist.',
  },
]

export default function Landing() {
  return (
    <div className="bg-paper">
      <AnnouncementBar />
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <GlowBackdrop className="-left-32 top-0 h-96 w-96" tone="pulse" />
        <GlowBackdrop className="right-0 top-40 h-80 w-80" tone="amber" />

        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 md:items-center md:py-20">
          <div>
            <Reveal y={14}>
              <div className="mb-4 w-40 text-pulse/70">
                <PulseWaveform />
              </div>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
                Clinical intelligence, grounded in your own data.
              </h1>
            </Reveal>
            <Reveal delay={170}>
              <p className="mt-4 max-w-md text-base text-muted">
                A RAG-powered assistant, real NLP report extraction, trained risk models, and a
                medication interaction checker — behind role-based dashboards for patients, doctors,
                and admins.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/login">
                  <Button className="group relative overflow-hidden px-6 py-3 text-base">
                    <span className="relative z-10 flex items-center gap-2">
                      Sign in
                      <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                    </span>
                  </Button>
                </Link>
                <Link
                  to="/register"
                  className="text-sm font-medium text-ink underline decoration-line underline-offset-4 transition-colors hover:text-pulse-dark hover:decoration-pulse"
                >
                  Create a patient account
                </Link>
              </div>
            </Reveal>
            <Reveal delay={340}>
              <div className="mt-8 flex items-center gap-6 border-t border-line pt-6">
                {STATS.slice(0, 3).map(({ value, label }) => (
                  <div key={label}>
                    <div className="font-display text-2xl font-semibold text-ink">
                      <Counter value={value} />
                    </div>
                    <div className="text-xs text-muted">{label}</div>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={140} y={28}>
            <TiltCard className="rounded-lg">
              <div className="absolute -inset-6 -z-10 rounded-full bg-pulse/15 blur-3xl" />
              <div className="relative overflow-hidden rounded-lg shadow-2xl">
                <img
                  src={HERO_IMG}
                  alt="Clinician and patient in a consultation"
                  className="aspect-[4/3] w-full object-cover"
                />
                <BorderBeam />
              </div>

              {/* Floating readouts layered over the photo */}
              <div className="absolute -bottom-5 -left-5 animate-float rounded-lg border border-line bg-surface/95 p-3 shadow-xl backdrop-blur">
                <div className="readout-label">Interaction check</div>
                <div className="mt-1 flex items-center gap-2 text-sm font-medium text-ink">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-alert" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-alert" />
                  </span>
                  Warfarin + Aspirin
                </div>
              </div>
              <div
                className="absolute -right-4 -top-4 animate-float rounded-lg border border-line bg-surface/95 px-3 py-2 shadow-xl backdrop-blur"
                style={{ animationDelay: '1.5s' }}
              >
                <div className="readout-label">Risk score</div>
                <div className="font-mono text-lg font-medium text-amber">77.1%</div>
              </div>
            </TiltCard>
          </Reveal>
        </div>

        {/* Capability marquee */}
        <div className="pb-12">
          <Marquee items={TRUST_PILLS} label="Platform capabilities" />
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

      {/* Stat band */}
      <section className="relative overflow-hidden bg-alert py-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <dl className="relative mx-auto grid max-w-5xl gap-8 px-6 text-center text-paper sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ value, label }, i) => (
            <Reveal key={label} delay={i * 90} as="div" className="group">
              <dd className="font-display text-5xl font-semibold transition-transform duration-300 group-hover:scale-105">
                <Counter value={value} />
              </dd>
              <dt className="mt-2 text-sm text-paper/70">{label}</dt>
            </Reveal>
          ))}
        </dl>
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
            <Reveal key={title} delay={i * 110}>
              <TiltCard max={5} className="h-full rounded-lg">
                <div className="card group relative h-full overflow-hidden p-6">
                  {/* Oversized step numeral bleeding off the corner */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -right-3 -top-5 font-display text-7xl font-semibold text-pulse/[0.07] transition-all duration-500 group-hover:text-pulse/[0.12]"
                  >
                    {i + 1}
                  </span>
                  <span className="font-mono text-xs text-pulse-dark">0{i + 1}</span>
                  <div className="mt-3 flex h-11 w-11 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark transition-transform duration-300 group-hover:scale-110">
                    <Icon size={20} />
                  </div>
                  <div className="mt-4 font-display text-lg font-medium text-ink">{title}</div>
                  <p className="mt-1.5 text-sm text-muted">{body}</p>
                </div>
              </TiltCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Technology — detailed overview */}
      <section id="technology" className="scroll-mt-20 border-y border-line bg-surface py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 text-center">
            <div className="readout-label">Real engineering, not a chatbot wrapper</div>
            <h2 className="mt-2 font-display text-3xl font-semibold text-ink">
              What's actually running under the hood
            </h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {TECH_DETAILS.map(({ icon: Icon, title, body }, i) => (
              <Reveal key={title} delay={i * 90}>
                <TiltCard max={4} className="h-full rounded-lg">
                  <div className="card group h-full p-6 transition-shadow duration-300 hover:shadow-xl">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark transition-transform duration-300 group-hover:scale-110">
                      <Icon size={20} />
                    </div>
                    <div className="mt-4 font-display text-lg font-medium text-ink">{title}</div>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                  </div>
                </TiltCard>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Honest tech-stack row (dark) */}
      <section className="bg-ink py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="readout-label text-paper/50">Built with</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
            {STACK.map((name, i) => (
              <Reveal key={name} delay={i * 70} y={12}>
                <span className="font-display text-lg text-paper/60 transition-colors duration-300 hover:text-paper">
                  {name}
                </span>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-6 py-20">
        <div className="mb-10 text-center">
          <div className="readout-label">FAQ</div>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Common questions</h2>
        </div>
        <div className="space-y-3">
          {FAQS.map((item) => (
            <FaqItem key={item.q} {...item} />
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-4xl px-6 pb-20">
        <Reveal>
          <div className="relative overflow-hidden rounded-lg border border-line bg-surface px-6 py-14 text-center shadow-lg">
            {/* A wash inside the card — a blurred blob behind an opaque card
                only shows where it overflows, which reads as a smudge. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(560px circle at 50% -10%, rgb(111 78 55 / 0.10), transparent 70%)',
              }}
            />
            <BorderBeam duration={8} />
            <h2 className="relative font-display text-3xl font-semibold text-ink">
              Ready to take a look?
            </h2>
            <p className="relative mt-3 text-muted">
              Sign in with a demo account or create your own patient login.
            </p>
            <div className="relative mt-6 flex flex-wrap items-center justify-center gap-3">
              <Link to="/login">
                <Button className="group px-6 py-3 text-base">
                  <span className="flex items-center gap-2">
                    Sign in
                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </Button>
              </Link>
              <Link
                to="/register"
                className="rounded border border-line px-6 py-3 text-base font-medium text-ink transition-colors hover:border-pulse hover:text-pulse-dark"
              >
                Create an account
              </Link>
            </div>
          </div>
        </Reveal>
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

function AnnouncementBar() {
  return (
    <div className="bg-ink py-2 text-center text-xs font-medium text-paper">
      New: 990-medication database with real-time interaction checking —{' '}
      <Link to="/login" className="underline hover:text-pulse">Try it now</Link>
    </div>
  )
}

function Nav() {
  const [platformOpen, setPlatformOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-8">
          <span className="font-display text-xl font-semibold text-ink">MedVerse AI</span>
          <nav className="hidden items-center gap-6 md:flex">
            <div
              className="relative"
              onMouseEnter={() => setPlatformOpen(true)}
              onMouseLeave={() => setPlatformOpen(false)}
            >
              <button className="flex items-center gap-1 text-sm font-medium text-ink hover:text-pulse-dark">
                Platform <ChevronDown size={14} />
              </button>
              {platformOpen && (
                <div className="absolute left-0 top-full w-72 rounded-lg border border-line bg-surface p-2 shadow-xl">
                  {PLATFORM_ITEMS.map(({ icon: Icon, label, body }) => (
                    <div key={label} className="flex gap-3 rounded-md p-2 hover:bg-pulse-dim">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
                        <Icon size={15} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">{label}</div>
                        <div className="text-xs text-muted">{body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <a href="#technology" className="text-sm font-medium text-ink hover:text-pulse-dark">
              Technology
            </a>
            <a href="#faq" className="text-sm font-medium text-ink hover:text-pulse-dark">
              FAQ
            </a>
          </nav>
        </div>
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
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <span className="font-medium text-ink">{q}</span>
        {open ? <Minus size={16} className="shrink-0 text-muted" /> : <Plus size={16} className="shrink-0 text-muted" />}
      </button>
      {open && <p className="px-4 pb-4 text-sm leading-relaxed text-muted">{a}</p>}
    </div>
  )
}

function AudienceSection({ img, alt, eyebrow, title, body, icon: Icon, imageSide }) {
  const imageEl = (
    <Reveal y={26} x={imageSide === 'left' ? -18 : 18}>
      <TiltCard max={4} className="rounded-lg">
        <div className="relative overflow-hidden rounded-lg shadow-lg">
          <img
            src={img}
            alt={alt}
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 hover:scale-105"
          />
        </div>
      </TiltCard>
    </Reveal>
  )
  const textEl = (
    <Reveal delay={120}>
      <div className="group flex h-11 w-11 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark transition-transform duration-300 hover:scale-110">
        <Icon size={20} />
      </div>
      <div className="readout-label mt-4">{eyebrow}</div>
      <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{title}</h2>
      <p className="mt-4 text-base text-muted">{body}</p>
    </Reveal>
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
