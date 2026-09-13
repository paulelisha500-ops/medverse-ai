/**
 * MedVerse AI logo.
 *
 * A blue tile carrying a single heartbeat, echoing the waveform the landing
 * page and the sign-in panel already use. The tile is blue rather than navy so
 * the mark holds up on both the cream page and the navy sidebar without
 * needing a second version of itself.
 *
 * The trace is drawn on a 32-unit grid with a heavy stroke and only four
 * direction changes, so it still reads as a heartbeat at favicon size.
 */

const TRACE = 'M6 19h3.6l2.2-5.4L15.4 24l2.9-8.2 1.9 3.2H26'

export function LogoMark({ size = 32, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="MedVerse AI"
    >
      <defs>
        <linearGradient id="medverse-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2A70C2" />
          <stop offset="100%" stopColor="#16325B" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#medverse-mark)" />
      <path
        d={TRACE}
        fill="none"
        stroke="#F5F1E6"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Mark plus wordmark. `tone="dark"` is for placing it on the navy sidebar or
 * the sign-in panel; the default is for the cream page.
 */
export function Logo({ size = 32, tone = 'light', className = '', textClass = 'text-xl' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark size={size} />
      <span
        className={`font-display font-semibold tracking-tight ${textClass} ${
          tone === 'dark' ? 'text-paper' : 'text-ink'
        }`}
      >
        MedVerse<span className={tone === 'dark' ? 'text-pulse-dim' : 'text-pulse'}> AI</span>
      </span>
    </span>
  )
}
