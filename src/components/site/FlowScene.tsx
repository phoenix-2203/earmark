/**
 * FlowScene — animated inline SVG illustrating the Earmark flow.
 *
 * Architecture:
 * - Single rAF loop, single timeline value t (0–LOOP_MS ms), deterministic.
 * - ResizeObserver on wrapper selects landscape (≥640px) or portrait (<640px) layout.
 * - userPaused flag separate from inView/tabVisible: IntersectionObserver resumes on entry.
 * - No animateMotion (unreliable); coin position interpolated via lerp on bezier t.
 * - No text truncation: word-wrap by approximate char width, two lines max.
 * - prefers-reduced-motion: static final frame, all captions visible.
 */
import {
  useEffect, useLayoutEffect, useRef, useCallback, useState, useMemo,
} from 'react'
import type { LucideIcon } from 'lucide-react'
import { Play, Pause, RotateCcw, Lock } from 'lucide-react'

// ─── Public API ───────────────────────────────────────────────────────────────

export interface SceneParty {
  label: string
  Icon: LucideIcon
}

export interface FlowSceneProps {
  funder:     SceneParty
  recipient:  SceneParty
  payees:     [SceneParty, SceneParty]
  blocked:    string
  potTitle:   string
  /** Numeric total, e.g. 500 */
  amountNum:  number
  /** Display label for currency, e.g. "USDC" */
  currency?:  string
  className?: string
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

// Step boundaries in ms (must sum to LOOP_MS)
const S0 = 0        // Fund the pot starts
const S1 = 2500     // Pay payee 1 starts
const S2 = 4000     // Pay payee 2 starts
const S3 = 5500     // Blocked attempt starts
const S4 = 7500     // Leftovers return starts
const LOOP_MS = 10000

// Payee amounts: 80% to p1, 12% to p2, 8% left over
function payee1Amt(total: number) { return Math.round(total * 0.80) }
function payee2Amt(total: number) { return Math.round(total * 0.12) }
function leftover(total: number)  { return total - payee1Amt(total) - payee2Amt(total) }

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

/** Interpolate a cubic bezier at parameter p (0–1) from 4 control points */
function cubicBezierPoint(
  p0x: number, p0y: number,
  p1x: number, p1y: number,
  p2x: number, p2y: number,
  p3x: number, p3y: number,
  t: number,
): [number, number] {
  const u = 1 - t
  const x = u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x
  const y = u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y
  return [x, y]
}

/** Fraction of a step: 0→1 clamped, given ms since step start and step duration */
function stepFrac(t: number, start: number, dur: number): number {
  return Math.max(0, Math.min(1, (t - start) / dur))
}

// ─── Word wrap ────────────────────────────────────────────────────────────────

/** Split text into lines that fit maxWidth, using approx charWidth px per char at fontSize. */
function wordWrap(text: string, maxWidth: number, fontSize: number): string[] {
  const charW = fontSize * 0.52   // approx for IBM Plex Sans
  const words = text.split(' ')
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const candidate = cur ? cur + ' ' + w : w
    if (candidate.length * charW > maxWidth && cur) {
      lines.push(cur)
      cur = w
    } else {
      cur = candidate
    }
  }
  if (cur) lines.push(cur)
  return lines.slice(0, 2)  // max 2 lines
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function SvgText({
  x, y, fontSize, fill, fontWeight, fontFamily, textAnchor, children,
}: {
  x: number; y: number; fontSize: number; fill: string
  fontWeight?: string | number; fontFamily?: string; textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
  children: React.ReactNode
}) {
  return (
    <text
      x={x} y={y}
      fontSize={fontSize}
      fill={fill}
      fontWeight={fontWeight ?? 400}
      fontFamily={fontFamily ?? "'IBM Plex Sans','Segoe UI',Helvetica,Arial,sans-serif"}
      textAnchor={textAnchor ?? 'start'}
      dominantBaseline="auto"
    >
      {children}
    </text>
  )
}

function SvgIcon({ Icon, x, y, size, color }: { Icon: LucideIcon; x: number; y: number; size: number; color: string }) {
  // Render lucide icon paths inline via foreignObject (works in all modern browsers).
  // Cast to any to pass React element as foreignObject child (SVGForeignObjectElement child type is overly strict).
  const iconEl = <Icon width={size} height={size} color={color} aria-hidden style={{ display: 'block' }} />
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <foreignObject x={x - size / 2} y={y - size / 2} width={size} height={size} style={{ overflow: 'visible' }}>
      {iconEl /* foreignObject accepts React elements at runtime */}
    </foreignObject>
  )
}

// ─── Card component ───────────────────────────────────────────────────────────

interface CardProps {
  x: number; y: number; w: number; h: number
  active?: boolean; success?: boolean; blocked?: boolean; accent?: boolean
  label: string        // top caption (e.g. "FUNDER")
  title: string        // main label
  subtext?: string     // second line
  Icon: LucideIcon
  fontSize?: number
}

function Card({ x, y, w, h, active, success, blocked, accent, label, title, subtext, Icon, fontSize = 15 }: CardProps) {
  const stroke  = blocked ? '#B42318' : success ? '#0F6B5C' : accent ? '#0F6B5C' : active ? '#0F6B5C' : '#DCE1E6'
  const bg      = blocked ? '#FDECEC' : accent || success ? '#E3F1EE' : 'white'
  const inkMain = blocked ? '#B42318' : '#0F2233'
  const inkSub  = blocked ? '#B42318' : '#5B6775'
  const iconColor = blocked ? '#B42318' : success || active || accent ? '#0F6B5C' : '#5B6775'
  const strokeW = blocked || success || accent ? 2 : 1.5
  const shadow  = active || success || accent
    ? 'drop-shadow(0 2px 8px rgba(15,107,92,.20))'
    : 'drop-shadow(0 1px 3px rgba(0,0,0,.06))'

  const titleLines = wordWrap(title, w - 44, fontSize)
  const lineH = fontSize * 1.28

  return (
    <g style={{ transition: 'all 0.3s cubic-bezier(.4,0,.2,1)' }}>
      <rect
        x={x} y={y} width={w} height={h} rx={10}
        fill={bg} stroke={stroke} strokeWidth={strokeW}
        strokeDasharray={blocked ? '7 5' : undefined}
        style={{ filter: shadow }}
      />
      {/* Top caption */}
      <SvgText x={x + 12} y={y + 16} fontSize={10} fill={inkSub} fontWeight={600}
        fontFamily="'IBM Plex Sans','Segoe UI',Helvetica,Arial,sans-serif">
        {label}
      </SvgText>
      {/* Icon */}
      <SvgIcon Icon={Icon} x={x + 20} y={y + 36} size={18} color={iconColor} />
      {/* Title (wrapped) */}
      {titleLines.map((line, i) => (
        <SvgText
          key={i}
          x={x + 44} y={y + 30 + i * lineH}
          fontSize={fontSize} fill={inkMain} fontWeight={600}
        >
          {line}
        </SvgText>
      ))}
      {/* Subtext */}
      {subtext && (
        <SvgText x={x + 44} y={y + 30 + titleLines.length * lineH} fontSize={12} fill={inkSub}>
          {subtext}
        </SvgText>
      )}
    </g>
  )
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

interface BezierPath {
  p0x: number; p0y: number
  p1x: number; p1y: number
  p2x: number; p2y: number
  p3x: number; p3y: number
}

function bezierD({ p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y }: BezierPath) {
  return `M ${p0x} ${p0y} C ${p1x} ${p1y}, ${p2x} ${p2y}, ${p3x} ${p3y}`
}

// ─── Coin ─────────────────────────────────────────────────────────────────────

function Coin({ cx, cy, visible, shake = false }: { cx: number; cy: number; visible: boolean; shake?: boolean }) {
  if (!visible) return null
  return (
    <g
      transform={`translate(${cx},${cy})`}
      style={{
        animation: shake ? 'coinShake 0.18s ease-in-out 3' : 'none',
        filter: 'drop-shadow(0 1px 5px rgba(15,107,92,.35))',
      }}
    >
      <circle r={13} fill="#0F6B5C" />
      <text
        textAnchor="middle" dominantBaseline="central"
        fontSize={10} fill="white" fontWeight="700"
        fontFamily="'IBM Plex Mono',ui-monospace,Menlo,monospace"
      >$</text>
    </g>
  )
}

// ─── Receipt chip ─────────────────────────────────────────────────────────────

function ReceiptChip({ x, y, visible, text }: { x: number; y: number; visible: boolean; text: string }) {
  if (!visible) return null
  return (
    <g style={{ animation: 'chipSlide 0.35s cubic-bezier(.4,0,.2,1) both' }}>
      <rect x={x} y={y} width={110} height={24} rx={6} fill="#0F6B5C" />
      <text
        x={x + 8} y={y + 16}
        fontSize={11} fill="white" fontWeight={600}
        fontFamily="'IBM Plex Sans','Segoe UI',Helvetica,Arial,sans-serif"
      >
        {text}
      </text>
    </g>
  )
}

// ─── Barrier ──────────────────────────────────────────────────────────────────

function Barrier({ x, y1, y2, visible }: { x: number; y1: number; y2: number; visible: boolean }) {
  if (!visible) return null
  return (
    <line
      x1={x} y1={y1} x2={x} y2={y2}
      stroke="#B42318" strokeWidth={3.5} strokeLinecap="round"
      style={{ animation: 'barPulse 0.5s ease-in-out 2' }}
    />
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface Layout {
  vw: number; vh: number
  funder:    { x: number; y: number; w: number; h: number }
  pot:       { x: number; y: number; w: number; h: number }
  recip:     { x: number; y: number; w: number; h: number } | null
  payee1:    { x: number; y: number; w: number; h: number }
  payee2:    { x: number; y: number; w: number; h: number }
  blocked:   { x: number; y: number; w: number; h: number }
  // Bezier paths
  pathFP:    BezierPath   // funder → pot
  pathP1:    BezierPath   // pot → payee1
  pathP2:    BezierPath   // pot → payee2
  pathBLK:   BezierPath   // pot → blocked (stops 28px before)
  pathBack:  BezierPath   // pot → funder (return)
  // Receipt chip positions
  receipt1:  { x: number; y: number }
  receipt2:  { x: number; y: number }
  // Barrier x, y span
  barrier:   { x: number; y1: number; y2: number }
  // "Blocked" label
  blockedLabel: { x: number; y: number }
  // "Return" label
  returnLabel:  { x: number; y: number }
  // Pot text positions (inside pot card)
  potAmountY: number   // y offset from pot.y for amount text
  potTitleY:  number   // y offset for pot title
  landscape:  boolean
}

function cx(rect: { x: number; w: number }) { return rect.x + rect.w / 2 }
function cy(rect: { x: number; y: number; w: number; h: number }) { return rect.y + rect.h / 2 }
function right(rect: { x: number; w: number }) { return rect.x + rect.w }
function bottom(rect: { y: number; h: number }) { return rect.y + rect.h }

function makeLandscapeLayout(): Layout {
  const vw = 880, vh = 440
  const funder  = { x: 24,  y: 175, w: 200, h: 96  }
  const pot     = { x: 330, y: 125, w: 230, h: 170 }
  const recip   = { x: 330, y: 330, w: 230, h: 82  }
  const payee1  = { x: 650, y: 30,  w: 206, h: 86  }
  const payee2  = { x: 650, y: 140, w: 206, h: 86  }
  const blocked = { x: 650, y: 272, w: 206, h: 86  }

  const potRC = cx(pot)
  const potRR = right(pot)
  const potCY = cy(pot)

  return {
    vw, vh, funder, pot, recip, payee1, payee2, blocked, landscape: true,
    pathFP: {
      p0x: right(funder),     p0y: cy(funder),
      p1x: right(funder)+40,  p1y: cy(funder),
      p2x: pot.x - 40,        p2y: potCY,
      p3x: pot.x,              p3y: potCY,
    },
    pathP1: {
      p0x: potRR,              p0y: potCY - 30,
      p1x: potRR + 40,         p1y: potCY - 30,
      p2x: payee1.x - 40,      p2y: cy(payee1),
      p3x: payee1.x,           p3y: cy(payee1),
    },
    pathP2: {
      p0x: potRR,              p0y: potCY + 10,
      p1x: potRR + 40,         p1y: potCY + 10,
      p2x: payee2.x - 40,      p2y: cy(payee2),
      p3x: payee2.x,           p3y: cy(payee2),
    },
    pathBLK: {
      p0x: potRR,              p0y: potCY + 45,
      p1x: potRR + 40,         p1y: potCY + 45,
      p2x: blocked.x - 40,     p2y: cy(blocked),
      p3x: blocked.x - 28,    p3y: cy(blocked),
    },
    pathBack: {
      p0x: potRC,              p0y: bottom(pot) + 10,
      p1x: potRC,              p1y: vh - 30,
      p2x: cx(funder),         p2y: vh - 30,
      p3x: cx(funder),         p3y: bottom(funder) + 8,
    },
    receipt1:    { x: payee1.x - 4,  y: bottom(payee1) + 6 },
    receipt2:    { x: payee2.x - 4,  y: bottom(payee2) + 6 },
    barrier:     { x: blocked.x - 6, y1: blocked.y, y2: bottom(blocked) },
    blockedLabel:{ x: blocked.x,     y: bottom(blocked) + 18 },
    returnLabel: { x: potRC - 90,    y: vh - 10 },
    potAmountY:  pot.y + 60,
    potTitleY:   pot.y + 28,
  }
}

function makePortraitLayout(): Layout {
  const vw = 360, vh = 640
  const funder  = { x: 80,  y: 16,  w: 200, h: 80  }
  const pot     = { x: 50,  y: 148, w: 260, h: 150 }
  const payee1  = { x: 8,   y: 360, w: 168, h: 84  }
  const payee2  = { x: 184, y: 360, w: 168, h: 84  }
  const blocked = { x: 40,  y: 472, w: 280, h: 72  }

  const potCX = cx(pot)
  const potB  = bottom(pot)

  return {
    vw, vh, funder, pot, recip: null, payee1, payee2, blocked, landscape: false,
    pathFP: {
      p0x: cx(funder),   p0y: bottom(funder),
      p1x: cx(funder),   p1y: bottom(funder) + 30,
      p2x: potCX,        p2y: pot.y - 30,
      p3x: potCX,        p3y: pot.y,
    },
    pathP1: {
      p0x: potCX - 30,   p0y: potB,
      p1x: potCX - 30,   p1y: potB + 30,
      p2x: cx(payee1),   p2y: payee1.y - 20,
      p3x: cx(payee1),   p3y: payee1.y,
    },
    pathP2: {
      p0x: potCX + 30,   p0y: potB,
      p1x: potCX + 30,   p1y: potB + 30,
      p2x: cx(payee2),   p2y: payee2.y - 20,
      p3x: cx(payee2),   p3y: payee2.y,
    },
    pathBLK: {
      p0x: potCX,        p0y: potB,
      p1x: potCX,        p1y: potB + 40,
      p2x: cx(blocked),  p2y: blocked.y - 20,
      p3x: cx(blocked),  p3y: blocked.y - 10,
    },
    pathBack: {
      p0x: cx(pot) + 100, p0y: pot.y + 40,
      p1x: vw - 20,       p1y: pot.y + 40,
      p2x: vw - 20,       p2y: funder.y + 30,
      p3x: right(funder), p3y: funder.y + 30,
    },
    receipt1:    { x: payee1.x,       y: bottom(payee1) + 5 },
    receipt2:    { x: payee2.x,       y: bottom(payee2) + 5 },
    barrier:     { x: cx(blocked), y1: blocked.y - 14, y2: blocked.y + 4 },
    blockedLabel:{ x: blocked.x + 8, y: bottom(blocked) + 16 },
    returnLabel: { x: vw - 20,       y: funder.y + 20 },
    potAmountY:  pot.y + 66,
    potTitleY:   pot.y + 28,
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FlowScene({
  funder, recipient, payees, blocked: blockedLabel,
  potTitle, amountNum, currency = 'USDC', className = '',
}: FlowSceneProps) {
  const prefersReduced = useMemo(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  , [])

  // ── State ──────────────────────────────────────────────────────────────────
  const [t, setT]             = useState(0)           // 0–LOOP_MS
  const [userPaused, setUserP] = useState(false)
  const [inView, setInView]   = useState(false)
  const [tabVisible, setTabV] = useState(true)
  const [layout, setLayout]   = useState<Layout>(makeLandscapeLayout)
  const [replayKey, setReplay] = useState(0)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const wrapperRef  = useRef<HTMLDivElement>(null)
  const rafRef      = useRef<number | null>(null)
  const lastTsRef   = useRef<number | null>(null)
  const tRef        = useRef(0)
  // Derive playing from flags
  const playing = inView && tabVisible && !userPaused && !prefersReduced

  // ── rAF loop ───────────────────────────────────────────────────────────────
  // tickRef holds the latest tick fn; updated in a layout effect (not render) to avoid the refs-in-render lint rule
  const tickRef = useRef<((ts: number) => void) | null>(null)
  useLayoutEffect(() => {
    tickRef.current = (ts: number) => {
      const prev = lastTsRef.current ?? ts
      lastTsRef.current = ts
      const dt = Math.min(ts - prev, 200)
      tRef.current = (tRef.current + dt) % LOOP_MS
      setT(tRef.current)
      if (tickRef.current) rafRef.current = requestAnimationFrame(tickRef.current)
    }
  })

  useEffect(() => {
    if (playing) {
      lastTsRef.current = null
      if (tickRef.current) rafRef.current = requestAnimationFrame(tickRef.current)
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing])

  // ── IntersectionObserver — resume on entry, pause on exit ─────────────────
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting)
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Tab visibility ─────────────────────────────────────────────────────────
  useEffect(() => {
    function handle() { setTabV(!document.hidden) }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])

  // ── ResizeObserver ─────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const obs = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      setLayout(w >= 640 ? makeLandscapeLayout() : makePortraitLayout())
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // ── Replay ─────────────────────────────────────────────────────────────────
  const handleReplay = useCallback(() => {
    tRef.current = 0
    lastTsRef.current = null
    setT(0)
    setUserP(false)
    setReplay(k => k + 1)
  }, [])

  const handleSeek = useCallback((stepT: number) => {
    tRef.current = stepT
    lastTsRef.current = null
    setT(stepT)
    setUserP(false)
  }, [])

  // ── Derived state from t ───────────────────────────────────────────────────
  const p1Amt  = payee1Amt(amountNum)
  const p2Amt  = payee2Amt(amountNum)
  const left   = leftover(amountNum)
  const curr   = currency

  // Step fractions (0→1)
  const fFund   = easeInOut(stepFrac(t, S0,       S1 - S0 - 200))
  const fPay1   = easeInOut(stepFrac(t, S1,       S2 - S1 - 200))
  const fPay2   = easeInOut(stepFrac(t, S2,       S3 - S2 - 200))
  const fBlk    = easeInOut(stepFrac(t, S3,       1400))
  const fBack   = easeInOut(stepFrac(t, S4,       LOOP_MS - S4 - 600))

  // Coin positions
  function coinPos(path: BezierPath, frac: number): [number, number] {
    return cubicBezierPoint(
      path.p0x, path.p0y,
      path.p1x, path.p1y,
      path.p2x, path.p2y,
      path.p3x, path.p3y,
      frac,
    )
  }

  const coinFundPos   = coinPos(layout.pathFP,   fFund)
  const coinPay1Pos   = coinPos(layout.pathP1,   fPay1)
  const coinPay2Pos   = coinPos(layout.pathP2,   fPay2)
  const coinBlkPos    = coinPos(layout.pathBLK,  fBlk)
  const coinBackPos   = coinPos(layout.pathBack, fBack)

  const showCoinFund  = t >= S0  && t < S1 + 200
  const showCoinPay1  = t >= S1  && t < S2 + 200
  const showCoinPay2  = t >= S2  && t < S3 + 200
  const showCoinBlk   = t >= S3  && t < S3 + 1600
  const showCoinBack  = t >= S4  && t < LOOP_MS - 400
  const blkShake      = fBlk >= 0.95  // near the barrier

  const pay1Done      = t >= S2
  const pay2Done      = t >= S3
  const showBarrier   = showCoinBlk
  const showBlkLabel  = t >= S3 + 900
  const showReceipt1  = pay1Done
  const showReceipt2  = pay2Done
  const showReturn    = t >= S4 + 300

  // Pot amount: counts up during phase 0, then counts down as payments happen
  let potAmt = 0
  if (t < S1)         potAmt = Math.round(fFund * amountNum)
  else if (t < S2)    potAmt = Math.round(amountNum - fPay1 * p1Amt)
  else if (t < S3)    potAmt = Math.round(amountNum - p1Amt - fPay2 * p2Amt)
  else if (t < S4)    potAmt = left
  else                potAmt = Math.round(left * (1 - fBack))

  // Path solid-ness (turn solid once coin has traversed)
  const solidFP  = t >= S1
  const solidP1  = pay1Done
  const solidP2  = pay2Done

  // Active step index for caption highlighting
  const activeStep = t < S1 ? 0 : t < S3 ? 1 : t < S4 ? 2 : 3

  const captionSteps = [
    { label: '1 · Fund the pot',           t: S0 },
    { label: '2 · Pay approved payees',    t: S1 },
    { label: '3 · Blocked if not approved',t: S3 },
    { label: '4 · Leftovers come back',    t: S4 },
  ]

  const lyt = layout

  // ── Static (reduced motion) frame ─────────────────────────────────────────
  if (prefersReduced) {
    const sl = makeLandscapeLayout()
    return (
      <div
        className={`w-full rounded-card border border-[var(--line)] bg-[var(--surface)] p-2 ${className}`}
        role="img"
        aria-label={`Earmark flow: the funder locks ${amountNum} ${curr} into a pot called "${potTitle}"; the recipient can pay ${payees[0].label} and ${payees[1].label}; payments to ${blockedLabel} are blocked; unspent money returns to the funder.`}
      >
        <svg viewBox={`0 0 ${sl.vw} ${sl.vh}`} width="100%" style={{ display: 'block' }}>
          <defs><style>{CSS_KEYFRAMES}</style></defs>
          <path d={bezierD(sl.pathFP)}   fill="none" stroke="#0F6B5C" strokeWidth={2} />
          <path d={bezierD(sl.pathP1)}   fill="none" stroke="#0F6B5C" strokeWidth={2} />
          <path d={bezierD(sl.pathP2)}   fill="none" stroke="#0F6B5C" strokeWidth={2} />
          <path d={bezierD(sl.pathBLK)}  fill="none" stroke="#B42318" strokeWidth={2} strokeDasharray="6 4" />
          <Card {...sl.funder}  Icon={funder.Icon}    label="FUNDER"          title={funder.label} active />
          <Card {...sl.pot}     Icon={Lock}            label="POT"             title={potTitle} subtext={`${amountNum} ${curr}`} accent />
          <Card {...sl.payee1}  Icon={payees[0].Icon}  label="PAYEE 1"         title={payees[0].label} success />
          <Card {...sl.payee2}  Icon={payees[1].Icon}  label="PAYEE 2"         title={payees[1].label} success />
          <Card {...sl.blocked} Icon={recipient.Icon}  label="BLOCKED"         title={blockedLabel} blocked />
          {sl.recip && <Card {...sl.recip} Icon={recipient.Icon} label="RECIPIENT" title={recipient.label} active />}
          <ReceiptChip {...sl.receipt1} visible text={`Receipt · ${p1Amt} ${curr}`} />
          <ReceiptChip {...sl.receipt2} visible text={`Receipt · ${p2Amt} ${curr}`} />
          <SvgText x={sl.blockedLabel.x} y={sl.blockedLabel.y} fontSize={11} fill="#B42318" fontWeight={600}>Blocked by the contract</SvgText>
          <SvgText x={sl.returnLabel.x}  y={sl.returnLabel.y}  fontSize={11} fill="#5B6775">Unspent money returns to the funder</SvgText>
        </svg>
        <div className="mt-2 flex flex-wrap gap-2 px-2 pb-2">
          {captionSteps.map(s => (
            <span key={s.label} className="rounded-full bg-[var(--accent-soft)] px-3 py-1 text-xs font-medium text-[var(--accent)]">{s.label}</span>
          ))}
        </div>
      </div>
    )
  }

  // ── Animated frame ─────────────────────────────────────────────────────────
  return (
    <div
      ref={wrapperRef}
      className={`w-full rounded-card border border-[var(--line)] bg-[var(--surface)] overflow-hidden ${className}`}
    >
      <svg
        key={replayKey}
        viewBox={`0 0 ${lyt.vw} ${lyt.vh}`}
        width="100%"
        style={{ display: 'block' }}
        role="img"
        aria-label={`Earmark flow: the funder locks ${amountNum} ${curr} into a pot called "${potTitle}"; the recipient can pay ${payees[0].label} and ${payees[1].label}; payments to ${blockedLabel} are blocked; unspent money returns to the funder.`}
      >
        <defs><style>{CSS_KEYFRAMES}</style></defs>

        {/* ── Paths (dashed until traversed, solid after) ── */}
        <path d={bezierD(lyt.pathFP)}  fill="none" stroke={solidFP ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={solidFP ? undefined : '6 4'} />
        <path d={bezierD(lyt.pathP1)}  fill="none" stroke={solidP1 ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={solidP1 ? undefined : '6 4'} />
        <path d={bezierD(lyt.pathP2)}  fill="none" stroke={solidP2 ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={solidP2 ? undefined : '6 4'} />
        <path d={bezierD(lyt.pathBLK)} fill="none" stroke={showCoinBlk ? '#B42318' : '#DCE1E6'} strokeWidth={2} strokeDasharray="6 4" />
        <path d={bezierD(lyt.pathBack)}fill="none" stroke={showCoinBack ? '#5B6775' : '#DCE1E6'} strokeWidth={2} strokeDasharray="6 4" />

        {/* ── Cards (behind coins) ── */}
        <Card {...lyt.funder}
          Icon={funder.Icon} label="FUNDER" title={funder.label}
          active={t < S1 || showReturn}
        />
        <Card {...lyt.pot}
          Icon={Lock} label="POT" title={potTitle}
          subtext={`${potAmt} ${curr}`}
          accent
        />
        <Card {...lyt.payee1}
          Icon={payees[0].Icon} label="PAYEE 1" title={payees[0].label}
          active={showCoinPay1} success={pay1Done}
        />
        <Card {...lyt.payee2}
          Icon={payees[1].Icon} label="PAYEE 2" title={payees[1].label}
          active={showCoinPay2} success={pay2Done}
        />
        <Card {...lyt.blocked}
          Icon={recipient.Icon} label="BLOCKED" title={blockedLabel}
          blocked={showCoinBlk}
        />
        {lyt.recip && (
          <Card {...lyt.recip}
            Icon={recipient.Icon} label="RECIPIENT" title={recipient.label}
            active={t >= S1 && t < S4}
          />
        )}

        {/* ── Receipt chips (always above cards) ── */}
        <ReceiptChip {...lyt.receipt1} visible={showReceipt1} text={`Receipt · ${p1Amt} ${curr}`} />
        <ReceiptChip {...lyt.receipt2} visible={showReceipt2} text={`Receipt · ${p2Amt} ${curr}`} />

        {/* ── Barrier ── */}
        <Barrier {...lyt.barrier} visible={showBarrier} />

        {/* ── Labels ── */}
        {showBlkLabel && (
          <SvgText
            x={lyt.blockedLabel.x} y={lyt.blockedLabel.y}
            fontSize={11} fill="#B42318" fontWeight={600}
          >
            Blocked by the contract
          </SvgText>
        )}
        {showReturn && (
          <SvgText
            x={lyt.returnLabel.x} y={lyt.returnLabel.y}
            fontSize={11} fill="#5B6775"
          >
            Unspent money returns to the funder
          </SvgText>
        )}

        {/* ── Coins (always on top) ── */}
        {showCoinFund  && <Coin cx={coinFundPos[0]}  cy={coinFundPos[1]}  visible />}
        {showCoinPay1  && <Coin cx={coinPay1Pos[0]}  cy={coinPay1Pos[1]}  visible />}
        {showCoinPay2  && <Coin cx={coinPay2Pos[0]}  cy={coinPay2Pos[1]}  visible />}
        {showCoinBlk   && <Coin cx={coinBlkPos[0]}   cy={coinBlkPos[1]}   visible shake={blkShake} />}
        {showCoinBack  && <Coin cx={coinBackPos[0]}  cy={coinBackPos[1]}  visible />}
      </svg>

      {/* ── Captions ── */}
      <div className="flex flex-wrap items-center gap-2 px-4 pb-2 pt-1" role="list" aria-label="Flow steps">
        {captionSteps.map((s, i) => (
          <button
            key={s.label}
            role="listitem"
            onClick={() => handleSeek(s.t)}
            className="rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            style={{
              background: activeStep === i ? 'var(--accent)'      : 'var(--accent-soft)',
              color:      activeStep === i ? 'white'              : 'var(--accent)',
            }}
            aria-current={activeStep === i ? 'step' : undefined}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Controls ── */}
      <div className="flex items-center gap-2 px-4 pb-3">
        <button
          onClick={() => setUserP(p => !p)}
          aria-label={userPaused ? 'Play animation' : 'Pause animation'}
          className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
        >
          {userPaused
            ? <Play    className="size-4" aria-hidden />
            : <Pause   className="size-4" aria-hidden />}
        </button>
        <button
          onClick={handleReplay}
          aria-label="Replay animation from the beginning"
          className="rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
        <span className="ml-1 text-xs text-[var(--muted)]">
          {!inView ? 'Paused (scroll into view to play)' : userPaused ? 'Paused' : ''}
        </span>
      </div>
    </div>
  )
}

// ─── CSS keyframes (injected once into each SVG) ──────────────────────────────

const CSS_KEYFRAMES = `
  @keyframes chipSlide {
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes coinShake {
    0%,100% { transform: translateX(0); }
    25%      { transform: translateX(-4px); }
    75%      { transform: translateX(4px); }
  }
  @keyframes barPulse {
    0%,100% { opacity: 1; }
    50%      { opacity: 0.5; }
  }
`


