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

function FlowDiagram() {
  const [state, setState] = useState<AnimState>('idle')
  // Lazy-initialize to avoid setState-in-effect for the initial media query read
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

  // Auto-play on mount — use a ref flag so the first run fires once without a
  // synchronous setState call that would violate set-state-in-effect
  const didAutoPlay = useRef(false)
  useEffect(() => {
    if (didAutoPlay.current) return
    didAutoPlay.current = true
    // Defer by one tick so it runs after the initial render, not synchronously
    const id = setTimeout(replay, 0)
    return () => { clearTimeout(id); clearTimer() }
  }, [replay])

  const dotPos = dotPosition(state)
  const showReceipt = state === 'done-ok'
  const showBlock = state === 'done-blocked' || state === 'pay-blocked'

  return (
    <figure className="w-full max-w-sm" aria-label="Illustration of how Earmark works">
      {/* SVG diagram */}
      <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] p-5 shadow-card relative overflow-hidden">

        {/* Static layout */}
        <svg viewBox="0 0 300 220" width="100%" aria-hidden className="block">
          {/* ── Funder ── */}
          <rect x="10" y="90" width="70" height="36" rx="8" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5"/>
          <text x="45" y="103" textAnchor="middle" fill="var(--accent)" fontSize="9" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">FUNDER</text>
          <text x="45" y="116" textAnchor="middle" fill="var(--muted)" fontSize="7.5" fontFamily="IBM Plex Mono,monospace">0xF0…01</text>

          {/* ── Arrow funder→pot ── */}
          <line x1="80" y1="108" x2="110" y2="108" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 2"/>
          <polygon points="110,104 118,108 110,112" fill="var(--accent)" opacity="0.5"/>

          {/* ── Pot ── */}
          <rect x="118" y="80" width="72" height="56" rx="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"/>
          <text x="154" y="98" textAnchor="middle" fill="var(--accent)" fontSize="9" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">POT</text>
          {/* Lock tag */}
          <rect x="126" y="104" width="56" height="22" rx="5" fill="white" stroke="var(--line)" strokeWidth="1"/>
          <text x="154" y="113" textAnchor="middle" fill="var(--ink-2)" fontSize="6.5" fontFamily="IBM Plex Sans,sans-serif">School fees</text>
          <text x="154" y="121" textAnchor="middle" fill="var(--muted)" fontSize="5.5" fontFamily="IBM Plex Sans,sans-serif">Term 1 · 500 USDC</text>

          {/* ── Arrow pot→approved payees ── */}
          {/* to Greenfield */}
          <line x1="190" y1="100" x2="214" y2="80" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 2"/>
          <polygon points="211,76 219,79 215,87" fill="var(--success)" opacity="0.6"/>
          {/* to City Clinic */}
          <line x1="190" y1="116" x2="214" y2="140" stroke="var(--line)" strokeWidth="1.5" strokeDasharray="3 2"/>
          <polygon points="211,137 219,141 215,149" fill="var(--success)" opacity="0.6"/>

          {/* ── Approved payee 1: Greenfield ── */}
          <rect x="218" y="58" width="74" height="36" rx="8" fill="#E6FFF4" stroke="var(--success)" strokeWidth="1.5"/>
          <text x="255" y="71" textAnchor="middle" fill="var(--success)" fontSize="8" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">Greenfield</text>
          <text x="255" y="81" textAnchor="middle" fill="var(--success)" fontSize="8" fontFamily="IBM Plex Sans,sans-serif">School ✓</text>

          {/* ── Approved payee 2: City Clinic ── */}
          <rect x="218" y="118" width="74" height="36" rx="8" fill="#E6FFF4" stroke="var(--success)" strokeWidth="1.5"/>
          <text x="255" y="131" textAnchor="middle" fill="var(--success)" fontSize="8" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">City Clinic</text>
          <text x="255" y="141" textAnchor="middle" fill="var(--success)" fontSize="8" fontFamily="IBM Plex Sans,sans-serif">✓</text>

          {/* ── Blocked: any other wallet ── */}
          <line x1="154" y1="136" x2="154" y2="172" stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.4"/>
          <rect x="114" y="172" width="80" height="30" rx="8" fill="#FDECEC" stroke="var(--danger)" strokeWidth="1.5" opacity="0.6"/>
          <text x="154" y="186" textAnchor="middle" fill="var(--danger)" fontSize="8" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">Any other wallet</text>
          <text x="154" y="196" textAnchor="middle" fill="var(--danger)" fontSize="8" fontFamily="IBM Plex Sans,sans-serif">✕</text>

          {/* ── Animated USDC dot ── */}
          {dotPos && (
            <circle
              cx={dotPos.x}
              cy={dotPos.y}
              r="6"
              fill="var(--accent)"
              opacity="0.85"
              style={{ transition: reduced ? 'none' : 'cx 0.8s ease, cy 0.8s ease' }}
            >
              <title>USDC</title>
            </circle>
          )}

          {/* ── Barrier on blocked path ── */}
          {showBlock && (
            <g>
              <line x1="144" y1="162" x2="164" y2="162" stroke="var(--danger)" strokeWidth="3" strokeLinecap="round"/>
            </g>
          )}
        </svg>

        {/* Receipt chip */}
        {showReceipt && (
          <div
            className="absolute bottom-14 right-4 rounded-full bg-[var(--success)] px-2.5 py-1 text-[10px] font-semibold text-white shadow"
            style={{ animation: reduced ? 'none' : 'fadeInUp 0.3s ease' }}
            aria-live="polite"
          >
            ✓ Receipt recorded on Arc
          </div>
        )}

        {/* Blocked message */}
        {showBlock && (
          <div
            className="absolute bottom-14 inset-x-4 rounded-lg bg-[#FDECEC] border border-[var(--danger)] px-3 py-2 text-[10px] text-[var(--danger)] font-medium"
            style={{ animation: reduced ? 'none' : 'fadeInUp 0.3s ease' }}
            aria-live="polite"
          >
            Blocked by the contract: PayeeNotApproved — only approved payees can be paid.
          </div>
        )}

        {/* Caption */}
        <p className="mt-2 text-center text-[10px] text-[var(--muted)]" aria-hidden>
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
    case 'fund':         return { x: 45, y: 108 }
    case 'pay-ok':       return { x: 154, y: 108 }
    case 'done-ok':      return { x: 255, y: 76 }
    case 'pay-blocked':  return { x: 154, y: 136 }
    case 'done-blocked': return { x: 154, y: 162 }
    default:             return null
  }
}
