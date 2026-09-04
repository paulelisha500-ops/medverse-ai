import { Link } from 'react-router-dom'
import { Stethoscope, UserCircle, MessageSquareText, Activity, Pill, FileText } from 'lucide-react'
import { Button } from '../components/ui.jsx'

const HERO_IMG = 'https://images.unsplash.com/photo-1758691461990-03b49d969495?auto=format&fit=crop&w=1400&q=80'
const CLINIC_IMG = 'https://images.unsplash.com/photo-1720180246446-d1738fe8ca76?auto=format&fit=crop&w=1400&q=80'
const TECH_IMG = 'https://images.unsplash.com/photo-1758691462848-31a39258dbd8?auto=format&fit=crop&w=1400&q=80'

const AUDIENCES = [
  {
    icon: UserCircle,
    title: 'Patients',
    body: 'See your own record, ask the assistant plain questions, and check medications from anywhere.',
  },
  {
    icon: Stethoscope,
    title: 'Doctors',
    body: 'Pull up a patient panel, fuse their record into the assistant, and get sourced answers in seconds.',
  },
  {
    icon: FileText,
    title: 'Admins',
    body: 'Platform-wide visibility — patients, staff, and usage — in one dashboard.',
  },
]

const STACK = ['React', 'FastAPI', 'scikit-learn', 'sentence-transformers', 'FAISS', 'SQLAlchemy']

export default function Landing() {
  return (
    <div className="bg-paper">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl font-semibold text-ink">MedVerse AI</span>
        <div className="flex items-center gap-4">
          <Link to="/login" className="text-sm font-medium text-ink hover:text-pulse-dark">
            Sign in
          </Link>
          <Link to="/register">
            <Button>Create account</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-12 md:grid-cols-2 md:items-center md:py-20">
        <div>
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

      {/* Audience cards + clinic photo */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <img
          src={CLINIC_IMG}
          alt="Bright clinic corridor"
          className="aspect-[4/3] w-full rounded-lg object-cover shadow-lg md:order-2"
        />
        <div className="space-y-5 md:order-1">
          <div className="readout-label">Built for every role</div>
          {AUDIENCES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-4 rounded-lg border border-line bg-surface p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pulse-dim text-pulse-dark">
                <Icon size={18} />
              </div>
              <div>
                <div className="font-display font-medium text-ink">{title}</div>
                <p className="mt-0.5 text-sm text-muted">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Technology */}
      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-2 md:items-center">
        <div>
          <div className="readout-label">Real engineering, not a chatbot wrapper</div>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Best-in-class technology</h2>
          <p className="mt-4 text-base text-muted">
            Sentence-transformer embeddings and FAISS retrieval ground every AI answer in a real
            knowledge base. Regex-based lab-value extraction runs with zero API keys. Two
            scikit-learn models score diabetes and heart-disease risk with explainable factors.
          </p>
          <div className="mt-6 flex gap-3">
            <Activity size={18} className="text-pulse-dark" />
            <Pill size={18} className="text-pulse-dark" />
            <MessageSquareText size={18} className="text-pulse-dark" />
            <FileText size={18} className="text-pulse-dark" />
          </div>
        </div>
        <img
          src={TECH_IMG}
          alt="Clinician working on a laptop"
          className="aspect-[4/3] w-full rounded-lg object-cover shadow-lg"
        />
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
