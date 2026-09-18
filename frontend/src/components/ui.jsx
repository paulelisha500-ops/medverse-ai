export function PageHeader({ title, subtitle }) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
    </div>
  )
}

export function Readout({ label, value, unit, tone = 'default' }) {
  const toneClass =
    tone === 'alert' ? 'text-alert' : tone === 'amber' ? 'text-amber' : tone === 'pulse' ? 'text-pulse' : 'text-ink'
  return (
    <div>
      <div className="readout-label">{label}</div>
      <div className={`font-mono text-3xl font-medium ${toneClass}`}>
        {value}
        {unit && <span className="ml-1 text-base text-muted">{unit}</span>}
      </div>
    </div>
  )
}

export function StatCard({ label, value, sub }) {
  return (
    <div className="card p-5">
      <div className="readout-label">{label}</div>
      <div className="mt-2 font-mono text-3xl font-medium text-ink">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  )
}

export function Badge({ severity, children }) {
  const map = {
    high: 'bg-alert/10 text-alert border-alert/30',
    moderate: 'bg-amber/10 text-amber border-amber/30',
    low: 'bg-pulse/10 text-pulse-dark border-pulse/30',
  }
  const cls = map[severity] || 'bg-line text-muted border-line'
  return (
    <span className={`inline-flex items-center rounded-sm border px-2 py-0.5 text-xs font-medium uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  )
}

export function Button({ variant = 'primary', className = '', ...props }) {
  const base = 'inline-flex items-center justify-center rounded font-medium text-sm px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-ink text-paper hover:bg-pulse-dark',
    secondary: 'bg-transparent border border-line text-ink hover:border-ink',
    danger: 'bg-alert text-white hover:bg-alert/90',
  }
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted/60 focus:border-pulse'

export function EmptyState({ title, description }) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="font-display text-lg font-medium text-ink">{title}</div>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
    </div>
  )
}

export function LoadingDots() {
  return (
    <span className="inline-flex gap-1">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted" />
    </span>
  )
}
