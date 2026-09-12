import { useEffect, useRef, useState } from 'react'

/**
 * Animated UI primitives — scroll reveals, count-ups, tilt/spotlight cards,
 * marquees and border beams.
 *
 * Built on IntersectionObserver + CSS rather than an animation library: the
 * production bundle already trips Vite's size warning, and everything here is
 * a transform or an opacity, which the compositor handles natively.
 *
 * Every effect degrades to a static or gently faded state under
 * prefers-reduced-motion, and animated numbers expose their final value to
 * screen readers immediately.
 */

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!mq) return
    const onChange = (e) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/**
 * Fires once when the element first scrolls into view.
 *
 * Fails open: if the observer hasn't reported back within FAILSAFE_MS we reveal
 * anyway. IntersectionObserver callbacks don't fire while a page isn't being
 * painted (a backgrounded or throttled tab, some embedded webviews), and
 * without this the content would stay at opacity 0 forever — and a Counter
 * would sit showing 0, which is worse than unstyled: it's wrong data.
 */
const FAILSAFE_MS = 1200

function useInView(options) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return
    }

    let done = false
    const reveal = () => {
      if (done) return
      done = true
      setInView(true)
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          reveal()
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px', ...options }
    )
    io.observe(el)

    const failsafe = setTimeout(reveal, FAILSAFE_MS)
    return () => {
      clearTimeout(failsafe)
      io.disconnect()
    }
  }, [])

  return [ref, inView]
}

/** Fades and slides its children in the first time they enter the viewport. */
export function Reveal({ children, className = '', delay = 0, y = 22, x = 0, as: Tag = 'div' }) {
  const [ref, inView] = useInView()
  const reduced = usePrefersReducedMotion()

  const style = reduced
    ? { opacity: inView ? 1 : 0, transition: `opacity 600ms ${EASE} ${delay}ms` }
    : {
        opacity: inView ? 1 : 0,
        transform: inView ? 'translate3d(0,0,0)' : `translate3d(${x}px, ${y}px, 0)`,
        transition: `opacity 750ms ${EASE} ${delay}ms, transform 750ms ${EASE} ${delay}ms`,
      }

  return <Tag ref={ref} className={className} style={style}>{children}</Tag>
}

/** Staggers Reveal delays across a list of children. */
export function RevealGroup({ children, step = 90, className = '', ...rest }) {
  return (
    <div className={className}>
      {Array.isArray(children)
        ? children.map((child, i) => (
            <Reveal key={i} delay={i * step} {...rest}>{child}</Reveal>
          ))
        : children}
    </div>
  )
}

/**
 * Counts up to `value` when scrolled into view. The animated text is
 * aria-hidden and the true value is exposed to assistive tech right away.
 */
export function Counter({ value, prefix = '', suffix = '', duration = 1600, decimals = 0, className = '' }) {
  const [ref, inView] = useInView()
  const reduced = usePrefersReducedMotion()
  const [display, setDisplay] = useState(0)

  useEffect(() => {
    if (!inView) return
    if (reduced) {
      setDisplay(value)
      return
    }

    let frame
    let settled = false
    const start = performance.now()
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1)
      // easeOutExpo — fast start, settles gently on the final number
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setDisplay(value * eased)
      if (t < 1) frame = requestAnimationFrame(tick)
      else settled = true
    }
    frame = requestAnimationFrame(tick)

    // requestAnimationFrame is suspended entirely while a page isn't painting
    // (backgrounded tab, minimised window, some webviews), which would strand
    // the counter at 0 — i.e. showing a wrong number, not just an unanimated
    // one. setTimeout still fires there, so it backstops the final value.
    const settle = setTimeout(() => {
      if (!settled) setDisplay(value)
    }, duration + 400)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settle)
    }
  }, [inView, reduced, value, duration])

  const shown = decimals ? display.toFixed(decimals) : Math.round(display).toLocaleString()

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true" className="tabular-nums">{prefix}{shown}{suffix}</span>
      <span className="sr-only">{prefix}{value}{suffix}</span>
    </span>
  )
}

/**
 * 3D tilt plus a pointer-following glow. Mouse only — touch and
 * reduced-motion users get a plain card with no transform.
 */
export function TiltCard({ children, className = '', max = 6, glow = true }) {
  const ref = useRef(null)
  const reduced = usePrefersReducedMotion()
  const [style, setStyle] = useState({})
  const [glowPos, setGlowPos] = useState({ x: '50%', y: '50%', on: false })

  function handleMove(e) {
    if (reduced || e.pointerType !== 'mouse' || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    setStyle({
      transform: `perspective(1000px) rotateX(${(0.5 - py) * max * 2}deg) rotateY(${(px - 0.5) * max * 2}deg) translateY(-4px)`,
      transition: 'transform 120ms ease-out',
    })
    setGlowPos({ x: `${px * 100}%`, y: `${py * 100}%`, on: true })
  }

  function handleLeave() {
    setStyle({ transform: 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)', transition: `transform 420ms ${EASE}` })
    setGlowPos((g) => ({ ...g, on: false }))
  }

  return (
    <div
      ref={ref}
      onPointerMove={handleMove}
      onPointerLeave={handleLeave}
      style={style}
      className={`relative ${className}`}
    >
      {children}
      {glow && !reduced && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-lg transition-opacity duration-300"
          style={{
            opacity: glowPos.on ? 1 : 0,
            background: `radial-gradient(320px circle at ${glowPos.x} ${glowPos.y}, rgb(163 46 53 / 0.16), transparent 65%)`,
          }}
        />
      )}
    </div>
  )
}

/**
 * Infinite horizontal marquee. The list is rendered twice and the track
 * shifts by exactly half its width, so the loop is seamless; the duplicate is
 * aria-hidden. Pauses on hover, and reduced motion turns it into a static
 * wrapped list.
 */
export function Marquee({ items, label, reverse = false, className = '', renderItem }) {
  const reduced = usePrefersReducedMotion()

  const content = (item, i, clone = false) => (
    <li key={`${clone ? 'clone-' : ''}${item}-${i}`} aria-hidden={clone ? 'true' : undefined}>
      {renderItem ? renderItem(item) : (
        <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-ink shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-pulse" />
          {item}
        </span>
      )}
    </li>
  )

  if (reduced) {
    return (
      <ul aria-label={label} className={`flex flex-wrap justify-center gap-3 ${className}`}>
        {items.map((item, i) => content(item, i))}
      </ul>
    )
  }

  return (
    <div className={`group relative flex overflow-hidden ${className}`} style={{
      maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
    }}>
      <ul
        aria-label={label}
        className={`flex w-max shrink-0 animate-marquee gap-3 pr-3 group-hover:[animation-play-state:paused] ${reverse ? '[animation-direction:reverse]' : ''}`}
      >
        {items.map((item, i) => content(item, i))}
        {items.map((item, i) => content(item, i, true))}
      </ul>
    </div>
  )
}

/** A light sweep that travels around the element's border. */
export function BorderBeam({ className = '', duration = 6 }) {
  const reduced = usePrefersReducedMotion()
  if (reduced) return null
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] ${className}`}
    >
      <span
        className="absolute aspect-square w-[36%] animate-beam"
        style={{
          offsetPath: 'rect(0 auto auto 0 round 12px)',
          background: 'radial-gradient(circle, rgb(163 46 53 / 0.55), transparent 60%)',
          animationDuration: `${duration}s`,
        }}
      />
    </span>
  )
}

/** Soft blurred colour wash used behind hero art and CTAs. */
export function GlowBackdrop({ className = '', tone = 'pulse' }) {
  // Kept low: these are large and blurred, so anything heavier stops reading
  // as a warm tint and washes the whole section pink.
  const tones = {
    pulse: 'bg-pulse/12',
    amber: 'bg-amber/12',
    alert: 'bg-alert/10',
  }
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute -z-10 rounded-full blur-3xl ${tones[tone] || tones.pulse} ${className}`}
    />
  )
}
