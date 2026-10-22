/**
 * Landing Hero — section 1.
 * Two columns on desktop (text left, interactive diagram right), stacked on mobile.
 *
 * COORDINATE SYSTEM — viewBox "0 0 400 320"
 *
 *  Padding:      16px on every edge
 *
 *  Column 1 (Funder):       x=16..100   centre x=58
 *  Column 2 (Pot):          x=118..218  centre x=168  (width=100 to fit tag text)
 *  Column 3 (payees):       x=238..384  centre x=311  (width=82)
 *
 *  Row A (Funder / Greenfield):  centre y=110
 *  Row B (Pot centre):           centre y=148
 *  Row C (City Clinic):          centre y=196
 *  Row D (blocked):              centre y=272
 *
 *  Receipt chip: x=238..370, y=153..175  (below Greenfield, above City Clinic)
 *  Right edge of rightmost element: 384 → 16px from viewBox edge ✓
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
            className="display mb-4 font-semibold text-[var(--ink)] text-balance leading-tight"
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
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--success)] inline-block" aria-hidden />
              Live on Arc
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--accent)] inline-block" aria-hidden />
              Open source
            </span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-[var(--muted)] inline-block" aria-hidden />
              No admin key
            </span>
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

// ── Layout constants ──────────────────────────────────────────────────────────
// viewBox: 400 × 320  (all nodes fit within x ∈ [16,384], y ∈ [16,304])

// Funder node   top-left (16, 88),  w=84, h=44  → centre (58, 110)
const FX = 16,  FY = 88,  FW = 84, FH = 44
// Pot node      top-left (118,116), w=100, h=64 → centre (168, 148)
const PX = 118, PY = 116, PW = 100, PH = 64
// Payee nodes   top-left (238, …), w=82, h=44
const NX = 238, NW = 82, NH = 44
// Greenfield    top-left (238, 88)  → centre (279, 110)
const GY = 88
// City Clinic   top-left (238,174)  → centre (279, 196)
const KY = 174
// Blocked node  top-left (119,246)  w=100, h=42 → centre (169, 267)
const BX = 119, BY = 246, BW = 100, BH = 42
// Receipt chip  below Greenfield, above City Clinic: x=238, y=142, w=146, h=24
const RX = 238, RY = 142, RW = 146, RH = 24

// Node centres (for dot animation)
const C = {
  funder:     { x: FX + FW / 2,          y: FY + FH / 2 },          // 58, 110
  pot:        { x: PX + PW / 2,          y: PY + PH / 2 },          // 168, 148
  greenfield: { x: NX + NW / 2,          y: GY + NH / 2 },          // 279, 110
  clinic:     { x: NX + NW / 2,          y: KY + NH / 2 },          // 279, 196
  blocked:    { x: BX + BW / 2,          y: BY + BH / 2 },          // 169, 267
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
  // Hide dot once settled so it doesn't sit on a label
  const showDot    = dot !== null && state !== 'done-ok' && state !== 'done-blocked'
  const showReceipt = state === 'done-ok'
  const showBlock   = state === 'done-blocked' || state === 'pay-blocked'

  // Shorthand centres
  const fc = C.funder, pc = C.pot, gc = C.greenfield, kc = C.clinic, bc = C.blocked

  return (
    <figure className="w-full max-w-[480px]" aria-label="Illustration of how Earmark works">
      <div
        className="rounded-card border border-[var(--line)] bg-[var(--surface)] shadow-card overflow-hidden"
        style={{ minHeight: 360 }}
      >
        {/* SVG fills the card; viewBox 400×320 gives ≥16px padding on every side */}
        <svg
          viewBox="0 0 400 320"
          width="100%"
          aria-hidden
          className="block"
          style={{ minHeight: 300 }}
        >
          {/* ── Funder ─────────────────────────────────────────────────────── */}
          <rect x={FX} y={FY} width={FW} height={FH} rx="10"
            fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.5"/>
          <text x={fc.x} y={FY+18} textAnchor="middle"
            fill="var(--accent)" fontSize="11" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">
            FUNDER
          </text>
          <text x={fc.x} y={FY+33} textAnchor="middle"
            fill="var(--muted)" fontSize="9.5" fontFamily="IBM Plex Mono,monospace">
            0xF0…01
          </text>

          {/* ── Arrow funder → pot ─────────────────────────────────────────── */}
          <line x1={FX+FW} y1={fc.y} x2={PX-8} y2={pc.y}
            stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon
            points={`${PX-8},${pc.y-5} ${PX},${pc.y} ${PX-8},${pc.y+5}`}
            fill="var(--accent)" opacity="0.6"/>

          {/* ── Pot ────────────────────────────────────────────────────────── */}
          <rect x={PX} y={PY} width={PW} height={PH} rx="12"
            fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="2"/>
          <text x={pc.x} y={PY+20} textAnchor="middle"
            fill="var(--accent)" fontSize="13" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">
            POT
          </text>
          {/* Lock tag — inset 7px each side, 30px tall */}
          <rect x={PX+7} y={PY+26} width={PW-14} height={30} rx="6"
            fill="white" stroke="var(--line)" strokeWidth="1"/>
          <text x={pc.x} y={PY+40} textAnchor="middle"
            fill="var(--ink-2)" fontSize="9.5" fontFamily="IBM Plex Sans,sans-serif">
            School fees
          </text>
          <text x={pc.x} y={PY+52} textAnchor="middle"
            fill="var(--muted)" fontSize="8.5" fontFamily="IBM Plex Sans,sans-serif">
            Term 1 · 500 USDC
          </text>

          {/* ── Arrow pot → Greenfield ─────────────────────────────────────── */}
          <line
            x1={PX+PW} y1={pc.y-10}
            x2={NX-6}  y2={gc.y}
            stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon
            points={`${NX-6},${gc.y-5} ${NX},${gc.y} ${NX-6},${gc.y+5}`}
            fill="var(--success)" opacity="0.7"/>

          {/* ── Arrow pot → City Clinic ────────────────────────────────────── */}
          <line
            x1={PX+PW} y1={pc.y+10}
            x2={NX-6}  y2={kc.y}
            stroke="var(--line)" strokeWidth="1.5" strokeDasharray="4 3"/>
          <polygon
            points={`${NX-6},${kc.y-5} ${NX},${kc.y} ${NX-6},${kc.y+5}`}
            fill="var(--success)" opacity="0.7"/>

          {/* ── Greenfield School ──────────────────────────────────────────── */}
          <rect x={NX} y={GY} width={NW} height={NH} rx="10"
            fill="#E6FFF4" stroke="var(--success)" strokeWidth="1.5"/>
          <text x={gc.x} y={GY+17} textAnchor="middle"
            fill="var(--success)" fontSize="11" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">
            Greenfield
          </text>
          <text x={gc.x} y={GY+31} textAnchor="middle"
            fill="var(--success)" fontSize="11" fontFamily="IBM Plex Sans,sans-serif">
            School ✓
          </text>

          {/* ── Receipt chip — sits below Greenfield, above City Clinic ─────── */}
          {showReceipt && (
            <g style={{ animation: reduced ? 'none' : 'fadeInUp 0.3s ease' }}>
              <rect x={RX} y={RY} width={RW} height={RH} rx="12"
                fill="var(--success)" opacity="0.95"/>
              <text x={RX + RW/2} y={RY+16} textAnchor="middle"
                fill="white" fontSize="10" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">
                ✓ Receipt recorded on Arc
              </text>
            </g>
          )}

          {/* ── City Clinic ────────────────────────────────────────────────── */}
          <rect x={NX} y={KY} width={NW} height={NH} rx="10"
            fill="#E6FFF4" stroke="var(--success)" strokeWidth="1.5"/>
          <text x={kc.x} y={KY+17} textAnchor="middle"
            fill="var(--success)" fontSize="11" fontWeight="700" fontFamily="IBM Plex Sans,sans-serif">
            City Clinic
          </text>
          <text x={kc.x} y={KY+31} textAnchor="middle"
            fill="var(--success)" fontSize="11" fontFamily="IBM Plex Sans,sans-serif">
            ✓
          </text>

          {/* ── Arrow pot → blocked (dashed red) ──────────────────────────── */}
          <line x1={pc.x} y1={PY+PH} x2={bc.x} y2={BY-6}
            stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4"/>
          <polygon
            points={`${bc.x-6},${BY-6} ${bc.x},${BY} ${bc.x+6},${BY-6}`}
            fill="var(--danger)" opacity="0.4"/>

          {/* ── Blocked: any other wallet ──────────────────────────────────── */}
          <rect x={BX} y={BY} width={BW} height={BH} rx="10"
            fill="#FDECEC" stroke="var(--danger)" strokeWidth="1.5" opacity="0.7"/>
          <text x={bc.x} y={BY+17} textAnchor="middle"
            fill="var(--danger)" fontSize="11" fontWeight="600" fontFamily="IBM Plex Sans,sans-serif">
            Any other wallet
          </text>
          <text x={bc.x} y={BY+31} textAnchor="middle"
            fill="var(--danger)" fontSize="11" fontFamily="IBM Plex Sans,sans-serif">
            ✕
          </text>

          {/* ── Barrier on blocked path ───────────────────────────────────── */}
          {showBlock && (
            <line
              x1={bc.x-14} y1={BY-20}
              x2={bc.x+14} y2={BY-20}
              stroke="var(--danger)" strokeWidth="4" strokeLinecap="round"/>
          )}

          {/* ── Animated USDC dot ─────────────────────────────────────────── */}
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

        {/* Blocked message — below SVG */}
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
