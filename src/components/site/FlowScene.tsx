/**
 * FlowScene — animated inline SVG illustrating the Earmark flow.
 *
 * Architecture:
 * - Single rAF loop, single timeline value t (0–LOOP_MS ms), deterministic.
 * - ResizeObserver on wrapper selects landscape (≥640px) or portrait (<640px) layout.
 * - userPaused flag separate from inView/tabVisible: IntersectionObserver resumes on entry.
 * - No animateMotion (unreliable); coin position interpolated via bezier lerp.
 * - No text truncation: word-wrap by approximate char width, two lines max.
 * - prefers-reduced-motion: static final frame, all captions visible.
 *
 * Fix log (vs 062cdc9):
 * 1. Receipt chips removed; "Paid X USDC · receipt" shown inside payee card as second line.
 * 2. Pot amount large (28px bold ink) + "USDC" (14px muted) + payee constraint (12px muted, 2-line wrap).
 * 3. Count clamped to target at step boundary (reaches 0 exactly at end of back-coin trip).
 * 4. Unified card layout: caption top-left, then icon+label row, label wraps at same x.
 * 5. Return label centered under blocked card in portrait; landscape path from pot bottom-left.
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

const S0 = 0        // Fund the pot starts
const S1 = 2500     // Pay payee 1 starts
const S2 = 4200     // Pay payee 2 starts  (slightly longer step 1 → count reaches full amt)
const S3 = 5700     // Blocked attempt starts
const S4 = 7500     // Leftovers return starts
const LOOP_MS = 10000

// Payee amounts: 80% to p1, 12% to p2, 8% left over
function payee1Amt(total: number) { return Math.round(total * 0.80) }
function payee2Amt(total: number) { return Math.round(total * 0.12) }
function leftover(total: number)  { return total - payee1Amt(total) - payee2Amt(total) }

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

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

function wordWrap(text: string, maxWidth: number, fontSize: number): string[] {
  const charW = fontSize * 0.52
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
  return lines.slice(0, 2)
}

// ─── SVG text helper ──────────────────────────────────────────────────────────

function SvgText({
  x, y, fontSize, fill, fontWeight, fontFamily, textAnchor, children,
}: {
  x: number; y: number; fontSize: number; fill: string
  fontWeight?: string | number; fontFamily?: string
  textAnchor?: 'start' | 'middle' | 'end' | 'inherit'
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

function SvgIcon({ Icon, x, y, size, color }: {
  Icon: LucideIcon; x: number; y: number; size: number; color: string
}) {
  const iconEl = <Icon width={size} height={size} color={color} aria-hidden style={{ display: 'block' }} />
  return (
    <foreignObject x={x - size / 2} y={y - size / 2} width={size} height={size} style={{ overflow: 'visible' }}>
      {iconEl /* foreignObject accepts React elements at runtime */}
    </foreignObject>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────
//
// Layout per spec (fix #4):
//   Line 1: caption (11px muted) at x+PAD, y+14
//   Line 2: icon at (x+PAD+9, iconRowY) + label starting at x+PAD+26, wrapping at same x
//   The icon and label are vertically centred on the same row.
//
// For the POT card, additional content is rendered via potContent.

const PAD = 12  // left/right padding inside card

interface CardProps {
  x: number; y: number; w: number; h: number
  active?: boolean; success?: boolean; blocked?: boolean; accent?: boolean
  /** top caption e.g. "FUNDER" */
  caption:  string
  /** main label */
  title:    string
  Icon:     LucideIcon
  /** if true, render paid line "Paid X USDC · receipt" */
  paidLine?: string
  fontSize?: number
}

function Card({
  x, y, w, h,
  active, success, blocked, accent,
  caption, title, Icon,
  paidLine,
  fontSize = 15,
}: CardProps) {
  const stroke     = blocked ? '#B42318' : (success || accent || active) ? '#0F6B5C' : '#DCE1E6'
  const bg         = blocked ? '#FDECEC' : (accent || success) ? '#E3F1EE' : 'white'
  const inkMain    = blocked ? '#B42318' : '#0F2233'
  const inkSub     = blocked ? '#B42318' : '#5B6775'
  const inkSuccess = '#0F6B5C'
  const iconColor  = blocked ? '#B42318' : (success || active || accent) ? '#0F6B5C' : '#5B6775'
  const strokeW    = (blocked || success || accent) ? 2 : 1.5
  const shadow     = (active || success || accent)
    ? 'drop-shadow(0 2px 8px rgba(15,107,92,.20))'
    : 'drop-shadow(0 1px 3px rgba(0,0,0,.06))'

  // Icon row: centre icon at y+30; label starts to its right
  const iconRowCY = y + 30           // centre-y of icon row
  const iconX     = x + PAD + 9     // centre-x of icon
  const labelX    = x + PAD + 26    // start of label text
  const labelMaxW = w - PAD - 26 - PAD  // room for label

  const titleLines = wordWrap(title, labelMaxW, fontSize)
  const lineH      = fontSize * 1.28

  // First title line baseline: centre on icon row (icon is 18px, so offset ~6px)
  const firstLineY = iconRowCY - ((titleLines.length - 1) * lineH) / 2 + 6

  // Paid line baseline (below last title line)
  const paidLineY  = firstLineY + titleLines.length * lineH + 2

  return (
    <g style={{ transition: 'all 0.3s cubic-bezier(.4,0,.2,1)' }}>
      <rect
        x={x} y={y} width={w} height={h} rx={10}
        fill={bg} stroke={stroke} strokeWidth={strokeW}
        strokeDasharray={blocked ? '7 5' : undefined}
        style={{ filter: shadow }}
      />
      {/* Caption */}
      <SvgText x={x + PAD} y={y + 14} fontSize={11} fill={inkSub} fontWeight={600}>
        {caption}
      </SvgText>
      {/* Icon */}
      <SvgIcon Icon={Icon} x={iconX} y={iconRowCY} size={18} color={iconColor} />
      {/* Title lines */}
      {titleLines.map((line, i) => (
        <SvgText
          key={i}
          x={labelX}
          y={firstLineY + i * lineH}
          fontSize={fontSize}
          fill={inkMain}
          fontWeight={600}
        >
          {line}
        </SvgText>
      ))}
      {/* Paid confirmation line (inside card, replaces floating chip) */}
      {paidLine && (
        <SvgText x={labelX} y={paidLineY} fontSize={13} fill={inkSuccess} fontWeight={600}>
          {paidLine}
        </SvgText>
      )}
    </g>
  )
}

// ─── Pot card (special: large amount + constraint note) ───────────────────────
//
// Layout (fix #2):
//   Caption "POT" at top-left (11px muted)
//   Icon + potTitle row (icon 18px, title 15px bold)
//   Large amount (28px bold ink) + "USDC" (14px muted) on same baseline
//   12px muted constraint note (2 lines max, e.g. "Only Greenfield School\nand City Bookshop can be paid")

interface PotCardProps {
  x: number; y: number; w: number; h: number
  potTitle: string
  potAmt: number
  currency: string
  payeeLabels: [string, string]
}

function PotCard({ x, y, w, h, potTitle, potAmt, currency, payeeLabels }: PotCardProps) {
  const iconRowCY = y + 30
  const iconX     = x + PAD + 9
  const labelX    = x + PAD + 26
  const labelMaxW = w - PAD - 26 - PAD

  const titleLines = wordWrap(potTitle, labelMaxW, 15)
  const lineH      = 15 * 1.28
  const firstLineY = iconRowCY - ((titleLines.length - 1) * lineH) / 2 + 6

  // Amount row: 28px bold amount + 14px "USDC" on same baseline
  const amtY    = firstLineY + titleLines.length * lineH + 16
  const amtStr  = String(potAmt)
  // Approximate width of amount string at 28px (charW ≈ 16px)
  const amtW    = amtStr.length * 16
  const usdcX   = x + PAD + amtW + 6

  // Constraint note: "Only X and Y can be paid"
  const constraintText = `Only ${payeeLabels[0]} and ${payeeLabels[1]} can be paid`
  const constraintLines = wordWrap(constraintText, w - PAD * 2, 12)
  const constraintY0 = amtY + 18

  return (
    <g style={{ transition: 'all 0.3s cubic-bezier(.4,0,.2,1)' }}>
      <rect
        x={x} y={y} width={w} height={h} rx={10}
        fill="#E3F1EE" stroke="#0F6B5C" strokeWidth={2}
        style={{ filter: 'drop-shadow(0 2px 8px rgba(15,107,92,.18))' }}
      />
      {/* Caption */}
      <SvgText x={x + PAD} y={y + 14} fontSize={11} fill="#5B6775" fontWeight={600}>POT</SvgText>
      {/* Lock icon + title */}
      <SvgIcon Icon={Lock} x={iconX} y={iconRowCY} size={18} color="#0F6B5C" />
      {titleLines.map((line, i) => (
        <SvgText key={i} x={labelX} y={firstLineY + i * lineH} fontSize={15} fill="#0F2233" fontWeight={600}>
          {line}
        </SvgText>
      ))}
      {/* Amount (large, bold, ink) + currency label */}
      <SvgText x={x + PAD} y={amtY} fontSize={28} fill="#0F2233" fontWeight={700}>{amtStr}</SvgText>
      <SvgText x={usdcX}   y={amtY} fontSize={14} fill="#5B6775">{currency}</SvgText>
      {/* Constraint note */}
      {constraintLines.map((line, i) => (
        <SvgText key={i} x={x + PAD} y={constraintY0 + i * 15} fontSize={12} fill="#5B6775">{line}</SvgText>
      ))}
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

function Coin({ cx, cy, visible, shake = false }: {
  cx: number; cy: number; visible: boolean; shake?: boolean
}) {
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
  pathFP:    BezierPath
  pathP1:    BezierPath
  pathP2:    BezierPath
  pathBLK:   BezierPath
  pathBack:  BezierPath
  // Barrier position
  barrier:   { x: number; y1: number; y2: number }
  // Label positions
  blockedLabel: { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
  returnLabel:  { x: number; y: number; anchor: 'start' | 'middle' | 'end' }
  landscape:  boolean
}

function cx(rect: { x: number; w: number }) { return rect.x + rect.w / 2 }
function cy(rect: { x: number; y: number; w: number; h: number }) { return rect.y + rect.h / 2 }
function right(rect: { x: number; w: number }) { return rect.x + rect.w }
function bottom(rect: { y: number; h: number }) { return rect.y + rect.h }

function makeLandscapeLayout(): Layout {
  // Fix #5 landscape: return path from pot BOTTOM-LEFT, routed under funder
  const vw = 880, vh = 460   // slightly taller for return path label
  const funder  = { x: 24,  y: 180, w: 200, h: 96  }
  const pot     = { x: 330, y: 90,  w: 240, h: 200 }  // taller for amount + constraint
  const recip   = { x: 330, y: 330, w: 240, h: 82  }
  const payee1  = { x: 658, y: 30,  w: 208, h: 96  }  // taller for paid line
  const payee2  = { x: 658, y: 148, w: 208, h: 96  }
  const blocked = { x: 658, y: 286, w: 208, h: 80  }

  const potL  = pot.x               // pot left edge
  const potB  = bottom(pot)
  const potCY = cy(pot)
  const potRR = right(pot)

  return {
    vw, vh, funder, pot, recip, payee1, payee2, blocked, landscape: true,
    pathFP: {
      p0x: right(funder),    p0y: cy(funder),
      p1x: right(funder)+40, p1y: cy(funder),
      p2x: pot.x - 40,       p2y: potCY,
      p3x: pot.x,             p3y: potCY,
    },
    pathP1: {
      p0x: potRR,             p0y: potCY - 40,
      p1x: potRR + 40,        p1y: potCY - 40,
      p2x: payee1.x - 40,     p2y: cy(payee1),
      p3x: payee1.x,          p3y: cy(payee1),
    },
    pathP2: {
      p0x: potRR,             p0y: potCY,
      p1x: potRR + 40,        p1y: potCY,
      p2x: payee2.x - 40,     p2y: cy(payee2),
      p3x: payee2.x,          p3y: cy(payee2),
    },
    pathBLK: {
      p0x: potRR,             p0y: potCY + 50,
      p1x: potRR + 40,        p1y: potCY + 50,
      p2x: blocked.x - 40,    p2y: cy(blocked),
      p3x: blocked.x - 28,   p3y: cy(blocked),
    },
    // Fix #5: path from pot bottom-left corner, route under funder card, back to funder bottom
    pathBack: {
      p0x: potL,              p0y: potB,
      p1x: potL,              p1y: vh - 28,
      p2x: cx(funder),        p2y: vh - 28,
      p3x: cx(funder),        p3y: bottom(funder) + 6,
    },
    barrier:      { x: blocked.x - 6, y1: blocked.y, y2: bottom(blocked) },
    blockedLabel: { x: blocked.x + blocked.w / 2, y: bottom(blocked) + 18, anchor: 'middle' },
    returnLabel:  { x: (potL + cx(funder)) / 2, y: vh - 10, anchor: 'middle' },
  }
}

function makePortraitLayout(): Layout {
  // Fix #5 portrait: extend viewBox height to fit return label below blocked card
  const vw = 360, vh = 660   // was 640 — add 20px for return label below blocked
  const funder  = { x: 80,  y: 16,  w: 200, h: 80  }
  const pot     = { x: 30,  y: 148, w: 300, h: 180 }  // wider+taller for amount+constraint
  const payee1  = { x: 8,   y: 388, w: 168, h: 96  }  // taller for paid line
  const payee2  = { x: 184, y: 388, w: 168, h: 96  }
  const blocked = { x: 30,  y: 510, w: 300, h: 72  }

  const potCX = cx(pot)
  const potB  = bottom(pot)

  return {
    vw, vh, funder, pot, recip: null, payee1, payee2, blocked, landscape: false,
    pathFP: {
      p0x: cx(funder),  p0y: bottom(funder),
      p1x: cx(funder),  p1y: bottom(funder) + 28,
      p2x: potCX,       p2y: pot.y - 28,
      p3x: potCX,       p3y: pot.y,
    },
    pathP1: {
      p0x: potCX - 30,  p0y: potB,
      p1x: potCX - 30,  p1y: potB + 28,
      p2x: cx(payee1),  p2y: payee1.y - 16,
      p3x: cx(payee1),  p3y: payee1.y,
    },
    pathP2: {
      p0x: potCX + 30,  p0y: potB,
      p1x: potCX + 30,  p1y: potB + 28,
      p2x: cx(payee2),  p2y: payee2.y - 16,
      p3x: cx(payee2),  p3y: payee2.y,
    },
    pathBLK: {
      p0x: potCX,       p0y: potB,
      p1x: potCX,       p1y: potB + 36,
      p2x: cx(blocked), p2y: blocked.y - 16,
      p3x: cx(blocked), p3y: blocked.y - 8,
    },
    // Right-side return path: pot right edge → curve up to funder right edge
    pathBack: {
      p0x: right(pot) - 10, p0y: pot.y + 60,
      p1x: vw - 16,          p1y: pot.y + 60,
      p2x: vw - 16,          p2y: funder.y + 40,
      p3x: right(funder),    p3y: funder.y + 40,
    },
    barrier:      { x: cx(blocked), y1: blocked.y - 14, y2: blocked.y + 4 },
    blockedLabel: { x: cx(blocked), y: bottom(blocked) + 18, anchor: 'middle' },
    // Fix #5 portrait: return label centered under blocked card, inside viewBox
    returnLabel:  { x: cx(blocked), y: bottom(blocked) + 36, anchor: 'middle' },
  }
}

// ─── Dev overlap check ────────────────────────────────────────────────────────

function checkOverlap(lyt: Layout): void {
  if (process.env.NODE_ENV !== 'development') return
  const rects = [lyt.funder, lyt.pot, lyt.payee1, lyt.payee2, lyt.blocked]
  if (lyt.recip) rects.push(lyt.recip)
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
      if (ox > 0 && oy > 0) {
        console.warn(`[FlowScene] overlap ${i} vs ${j}: ${ox}×${oy}px`, a, b)
      }
    }
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

  const [t, setT]              = useState(0)
  const [userPaused, setUserP] = useState(false)
  const [inView, setInView]    = useState(false)
  const [tabVisible, setTabV]  = useState(true)
  const [layout, setLayout]    = useState<Layout>(makeLandscapeLayout)
  const [replayKey, setReplay] = useState(0)

  const wrapperRef  = useRef<HTMLDivElement>(null)
  const rafRef      = useRef<number | null>(null)
  const lastTsRef   = useRef<number | null>(null)
  const tRef        = useRef(0)

  const playing = inView && tabVisible && !userPaused && !prefersReduced

  // rAF tick (via layoutEffect to avoid refs-in-render lint)
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
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [playing])

  // IntersectionObserver: resume on entry, pause on exit
  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting)
    }, { threshold: 0.15 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Tab visibility
  useEffect(() => {
    function handle() { setTabV(!document.hidden) }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [])

  // ResizeObserver: switch layouts
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

  // Dev overlap check (once per layout change)
  useEffect(() => { checkOverlap(layout) }, [layout])

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

  // ── Derived amounts ─────────────────────────────────────────────────────────
  const p1Amt = payee1Amt(amountNum)
  const p2Amt = payee2Amt(amountNum)
  const left  = leftover(amountNum)
  const curr  = currency

  // ── Step fractions ──────────────────────────────────────────────────────────
  // Each coin travels from step start for (stepDur - 300ms), then holds
  const fundDur  = S1 - S0 - 300     // coin travel during fund step
  const pay1Dur  = S2 - S1 - 300
  const pay2Dur  = S3 - S2 - 300
  const blkDur   = 1400
  const backDur  = LOOP_MS - S4 - 400

  const fFund  = easeInOut(stepFrac(t, S0, fundDur))
  const fPay1  = easeInOut(stepFrac(t, S1, pay1Dur))
  const fPay2  = easeInOut(stepFrac(t, S2, pay2Dur))
  const fBlk   = easeInOut(stepFrac(t, S3, blkDur))
  const fBack  = easeInOut(stepFrac(t, S4, backDur))

  // ── Pot amount — fix #3: clamp to exact target at step boundary ─────────────
  let potAmt: number
  if (t < S1)       potAmt = Math.round(fFund * amountNum)
  else if (t < S2)  potAmt = Math.round(amountNum - fPay1 * p1Amt)
  else if (t < S3)  potAmt = Math.round(amountNum - p1Amt - fPay2 * p2Amt)
  else if (t < S4)  potAmt = left
  else              potAmt = Math.round(left * (1 - fBack))

  // Hard clamp at step boundaries so count reaches exact values
  if (t >= S1 && t < S1 + 100)  potAmt = amountNum          // just entered pay-1
  if (t >= S2 && t < S2 + 100)  potAmt = amountNum - p1Amt  // just entered pay-2
  if (t >= S3 && t < S3 + 100)  potAmt = left               // just entered blocked
  if (t >= LOOP_MS - 200)       potAmt = 0                   // last 200ms → exactly 0

  // ── Coin visibility & positions ─────────────────────────────────────────────
  function coinPos(path: BezierPath, frac: number): [number, number] {
    return cubicBezierPoint(
      path.p0x, path.p0y, path.p1x, path.p1y,
      path.p2x, path.p2y, path.p3x, path.p3y,
      frac,
    )
  }

  const lyt = layout

  const showCoinFund = t >= S0 && t < S1 + 100
  const showCoinPay1 = t >= S1 && t < S2 + 100
  const showCoinPay2 = t >= S2 && t < S3 + 100
  const showCoinBlk  = t >= S3 && t < S3 + blkDur + 200
  const showCoinBack = t >= S4 && t < LOOP_MS - 200
  const blkShake     = fBlk >= 0.9

  const pay1Done     = t >= S2
  const pay2Done     = t >= S3
  const showBarrier  = showCoinBlk
  const showBlkLabel = t >= S3 + 900
  const showReturn   = t >= S4 + 300

  const solidFP  = t >= S1
  const solidP1  = pay1Done
  const solidP2  = pay2Done

  const activeStep = t < S1 ? 0 : t < S3 ? 1 : t < S4 ? 2 : 3

  const captionSteps = [
    { label: '1 · Fund the pot',            t: S0 },
    { label: '2 · Pay approved payees',     t: S1 },
    { label: '3 · Blocked if not approved', t: S3 },
    { label: '4 · Leftovers come back',     t: S4 },
  ]

  // Paid lines for payee cards (fix #1: inside card, no floating chip)
  const paidLine1 = pay1Done ? `✓ Paid ${p1Amt} ${curr} · receipt` : undefined
  const paidLine2 = pay2Done ? `✓ Paid ${p2Amt} ${curr} · receipt` : undefined

  // ── Static (reduced motion) frame ─────────────────────────────────────────
  if (prefersReduced) {
    const sl = makeLandscapeLayout()
    return (
      <div
        className={`w-full rounded-card border border-[var(--line)] bg-[var(--surface)] p-2 ${className}`}
        role="img"
        aria-label={`Earmark flow: the funder locks ${amountNum} ${curr} into "${potTitle}"; the recipient can pay ${payees[0].label} and ${payees[1].label}; payments to ${blockedLabel} are blocked; unspent money returns to the funder.`}
      >
        <svg viewBox={`0 0 ${sl.vw} ${sl.vh}`} width="100%" style={{ display: 'block' }}>
          <defs><style>{CSS_KEYFRAMES}</style></defs>
          <path d={bezierD(sl.pathFP)}  fill="none" stroke="#0F6B5C" strokeWidth={2} />
          <path d={bezierD(sl.pathP1)}  fill="none" stroke="#0F6B5C" strokeWidth={2} />
          <path d={bezierD(sl.pathP2)}  fill="none" stroke="#0F6B5C" strokeWidth={2} />
          <path d={bezierD(sl.pathBLK)} fill="none" stroke="#B42318" strokeWidth={2} strokeDasharray="6 4" />
          <Card {...sl.funder}  Icon={funder.Icon}   caption="FUNDER"  title={funder.label}  active />
          <PotCard {...sl.pot} potTitle={potTitle} potAmt={amountNum} currency={curr} payeeLabels={[payees[0].label, payees[1].label]} />
          <Card {...sl.payee1} Icon={payees[0].Icon} caption="PAYEE 1" title={payees[0].label} success paidLine={`✓ Paid ${p1Amt} ${curr} · receipt`} />
          <Card {...sl.payee2} Icon={payees[1].Icon} caption="PAYEE 2" title={payees[1].label} success paidLine={`✓ Paid ${p2Amt} ${curr} · receipt`} />
          <Card {...sl.blocked} Icon={recipient.Icon} caption="BLOCKED" title={blockedLabel} blocked />
          {sl.recip && <Card {...sl.recip} Icon={recipient.Icon} caption="RECIPIENT" title={recipient.label} active />}
          <SvgText x={sl.blockedLabel.x} y={sl.blockedLabel.y} fontSize={11} fill="#B42318" fontWeight={600} textAnchor={sl.blockedLabel.anchor}>Blocked by the contract</SvgText>
          <SvgText x={sl.returnLabel.x}  y={sl.returnLabel.y}  fontSize={11} fill="#5B6775" textAnchor={sl.returnLabel.anchor}>Unspent money returns to the funder</SvgText>
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
  const coinFundPos = coinPos(lyt.pathFP,   fFund)
  const coinPay1Pos = coinPos(lyt.pathP1,   fPay1)
  const coinPay2Pos = coinPos(lyt.pathP2,   fPay2)
  const coinBlkPos  = coinPos(lyt.pathBLK,  fBlk)
  const coinBackPos = coinPos(lyt.pathBack, fBack)

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
        aria-label={`Earmark flow: the funder locks ${amountNum} ${curr} into "${potTitle}"; the recipient can pay ${payees[0].label} and ${payees[1].label}; payments to ${blockedLabel} are blocked; unspent money returns to the funder.`}
      >
        <defs><style>{CSS_KEYFRAMES}</style></defs>

        {/* ── Paths ── */}
        <path d={bezierD(lyt.pathFP)}   fill="none" stroke={solidFP ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={solidFP ? undefined : '6 4'} />
        <path d={bezierD(lyt.pathP1)}   fill="none" stroke={solidP1 ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={solidP1 ? undefined : '6 4'} />
        <path d={bezierD(lyt.pathP2)}   fill="none" stroke={solidP2 ? '#0F6B5C' : '#DCE1E6'} strokeWidth={2} strokeDasharray={solidP2 ? undefined : '6 4'} />
        <path d={bezierD(lyt.pathBLK)}  fill="none" stroke={showCoinBlk  ? '#B42318' : '#DCE1E6'} strokeWidth={2} strokeDasharray="6 4" />
        <path d={bezierD(lyt.pathBack)} fill="none" stroke={showCoinBack ? '#5B6775' : '#DCE1E6'} strokeWidth={2} strokeDasharray="6 4" />

        {/* ── Cards (behind coins) ── */}
        <Card {...lyt.funder}
          Icon={funder.Icon} caption="FUNDER" title={funder.label}
          active={t < S1 || showReturn}
        />
        {/* POT card — special component */}
        <PotCard {...lyt.pot}
          potTitle={potTitle} potAmt={potAmt}
          currency={curr} payeeLabels={[payees[0].label, payees[1].label]}
        />
        {/* Payee 1 — fix #1: paid line inside card */}
        <Card {...lyt.payee1}
          Icon={payees[0].Icon} caption="PAYEE 1" title={payees[0].label}
          active={showCoinPay1} success={pay1Done}
          paidLine={paidLine1}
        />
        {/* Payee 2 — fix #1: paid line inside card */}
        <Card {...lyt.payee2}
          Icon={payees[1].Icon} caption="PAYEE 2" title={payees[1].label}
          active={showCoinPay2} success={pay2Done}
          paidLine={paidLine2}
        />
        <Card {...lyt.blocked}
          Icon={recipient.Icon} caption="BLOCKED" title={blockedLabel}
          blocked={showCoinBlk}
        />
        {lyt.recip && (
          <Card {...lyt.recip}
            Icon={recipient.Icon} caption="RECIPIENT" title={recipient.label}
            active={t >= S1 && t < S4}
          />
        )}

        {/* ── Barrier ── */}
        <Barrier {...lyt.barrier} visible={showBarrier} />

        {/* ── Labels ── */}
        {showBlkLabel && (
          <SvgText
            x={lyt.blockedLabel.x} y={lyt.blockedLabel.y}
            fontSize={11} fill="#B42318" fontWeight={600}
            textAnchor={lyt.blockedLabel.anchor}
          >
            Blocked by the contract
          </SvgText>
        )}
        {showReturn && (
          <SvgText
            x={lyt.returnLabel.x} y={lyt.returnLabel.y}
            fontSize={11} fill="#5B6775"
            textAnchor={lyt.returnLabel.anchor}
          >
            Unspent money returns to the funder
          </SvgText>
        )}

        {/* ── Coins (always on top) ── */}
        {showCoinFund && <Coin cx={coinFundPos[0]}  cy={coinFundPos[1]}  visible />}
        {showCoinPay1 && <Coin cx={coinPay1Pos[0]}  cy={coinPay1Pos[1]}  visible />}
        {showCoinPay2 && <Coin cx={coinPay2Pos[0]}  cy={coinPay2Pos[1]}  visible />}
        {showCoinBlk  && <Coin cx={coinBlkPos[0]}   cy={coinBlkPos[1]}   visible shake={blkShake} />}
        {showCoinBack && <Coin cx={coinBackPos[0]}  cy={coinBackPos[1]}  visible />}
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
              background: activeStep === i ? 'var(--accent)'     : 'var(--accent-soft)',
              color:      activeStep === i ? 'white'             : 'var(--accent)',
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

// ─── CSS keyframes ────────────────────────────────────────────────────────────

const CSS_KEYFRAMES = `
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
