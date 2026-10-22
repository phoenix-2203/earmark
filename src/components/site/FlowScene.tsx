/**
 * FlowScene — animated inline SVG that illustrates the Earmark flow:
 * Funder locks USDC → Pot → approved payees (with receipts).
 * A third payment to the blocked card is rejected at a red barrier.
 * After the end date, the remaining balance flows back to the funder.
 *
 * Driven entirely by CSS keyframe animation via a phase index (0-4).
 * Respects prefers-reduced-motion: shows a static final frame.
 * Pauses when off-screen (IntersectionObserver) and tab hidden.
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Play, Pause, RotateCcw } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SceneParty {
  label: string
  Icon: LucideIcon
}

export interface FlowSceneProps {
  funder:    SceneParty
  recipient: SceneParty
  payees:    [SceneParty, SceneParty]   // exactly 2 approved payees
  blocked:   string                    // label for the blocked target
  potTitle:  string
  amount:    string                    // e.g. "500 USDC"
  className?: string
}

// ─── Phase durations (ms) ────────────────────────────────────────────────────
const PHASES = [
  { id: 0, label: '1 · Fund the pot',              ms: 2200 },
  { id: 1, label: '2 · Pay approved payees',       ms: 2600 },
  { id: 2, label: '2 · Pay approved payees',       ms: 2600 },
  { id: 3, label: '3 · Blocked if not approved',   ms: 2200 },
  { id: 4, label: '4 · Leftovers come back',        ms: 2200 },
]
const _TOTAL_MS = PHASES.reduce((s, p) => s + p.ms, 0) + 800  // +pause at end; kept for reference

// ─── Layout constants ────────────────────────────────────────────────────────
const VW = 720
const VH = 320

// Node positions (cx, cy) and sizes
const FUNDER_X  = 80,   FUNDER_Y   = 160
const POT_X     = 310,  POT_Y      = 160
const PAY1_X    = 560,  PAY1_Y     = 90
const PAY2_X    = 560,  PAY2_Y     = 220
const BLOCK_X   = 560,  BLOCK_Y    = 160   // blocked target (same column, centre)
const RECIP_X   = 310,  RECIP_Y    = 270   // below pot

const NODE_W = 120, NODE_H = 52, NODE_R = 10

// Path definitions (Funder→Pot, Pot→Pay1, Pot→Pay2, Pot→Block, Pot→Funder)
function cx(x: number) { return x + NODE_W / 2 }
function cy(y: number) { return y + NODE_H / 2 }

const PATH_FP  = `M ${cx(FUNDER_X)} ${cy(FUNDER_Y)} C ${(cx(FUNDER_X)+cx(POT_X))/2} ${cy(FUNDER_Y)}, ${(cx(FUNDER_X)+cx(POT_X))/2} ${cy(POT_Y)}, ${cx(POT_X)} ${cy(POT_Y)}`
const PATH_P1  = `M ${cx(POT_X)} ${cy(POT_Y)} C ${(cx(POT_X)+cx(PAY1_X))/2} ${cy(POT_Y)}, ${(cx(POT_X)+cx(PAY1_X))/2} ${cy(PAY1_Y)}, ${cx(PAY1_X)} ${cy(PAY1_Y)}`
const PATH_P2  = `M ${cx(POT_X)} ${cy(POT_Y)} C ${(cx(POT_X)+cx(PAY2_X))/2} ${cy(POT_Y)}, ${(cx(POT_X)+cx(PAY2_X))/2} ${cy(PAY2_Y)}, ${cx(PAY2_X)} ${cy(PAY2_Y)}`
const PATH_BLK = `M ${cx(POT_X)} ${cy(POT_Y)} C ${(cx(POT_X)+cx(BLOCK_X))/2} ${cy(POT_Y)}, ${(cx(POT_X)+cx(BLOCK_X))/2} ${cy(BLOCK_Y)}, ${cx(BLOCK_X)-2} ${cy(BLOCK_Y)}`
const PATH_BACK= `M ${cx(POT_X)} ${cy(POT_Y)} C ${(cx(POT_X)+cx(FUNDER_X))/2} ${cy(POT_Y)-40}, ${(cx(POT_X)+cx(FUNDER_X))/2} ${cy(FUNDER_Y)-40}, ${cx(FUNDER_X)+NODE_W/2} ${cy(FUNDER_Y)-14}`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Node({
  x, y, label, Icon, active = false, success = false, blocked = false,
}: {
  x: number; y: number; label: string; Icon: LucideIcon
  active?: boolean; success?: boolean; blocked?: boolean
}) {
  const stroke = blocked ? 'var(--danger, #B42318)' : success ? '#0F6B5C' : active ? '#0F6B5C' : '#DCE1E6'
  const bg = blocked ? '#FDECEC' : success ? '#E3F1EE' : active ? '#E3F1EE' : 'white'
  const ink = blocked ? '#B42318' : '#0F2233'
  return (
    <g>
      <rect
        x={x} y={y} width={NODE_W} height={NODE_H} rx={NODE_R}
        fill={bg} stroke={stroke} strokeWidth={blocked || success ? 2 : 1.5}
        style={{ filter: active || success ? 'drop-shadow(0 2px 6px rgba(15,107,92,.18))' : 'none',
                 transition: 'all 0.3s cubic-bezier(.4,0,.2,1)' }}
      />
      <Icon
        x={x + 10} y={y + NODE_H/2 - 8}
        width={16} height={16}
        color={blocked ? '#B42318' : active || success ? '#0F6B5C' : '#5B6775'}
        style={{ transition: 'color 0.3s' }}
      />
      <text
        x={x + 32} y={y + NODE_H/2 + 5}
        fontSize={12} fontFamily="'IBM Plex Sans',sans-serif"
        fill={ink} fontWeight={active || success ? '600' : '400'}
        style={{ transition: 'all 0.3s' }}
      >
        {label.length > 16 ? label.slice(0, 15) + '…' : label}
      </text>
    </g>
  )
}

function Coin({ phase, show }: { path?: string; phase: number; show: boolean }) {
  if (!show) return null
  // Animate a circle along the path using animateMotion
  return (
    <circle r={10} fill="#0F6B5C" opacity={0.95} style={{ filter: 'drop-shadow(0 1px 4px rgba(15,107,92,.4))' }}>
      <animateMotion
        key={phase}
        dur="0.9s"
        begin="0s"
        fill="freeze"
        repeatCount="1"
        calcMode="spline"
        keySplines="0.4 0 0.2 1"
        keyTimes="0;1"
      >
        <mpath xlinkHref={`#path-${phase}`} />
      </animateMotion>
      <text textAnchor="middle" dominantBaseline="central" fontSize={9} fill="white" fontFamily="sans-serif" fontWeight="700">$</text>
    </circle>
  )
}

function Receipt({ x, y, show }: { x: number; y: number; show: boolean }) {
  if (!show) return null
  return (
    <g style={{ animation: show ? 'slideUp 0.4s cubic-bezier(.4,0,.2,1) both' : 'none' }}>
      <rect x={x} y={y} width={88} height={28} rx={6} fill="#0F6B5C" />
      <text x={x + 8} y={y + 18} fontSize={10} fill="white" fontFamily="'IBM Plex Sans',sans-serif" fontWeight="600">
        Receipt ✓
      </text>
    </g>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FlowScene({
  funder, recipient, payees, blocked, potTitle, amount, className = '',
}: FlowSceneProps) {
  // Detect reduced motion preference
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const [phase, setPhase]     = useState(prefersReduced ? 4 : 0)
  const [playing, setPlaying] = useState(!prefersReduced)
  const [key, setKey]         = useState(0)   // restart key

  const svgRef      = useRef<SVGSVGElement>(null)
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const phaseRef    = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  // Advance phase
  const advance = useCallback(() => {
    setPhase(p => {
      const next = (p + 1) % PHASES.length
      return next
    })
  }, [])

  // Schedule next phase
  const schedule = useCallback((currentPhase: number, isPlaying: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (!isPlaying) return
    const dur = PHASES[currentPhase]?.ms ?? 2000
    timerRef.current = setTimeout(() => {
      advance()
    }, dur)
  }, [advance])

  useEffect(() => {
    schedule(phase, playing)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase, playing, schedule])

  // Pause when off-screen
  useEffect(() => {
    if (!svgRef.current) return
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) setPlaying(false)
    }, { threshold: 0.2 })
    obs.observe(svgRef.current)
    return () => obs.disconnect()
  }, [])

  // Pause when tab hidden
  useEffect(() => {
    function handle() { if (document.hidden) setPlaying(false) }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])

  function handleReplay() {
    setPhase(0)
    setKey(k => k + 1)
    setPlaying(true)
  }

  function handlePlayPause() {
    setPlaying(p => !p)
  }

  // Jump to step
  function handleCaption(idx: number) {
    setPhase(idx)
    setKey(k => k + 1)
    setPlaying(true)
  }

  // Derived visibility flags
  const fundCoinVisible  = phase === 0
  const pay1CoinVisible  = phase === 1
  const pay2CoinVisible  = phase === 2
  const blkCoinVisible   = phase === 3
  const backCoinVisible  = phase === 4
  const pay1Done         = phase >= 2
  const pay2Done         = phase >= 3
  const funderActive     = phase === 0 || phase === 4
  const potActive        = phase >= 0
  const recipActive      = phase === 1 || phase === 2 || phase === 3

  // Caption labels (deduplicated for display)
  const captionLabels = [
    '1 · Fund the pot',
    '2 · Pay approved payees',
    '3 · Blocked',
    '4 · Leftovers back',
  ]
  const captionPhaseMap = [0, 1, 3, 4]

  if (prefersReduced) {
    // Static frame: show final state with all captions
    return (
      <div className={`rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 ${className}`} role="img"
        aria-label={`Earmark flow: the funder locks ${amount} into a pot called "${potTitle}"; the recipient can pay ${payees[0].label} and ${payees[1].label}; payments to ${blocked} are blocked; unspent money returns to the funder.`}>
        <svg viewBox={`0 0 ${VW} ${VH}`} width="100%" xmlns="http://www.w3.org/2000/svg">
          <Node x={FUNDER_X} y={FUNDER_Y-26} label={funder.label} Icon={funder.Icon} active />
          <Node x={POT_X}    y={POT_Y-26}    label={potTitle}     Icon={Lock}        active />
          <Node x={PAY1_X}   y={PAY1_Y-26}   label={payees[0].label} Icon={payees[0].Icon} success />
          <Node x={PAY2_X}   y={PAY2_Y-26}   label={payees[1].label} Icon={payees[1].Icon} success />
          <Node x={BLOCK_X}  y={BLOCK_Y+54}  label={blocked}         Icon={recipient.Icon}  blocked />
        </svg>
        <div className="mt-2 flex flex-wrap gap-2">
          {captionLabels.map(l => (
            <span key={l} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">{l}</span>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-card border border-[var(--line)] bg-[var(--surface)] overflow-hidden ${className}`}>
      <svg
        key={key}
        ref={svgRef}
        viewBox={`0 0 ${VW} ${VH}`}
        width="100%"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`Earmark flow: the funder locks ${amount} into a pot called "${potTitle}"; the recipient can pay ${payees[0].label} and ${payees[1].label}; payments to ${blocked} are blocked; unspent money returns to the funder.`}
        style={{ display: 'block', minHeight: 200 }}
      >
        <style>{`
          @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
          @keyframes shake   { 0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}75%{transform:translateX(4px)} }
          @keyframes pulse   { 0%,100%{transform:scale(1)}50%{transform:scale(1.08)} }
        `}</style>

        {/* Hidden path defs for animateMotion */}
        <defs>
          <path id="path-0" d={PATH_FP}   />
          <path id="path-1" d={PATH_P1}   />
          <path id="path-2" d={PATH_P2}   />
          <path id="path-3" d={PATH_BLK}  />
          <path id="path-4" d={PATH_BACK} />
        </defs>

        {/* ── Background paths (dashed until active) ── */}
        <path d={PATH_FP}  fill="none" stroke={phase >= 1 ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={phase >= 1 ? 'none' : '6 4'} style={{ transition: 'stroke 0.4s' }} />
        <path d={PATH_P1}  fill="none" stroke={pay1Done   ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={pay1Done   ? 'none' : '6 4'} style={{ transition: 'stroke 0.4s' }} />
        <path d={PATH_P2}  fill="none" stroke={pay2Done   ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={pay2Done   ? 'none' : '6 4'} style={{ transition: 'stroke 0.4s' }} />
        <path d={PATH_BLK} fill="none" stroke={phase === 3 ? '#B42318' : '#DCE1E6'} strokeWidth={2} strokeDasharray="6 4"  style={{ transition: 'stroke 0.4s' }} />

        {/* ── Nodes ── */}
        {/* Funder */}
        <Node x={FUNDER_X} y={FUNDER_Y - 26} label={funder.label}    Icon={funder.Icon}    active={funderActive} />
        {/* Pot */}
        <Node x={POT_X}    y={POT_Y - 26}    label={potTitle}        Icon={Lock}           active={potActive} />
        {/* Amount badge on pot */}
        <rect x={POT_X + 4} y={POT_Y + 28} width={112} height={20} rx={4} fill={phase >= 1 ? '#0F6B5C' : '#E3F1EE'} style={{ transition: 'fill 0.5s' }} />
        <text x={POT_X + 10} y={POT_Y + 42} fontSize={11} fontFamily="'IBM Plex Mono',monospace" fill="white" fontWeight="600">{amount}</text>
        {/* Payees */}
        <Node x={PAY1_X}  y={PAY1_Y - 26}   label={payees[0].label} Icon={payees[0].Icon} active={phase === 1} success={pay1Done} />
        <Node x={PAY2_X}  y={PAY2_Y - 26}   label={payees[1].label} Icon={payees[1].Icon} active={phase === 2} success={pay2Done} />
        {/* Blocked */}
        <Node x={BLOCK_X} y={BLOCK_Y + 54}  label={blocked}         Icon={recipient.Icon} blocked={phase === 3} />
        {/* Recipient */}
        <Node x={RECIP_X - 60} y={RECIP_Y}  label={recipient.label} Icon={recipient.Icon} active={recipActive} />

        {/* ── Red barrier ── */}
        {phase === 3 && (
          <line
            x1={BLOCK_X - 2} y1={BLOCK_Y + 40} x2={BLOCK_X - 2} y2={BLOCK_Y + 80}
            stroke="#B42318" strokeWidth={3} strokeLinecap="round"
            style={{ animation: 'pulse 0.6s ease-in-out 2' }}
          />
        )}
        {phase === 3 && (
          <text x={BLOCK_X - 40} y={BLOCK_Y + 100} fontSize={10} fill="#B42318" fontFamily="'IBM Plex Sans',sans-serif" fontWeight="600" textAnchor="middle">
            Blocked: not an approved payee
          </text>
        )}

        {/* ── Receipts ── */}
        <Receipt x={PAY1_X + 4}  y={PAY1_Y + 28} show={pay1Done} />
        <Receipt x={PAY2_X + 4}  y={PAY2_Y + 28} show={pay2Done} />

        {/* ── Coins (via animateMotion) ── */}
        {fundCoinVisible  && <Coin path={PATH_FP}   phase={0} show />}
        {pay1CoinVisible  && <Coin path={PATH_P1}   phase={1} show />}
        {pay2CoinVisible  && <Coin path={PATH_P2}   phase={2} show />}
        {blkCoinVisible   && <Coin path={PATH_BLK}  phase={3} show />}
        {backCoinVisible  && <Coin path={PATH_BACK} phase={4} show />}

        {/* ── "back to funder" label ── */}
        {phase === 4 && (
          <text
            x={(cx(FUNDER_X) + cx(POT_X)) / 2}
            y={FUNDER_Y - 52}
            fontSize={10} fill="#5B6775" fontFamily="'IBM Plex Sans',sans-serif"
            textAnchor="middle"
            style={{ animation: 'slideUp 0.4s ease both' }}
          >
            Unspent money returns to the funder
          </text>
        )}
      </svg>

      {/* ── Captions row ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 pt-1" role="list" aria-label="Flow steps">
        {captionLabels.map((label, i) => {
          const isActive = phase === captionPhaseMap[i] || (i === 1 && phase === 2)
          return (
            <button
              key={label}
              role="listitem"
              onClick={() => handleCaption(captionPhaseMap[i])}
              className="rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              style={{
                background: isActive ? 'var(--accent)' : 'var(--accent-soft)',
                color:      isActive ? 'white' : 'var(--accent)',
              }}
              aria-current={isActive ? 'step' : undefined}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={handlePlayPause}
          aria-label={playing ? 'Pause animation' : 'Play animation'}
          className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
        >
          {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <button
          onClick={handleReplay}
          aria-label="Replay animation from the beginning"
          className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

// Re-export Lock so callers don't need to import it separately
import { Lock } from 'lucide-react'
