/**
 * MedVerse AI logo.
 *
 * A medical cross inside an open orbit, with a single satellite sitting in the
 * orbit's gap: the cross is the "Med", the orbit is the "Verse". It echoes the
 * ring of feature icons circling the core on the sign-in panel.
 *
 * Two tones, because a single version can't work on both grounds: on the navy
 * sidebar a navy cross vanishes, so `tone="dark"` swaps it to cream and lifts
 * the orbit to a lighter blue. Strokes are heavy enough to survive favicon
 * size — at 16px it still reads as a ring and a cross.
 */

const TONES = {
  light: { ring: '#2A6DB0', core: '#0C2340' },
  dark: { ring: '#6FA3DB', core: '#F8F4EA' },
}

export function LogoMark({ size = 32, tone = 'light', className = '', title = 'MedVerse AI' }) {
  const { ring, core } = TONES[tone] || TONES.light
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className={className}
      {...(title ? { role: 'img', 'aria-label': title } : { 'aria-hidden': true })}
    >
      {/* One dash plus one gap spans the circumference (2π·12 ≈ 75.4), which
          leaves a single opening at the upper right for the satellite. */}
      <circle
        cx="16"
        cy="16"
        r="12"
        fill="none"
        stroke={ring}
        strokeWidth="2.6"
        strokeDasharray="53 22.4"
        strokeLinecap="round"
      />
      <circle cx="23.6" cy="6.7" r="3.3" fill={ring} />
      <rect x="14.1" y="9.6" width="3.8" height="12.8" rx="1.9" fill={core} />
      <rect x="9.6" y="14.1" width="12.8" height="3.8" rx="1.9" fill={core} />
    </svg>
  )
}

/**
 * Mark plus wordmark. `tone="dark"` is for the navy sidebar and the sign-in
 * panel; the default is for the cream page.
 */
export function Logo({ size = 32, tone = 'light', className = '', textClass = 'text-xl' }) {
  const dark = tone === 'dark'
  return (
    <span className={`inline-flex shrink-0 items-center gap-2.5 ${className}`}>
      <LogoMark size={size} tone={tone} title={null} />
      <span
        className={`whitespace-nowrap font-display font-semibold tracking-tight ${textClass} ${dark ? 'text-paper' : 'text-ink'}`}
      >
        MedVerse<span className={dark ? 'text-pulse-light' : 'text-pulse'}> AI</span>
      </span>
    </span>
  )
}
