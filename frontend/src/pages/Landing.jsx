import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { idlePrefetch, pageLoaders } from '../pageLoaders.js'
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
} from 'lucide-react'
import { Button } from '../components/ui.jsx'
import { Logo } from '../components/Logo.jsx'

const HERO_IMG = 'https://images.unsplash.com/photo-1758691462878-6edc3d3da1be?auto=format&fit=crop&w=1600&q=80'
const CLINIC_IMG = 'https://images.unsplash.com/photo-1682365114691-f0264ad25c52?auto=format&fit=crop&w=1400&q=80'
const TECH_IMG = 'https://images.unsplash.com/photo-1758691462848-31a39258dbd8?auto=format&fit=crop&w=1400&q=80'
const TABLET_IMG = 'https://images.unsplash.com/photo-1666886573301-b5d526cfd518?auto=format&fit=crop&w=1400&q=80'

// The browser edition (static hosting) runs everything client-side, so the
// copy that names the machinery describes whichever edition this is.
const BROWSER = __BROWSER_EDITION__

const STACK = BROWSER
  ? ['React', 'Transformers.js', 'ONNX Runtime Web', 'scikit-learn', 'openFDA', 'RxNorm']
  : ['React', 'FastAPI', 'scikit-learn', 'sentence-transformers', 'FAISS', 'SQLAlchemy']

// Every database figure this page quotes, in one place so the copy can't
// drift from the data again (checked against app/nlp/medication_data.py and
// the knowledge base).
const DB = {
  drugs: 990,
  curated: 484,
  reference: 506,
  interactions: 230,
  aliases: 674,
  topics: 75,
}

const STEPS = [
  { icon: LogIn, title: 'Sign in', body: 'Create your own patient login — no setup required.' },
  { icon: Search, title: 'Ask, check, or assess', body: 'Chat with the assistant, run a medication check, or calculate disease risk.' },
  { icon: Sparkles, title: 'Get grounded answers', body: 'Every answer shows its sources — retrieved from a real knowledge base, not invented.' },
]

const STATS = [
  { value: DB.drugs, label: 'Medications in the directory' },
  { value: DB.interactions, label: 'Documented interactions' },
  { value: DB.aliases, label: 'Brand names recognized' },
  { value: 0, label: 'API keys needed to run it' },
]

const CAPABILITIES = [
  'RAG-grounded answers',
  'FDA pharmacologic classes',
  'Typo-tolerant matching',
  'Role-based access',
  'Opioid dose conversion',
  'Zero API keys',
  'MIT licensed',
  `${DB.topics} knowledge-base topics`,
  'Explainable risk models',
]

const PLATFORM_ITEMS = [
  { icon: MessageSquareText, label: 'AI Assistant', body: 'RAG-grounded chat over a real knowledge base' },
  {
    icon: FileText,
    label: 'Report Analysis',
    body: BROWSER ? 'On-device extraction of labs, meds, diagnoses' : 'Regex + LLM extraction of labs, meds, diagnoses',
  },
  { icon: Activity, label: 'Risk Check', body: 'Trained diabetes & heart-disease risk models' },
  { icon: Pill, label: 'Medication Checker', body: `${DB.drugs} drugs, ${DB.interactions} curated interactions` },
]

const TECH_DETAILS = [
  {
    icon: BrainCircuit,
    title: 'RAG Assistant',
    body: BROWSER
      ? 'all-MiniLM-L6-v2 runs in your browser through Transformers.js and ranks a hand-written knowledge base embedded with sentence-transformers. Answers quote the best-matching passages and cite them, and your questions never leave your device.'
      : 'sentence-transformers (all-MiniLM-L6-v2) embeds a hand-written knowledge base; FAISS does the vector search. Answers cite their retrieved passages. LLM generation is pluggable — OpenAI, Anthropic, Ollama, or a retrieval-only fallback with zero keys.',
  },
  {
    icon: ScanText,
    title: 'NLP Report Extraction',
    body: BROWSER
      ? `Lab values are pulled out with hand-written regex patterns; diagnoses and medications are matched against a condition lexicon and the ${DB.drugs}-drug directory. Patient-friendly and clinical summaries are written from the findings against standard reference ranges, all on your device.`
      : 'Lab values are pulled out with hand-written regex patterns — no API key needed for that part. Diagnosis and medication extraction, plus dual patient/clinical summaries, use the configured LLM.',
  },
  {
    icon: LineChart,
    title: 'Risk Prediction',
    body: BROWSER
      ? 'Two scikit-learn logistic regression models — one for diabetes, one for heart disease — trained on synthetic data and evaluated right in your browser, with coefficient-based "top contributing factor" explainability.'
      : 'Two scikit-learn logistic regression models — one for diabetes, one for heart disease — trained on synthetic data at first run, with coefficient-based "top contributing factor" explainability.',
  },
  {
    icon: ShieldCheck,
    title: 'Medication Interactions',
    body: `${DB.drugs} medications (${DB.curated} hand-curated with typical dosing, ${DB.reference} more imported from the FDA drug directory) across ${DB.aliases} brand/generic aliases, with ${DB.interactions} hand-reviewed interaction pairs and typo-tolerant fuzzy matching (difflib) so near-miss spellings still resolve.`,
  },
]

const FAQS = [
  {
    q: 'Is this connected to a real hospital system or EHR?',
    a: BROWSER
      ? 'No. MedVerse runs entirely in your browser and has no connection to any real patient records or health system. Accounts and records you create are stored only on this device.'
      : 'No. This is a self-contained application with its own database — it has no connection to any real patient records or health system. Accounts you create live only in this app.',
  },
  {
    q: 'Do I need an API key to try it?',
    a: BROWSER
      ? 'No. Everything runs in your browser with zero keys. The assistant downloads its language model once (about 25 MB) and keeps it cached for next time.'
      : 'No. The RAG assistant works with zero keys in retrieval-only mode. Setting an OpenAI, Anthropic, or local Ollama key unlocks full generated answers, but nothing else in the app requires one.',
  },
  {
    q: 'Can I use this for real medical decisions?',
    a: 'No — it\'s built to showcase RAG, NLP, and ML engineering, not to serve as a certified medical device. Risk scores, extracted report data, and assistant answers are educational, not diagnostic.',
  },
  {
    q: 'What can I actually do without creating an account?',
    a: 'You can look around this page — sign in or register to explore the AI Assistant, Report Analysis, Risk Check, Medication Checker, and role-based dashboards.',
  },
  {
    q: 'Is the medication database exhaustive?',
    a: `No. ${DB.curated} medications are hand-curated with typical adult dosing, alongside ${DB.interactions} hand-reviewed interaction pairs. A further ${DB.reference} come from the FDA drug directory as reference entries; those carry no dosing regimen and are deliberately excluded from interaction checking. It is illustrative, not a substitute for a pharmacist.`,
  },
]

export default function Landing() {
  // Sign in / Create account are this page's two real destinations — warm
  // both chunks in the background so the click through feels instant.
  useEffect(() => {
    idlePrefetch(pageLoaders.login, pageLoaders.register)
  }, [])

  return (
    <div className="bg-paper">
      <AnnouncementBar />
      <Nav />

      {/* Hero */}
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-10 px-6 pb-14 pt-12 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start md:pb-16 md:pt-14">
          <div className="md:pt-2">
            <EcgStrip className="mb-6 w-56" />
            <h1 className="font-display text-5xl font-semibold leading-[1.02] tracking-tight text-ink md:text-6xl lg:text-[4.25rem]">
              Clinical intelligence,{' '}
              <span className="text-pulse-dark">grounded in your own data.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              A RAG-powered assistant, real NLP report extraction, trained risk models, and a medication
              interaction checker, behind role-based dashboards for patients, doctors, and admins.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link to="/login">
                <Button className="px-7 py-3 text-base">Sign in</Button>
              </Link>
              <Link
                to="/register"
                className="rounded border border-line bg-surface px-7 py-3 text-base font-medium text-ink transition-colors hover:border-ink"
              >
                Create a patient account
              </Link>
            </div>
          </div>

          <figure className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <img
              src={HERO_IMG}
              alt="A doctor at her desk reviewing records on a monitor while consulting a patient"
              className="aspect-[5/4] w-full object-cover"
            />
          </figure>

          {/* Spans both columns. The text column runs ~250px taller than the
              photo, so anything parked only on the left leaves that band of
              the page empty across from it. */}
          <dl className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 md:col-span-2">
            {STATS.slice(0, 3).map(({ value, label }) => (
              <div key={label} className="flex flex-col-reverse bg-surface px-5 py-4">
                <dt className="mt-1 text-sm text-muted">{label}</dt>
                <dd className="font-display text-3xl font-semibold text-ink">{value.toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Capability tiles. The hero grid is text-left/photo-right, so the row
            under the shorter column used to bottom out into empty paper —
            these carry the eye across that band instead. */}
        <div id="platform" className="mx-auto max-w-6xl scroll-mt-20 px-6">
          <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
            {PLATFORM_ITEMS.map(({ icon: Icon, label, body }) => (
              <div key={label} className="group h-full bg-surface p-5 transition-colors hover:bg-pulse-dim/50">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark transition-transform duration-300 group-hover:scale-110">
                  <Icon size={17} />
                </span>
                <div className="mt-3 font-display text-base font-medium text-ink">{label}</div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            ))}
          </div>
        </div>

        <ul aria-label="Platform capabilities" className="mx-auto flex max-w-4xl flex-wrap justify-center gap-2 px-6 py-12">
          {CAPABILITIES.map((item) => (
            <li key={item} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink">
              {item}
            </li>
          ))}
        </ul>
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
      <section className="bg-navy py-14">
        <dl className="mx-auto grid max-w-5xl gap-8 px-6 text-center text-paper sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map(({ value, label }) => (
            <div key={label} className="flex flex-col-reverse">
              <dt className="mt-2 text-sm text-paper/75">{label}</dt>
              <dd className="font-display text-5xl font-semibold">{value.toLocaleString()}</dd>
            </div>
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
        alt="A clean, equipped clinic consulting room"
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
        <ol className="grid gap-6 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="card flex h-full flex-col gap-3 p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-mono text-sm text-paper">
                  {i + 1}
                </span>
                <Icon size={20} className="text-pulse-dark" aria-hidden="true" />
              </div>
              <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
              <p className="text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
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
            {TECH_DETAILS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="card flex gap-4 p-6">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-pulse-dim text-pulse-dark">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div>
                  <h3 className="font-display text-lg font-medium text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Honest tech-stack row (dark) */}
      <section className="bg-ink py-14">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p className="readout-label text-paper/50">Built with</p>
          <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {STACK.map((name) => (
              <li key={name} className="font-display text-lg text-paper/70">{name}</li>
            ))}
          </ul>
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
      <section className="border-t border-line bg-surface">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-3xl font-semibold text-ink">Ready to take a look?</h2>
          <p className="mt-3 text-muted">
            Create your own patient login, or sign in if you already have one.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button className="px-6 py-3 text-base">Create an account</Button>
            </Link>
            <Link
              to="/login"
              className="rounded border border-line px-6 py-3 text-base font-medium text-ink transition-colors hover:border-ink"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-sm text-muted md:flex-row">
          <Logo size={24} textClass="text-base" />
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
      New: {DB.drugs}-medication database with real-time interaction checking.{' '}
      <Link to="/login" className="underline hover:text-pulse">Try it now</Link>
    </div>
  )
}

// In-page section links. They scroll rather than set the URL hash, which the
// browser edition's router uses for page routes.
function SectionLink({ to, onClick, ...props }) {
  return (
    <a
      href={`#${to}`}
      onClick={(e) => {
        e.preventDefault()
        onClick?.()
        document.getElementById(to)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }}
      {...props}
    />
  )
}

function Nav() {
  const [platformOpen, setPlatformOpen] = useState(false)

  return (
    <header className="sticky top-0 z-20 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-center gap-8">
          <Link to="/" aria-label="MedVerse AI home"><Logo textClass="text-lg sm:text-xl" /></Link>
          <nav className="hidden items-center gap-6 md:flex">
            <div
              className="relative"
              onMouseEnter={() => setPlatformOpen(true)}
              onMouseLeave={() => setPlatformOpen(false)}
            >
              <SectionLink to="platform" className="flex items-center gap-1 text-sm font-medium text-ink hover:text-pulse-dark">
                Platform <ChevronDown size={14} />
              </SectionLink>
              {platformOpen && (
                <div className="absolute left-0 top-full w-72 rounded-lg border border-line bg-surface p-2 shadow-xl">
                  {PLATFORM_ITEMS.map(({ icon: Icon, label, body }) => (
                    <SectionLink
                      key={label}
                      to="platform"
                      onClick={() => setPlatformOpen(false)}
                      className="flex gap-3 rounded-md p-2 hover:bg-pulse-dim"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
                        <Icon size={15} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink">{label}</div>
                        <div className="text-xs text-muted">{body}</div>
                      </div>
                    </SectionLink>
                  ))}
                </div>
              )}
            </div>
            <SectionLink to="technology" className="text-sm font-medium text-ink hover:text-pulse-dark">
              Technology
            </SectionLink>
            <SectionLink to="faq" className="text-sm font-medium text-ink hover:text-pulse-dark">
              FAQ
            </SectionLink>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          {/* Hidden on phones, where the wordmark and this link can't share a
              row with the button — the hero's first CTA is Sign in anyway. */}
          <Link to="/login" className="hidden whitespace-nowrap text-sm font-medium text-ink hover:text-pulse-dark sm:inline">
            Sign in
          </Link>
          <Link to="/register">
            <Button className="whitespace-nowrap">Create account</Button>
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
  // Below the fold, so the browser can leave these images until the reader
  // scrolls near them instead of competing with the hero photo.
  const imageEl = (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <img src={img} alt={alt} loading="lazy" className="aspect-[4/3] w-full object-cover" />
    </figure>
  )
  const textEl = (
    <div>
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
        <Icon size={20} aria-hidden="true" />
      </span>
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

/**
 * Hero vitals strip — a clean sinus rhythm on ECG paper.
 *
 * The trace is generated rather than hand-drawn so every beat is identical:
 * one cycle is P wave, QRS complex, T wave, drawn to scale against a 5mm/1mm
 * gridded background like a real rhythm strip. The sweep animation redraws the
 * line left to right; reduced motion leaves it fully drawn and still.
 */
const ECG_CYCLE = 200
const ECG_BASE = 62

function ecgPath(cycles) {
  let d = ''
  for (let i = 0; i < cycles; i += 1) {
    const x = i * ECG_CYCLE
    const b = ECG_BASE
    d += `${i === 0 ? 'M' : 'L'}${x} ${b} L${x + 22} ${b} `
      + `Q${x + 33} ${b - 18} ${x + 44} ${b} `        // P wave
      + `L${x + 56} ${b} L${x + 62} ${b + 8} `        // Q
      + `L${x + 70} ${b - 50} L${x + 78} ${b + 26} `  // R spike, S trough
      + `L${x + 86} ${b} L${x + 104} ${b} `
      + `Q${x + 124} ${b - 23} ${x + 144} ${b} `      // T wave
      + `L${x + ECG_CYCLE} ${b} `
  }
  return d.trim()
}

const ECG_TRACE = ecgPath(2)

function EcgStrip({ className = '' }) {
  return (
    <svg
      viewBox="0 0 400 110"
      className={`text-pulse ${className}`}
      role="img"
      aria-label="Electrocardiogram tracing showing a normal sinus rhythm"
    >
      {/* The full trace is always drawn — a line that spends half its animation
          blank just reads as empty space. The movement is a short bright
          segment sweeping along it, the way a monitor refreshes. */}
      <path
        d={ECG_TRACE}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeOpacity="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="ecg-sweep"
        d={ECG_TRACE}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        style={{ strokeDasharray: '0.22 0.78' }}
      />
      <style>{`
        .ecg-sweep { animation: ecg-sweep 3.4s linear infinite; }
        @keyframes ecg-sweep {
          from { stroke-dashoffset: 1; }
          to { stroke-dashoffset: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ecg-sweep { animation: none !important; stroke-dasharray: none; stroke-width: 2.25px; }
        }
      `}</style>
    </svg>
  )
}
