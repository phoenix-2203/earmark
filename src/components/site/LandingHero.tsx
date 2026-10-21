/**
 * Landing Hero — section 1.
 * Two columns on desktop (text left, interactive diagram right), stacked on mobile.
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { ArrowRight, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface Props {
  onSend: () => void
}

export default function LandingHero({ onSend }: Props) {
  function scrollHow() {
    document.getElementById('how')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="bg-white py-16 md:py-20 lg:py-24">
      <div className="mx-auto max-w-[1040px] px-4 grid gap-12 lg:grid-cols-2 lg:items-center">

        {/* Left: copy */}
        <div className="max-w-lg">
          <h1
            className="display mb-4 text-4xl font-semibold text-[var(--ink)] text-balance leading-tight"
            style={{ letterSpacing: '-0.025em', fontSize: 'clamp(2rem,5vw,3rem)' }}
          >
            Money with a purpose.
          </h1>
          <p className="text-lg text-[var(--ink-2)] leading-relaxed text-pretty mb-8">
            Fund a pot in USDC for one expense. The recipient can only pay
            the payees you approve — and every payment leaves a public
            receipt on Arc.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
            <Button size="lg" onClick={onSend} className="sm:w-auto">
              Create a pot
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <button
              onClick={scrollHow}
              className="text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded px-1"
            >
              See how it works
            </button>
          </div>

          {/* Trust line */}
          <p className="text-xs text-[var(--muted)] flex flex-wrap gap-x-3 gap-y-1">
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--success)] inline-block" aria-hidden />Live on Arc</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--accent)] inline-block" aria-hidden />Open source</span>
            <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--muted)] inline-block" aria-hidden />No admin key</span>
          </p>
        </div>

        {/* Right: interactive diagram */}
        <div className="flex justify-center lg:justify-end">
          <FlowDiagram />
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────── Interactive flow diagram ────────────────────── */

type AnimState = 'idle' | 'fund' | 'pay-ok' | 'pay-blocked' | 'done-ok' | 'done-blocked'

/*
 * Coordinate system — viewBox "0 0 360 340"
 *
 *  Funder        (20, 130)  w=80  h=44
 *  Pot           (150, 118) w=80  h=64
 *  Greenfield    (280, 72)  w=80  h=44   ← approved payee 1
 *  City Clinic   (280, 164) w=80  h=44   ← approved payee 2
 *  Any other     (150, 252) w=80  h=38   ← blocked
 *  Receipt chip  below Greenfield node (inside SVG, y≈128)
 */

// Node centres
const C = {
  funder:     { x: 60,  y: 152 },
  pot:        { x: 190, y: 150 },
  greenfield: { x: 320, y: 94  },
  clinic:     { x: 320, y: 186 },
  blocked:    { x: 190, y: 271 },
} as const

function FlowDiagram() {
  const [state, setState] = useState<AnimState>('idle')
  const [reduced, setReduced] = useState<boolean>(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  function clearTimer() { if (timerRef.current) clearTimeout(timerRef.current) }

  const replay = useCallback(() => {
    clearTimer()
    if (reduced) { setState('done-ok'); return }
    setState('fund')
    timerRef.current = setTimeout(() => {
      setState('pay-ok')
      timerRef.current = setTimeout(() => setState('done-ok'), 1200)
    }, 1000)
  }, [reduced])

  const tryBlocked = useCallback(() => {
    clearTimer()
    if (reduced) { setState('done-blocked'); return }
    setState('fund')
    timerRef.current = setTimeout(() => {
      setState('pay-blocked')
      timerRef.current = setTimeout(() => setState('done-blocked'), 1200)
    }, 1000)
  }, [reduced])

  const didAutoPlay = useRef(false)
  useEffect(() => {
    if (didAutoPlay.current) return
    didAutoPlay.current = true
    const id = setTimeout(replay, 0)
    return () => { clearTimeout(id); clearTimer() }
  }, [replay])

  const dot = dotPosition(state)
  // Hide dot once animation is fully settled so it doesn't sit on a label
  const showDot = dot !== null && state !== 'done-ok' && state !== 'done-blocked'
  const showReceipt = state === 'done-ok'
  const showBlock   = state === 'done-blocked' || state === 'pay-blocked'

  return (
    <figure className="w-full max-w-[480px]" aria-label="Illustration of how Earmark works">
      <div
        className="rounded-card border border-[var(--line)] bg-[var(--surface)] shadow-card overflow-hidden"
        style={{ minHeight: 360 }}
      >
        {/* SVG — viewBox sized to fill the card comfortably */}
        <svg
          viewBox="0 0 360 340"
          width="100%"
          aria-hidden
          className="block"
          style={{ minHeight: 300 }}
        >
          {/* ── Funder ── */}
          <rect x="20" y="130" width="80" height="44" rx="10"
            fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5"/>
          <text x="60" y="148" textAnchor="middle" fill="var(--accent)" fontSize="11" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">FUNDER</text>
          <text x="60" y="163" textAnchor="middle" fill="var(--muted)" fontSize="10" fontFamily="IBM Plex Mono,monospace">0xF0…01</text>

          {/* ── Arrow funder→pot ── */}
          <line x1="100" y1="152" x2="140" y2="152" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon points="140,147 150,152 140,157" fill="var(--accent)" opacity="0.6"/>

          {/* ── Pot ── */}
          <rect x="150" y="118" width="80" height="64" rx="12"
            fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"/>
          <text x="190" y="140" textAnchor="middle" fill="var(--accent)" fontSize="13" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">POT</text>
          {/* Lock tag */}
          <rect x="158" y="146" width="64" height="26" rx="6" fill="white" stroke="var(--line)" strokeWidth="1"/>
          <text x="190" y="158" textAnchor="middle" fill="var(--ink-2)" fontSize="10" fontFamily="IBM Plex Sans,sans-serif">School fees</text>
          <text x="190" y="168" textAnchor="middle" fill="var(--muted)" fontSize="9" fontFamily="IBM Plex Sans,sans-serif">Term 1 · 500 USDC</text>

          {/* ── Arrow pot→Greenfield ── */}
          <line x1="230" y1="138" x2="272" y2="100" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon points="269,95 278,98 274,107" fill="var(--success)" opacity="0.7"/>

          {/* ── Arrow pot→City Clinic ── */}
          <line x1="230" y1="166" x2="272" y2="180" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon points="269,176 278,181 274,190" fill="var(--success)" opacity="0.7"/>

          {/* ── Greenfield School ── */}
          <rect x="280" y="72" width="76" height="44" rx="10"
            fill="#E6FFF4" stroke="var(--success)" strokeWidth="1.5"/>
          <text x="318" y="89" textAnchor="middle" fill="var(--success)" fontSize="11" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">Greenfield</text>
          <text x="318" y="104" textAnchor="middle" fill="var(--success)" fontSize="11" fontFamily="IBM Plex Sans,sans-serif">School ✓</text>

          {/* ── Receipt chip — appears below Greenfield when done-ok ── */}
          {showReceipt && (
            <g style={{ animation: reduced ? 'none' : 'fadeInUp 0.3s ease' }}>
              <rect x="272" y="122" width="92" height="22" rx="11"
                fill="var(--success)" opacity="0.95"/>
              <text x="318" y="136" textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">✓ Receipt on Arc</text>
            </g>
          )}

          {/* ── City Clinic ── */}
          <rect x="280" y="164" width="76" height="44" rx="10"
            fill="#E6FFF4" stroke="var(--success)" strokeWidth="1.5"/>
          <text x="318" y="181" textAnchor="middle" fill="var(--success)" fontSize="11" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">City Clinic</text>
          <text x="318" y="196" textAnchor="middle" fill="var(--success)" fontSize="11" fontFamily="IBM Plex Sans,sans-serif">✓</text>

          {/* ── Arrow pot→blocked (dashed red) ── */}
          <line x1="190" y1="182" x2="190" y2="242" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4"/>
          <polygon points="184,242 190,252 196,242" fill="var(--danger)" opacity="0.4"/>

          {/* ── Blocked: any other wallet ── */}
          <rect x="130" y="252" width="120" height="40" rx="10"
            fill="#FDECEC" stroke="var(--danger)" strokeWidth="1.5" opacity="0.7"/>
          <text x="190" y="268" textAnchor="middle" fill="var(--danger)" fontSize="12" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">Any other wallet</text>
          <text x="190" y="283" textAnchor="middle" fill="var(--danger)" fontSize="12" fontFamily="IBM Plex Sans,sans-serif">✕</text>

          {/* ── Barrier on blocked path ── */}
          {showBlock && (
            <line x1="176" y1="230" x2="204" y2="230" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round"/>
          )}

          {/* ── Animated USDC dot ── */}
          {showDot && dot && (
            <circle
              cx={dot.x}
              cy={dot.y}
              r="8"
              fill="var(--accent)"
              opacity="0.85"
              style={{ transition: reduced ? 'none' : 'cx 0.8s ease, cy 0.8s ease' }}
            >
              <title>USDC</title>
            </circle>
          )}
        </svg>

        {/* Blocked message — below SVG so it doesn't crowd the diagram */}
        {showBlock && (
          <div
            className="mx-4 mb-3 rounded-lg bg-[#FDECEC] border border-[var(--danger)] px-3 py-2 text-xs text-[var(--danger)] font-medium leading-snug"
            style={{ animation: reduced ? 'none' : 'fadeInUp 0.3s ease' }}
            aria-live="polite"
          >
            Blocked: PayeeNotApproved — only approved payees can be paid.
          </div>
        )}

        {/* Caption */}
        <p className="pb-3 text-center text-[11px] text-[var(--muted)]" aria-hidden>
          Illustration
        </p>
      </div>

      {/* Controls */}
      <div className="mt-3 flex gap-2 justify-center flex-wrap">
        <button
          onClick={replay}
          className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
        >
          <RotateCcw className="size-3" aria-hidden />
          Replay
        </button>
        <button
          onClick={tryBlocked}
          className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
        >
          Try paying someone else
        </button>
      </div>
    </figure>
  )
}

function dotPosition(state: AnimState): { x: number; y: number } | null {
  switch (state) {
    case 'idle':         return null
    case 'fund':         return { x: C.funder.x,     y: C.funder.y     }
    case 'pay-ok':       return { x: C.pot.x,         y: C.pot.y        }
    case 'done-ok':      return { x: C.greenfield.x,  y: C.greenfield.y }
    case 'pay-blocked':  return { x: C.pot.x,         y: C.blocked.y - 40 }
    case 'done-blocked': return { x: C.blocked.x,     y: C.blocked.y    }
    default:             return null
  }
}
