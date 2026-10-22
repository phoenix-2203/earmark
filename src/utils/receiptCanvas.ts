/**
 * receiptCanvas.ts
 *
 * Draws a 1080 × 1350 px Earmark payment receipt PNG using Canvas 2D.
 * No DOM screenshots. Waits for fonts before drawing.
 *
 * Layout contract
 * ───────────────
 * Every text element is placed with an EXPLICIT y baseline computed as:
 *   y_next = y_prev + fontSize + gap
 * "gap" is always ≥ 16 px. Nothing uses a relative +20 or +44 that could
 * silently overlap the next element when the font size changes.
 */

import QRCode from 'qrcode'
import { EARMARK_CHAIN } from '@/earmarkConfig'
import { CATEGORY_NAMES } from '@/earmarkTypes'

// ─── Design tokens (mirrored from index.css) ────────────────────────────────
const T = {
  bg:         '#F5F6F8',
  surface:    '#FFFFFF',
  line:       '#DCE1E6',
  ink:        '#0F2233',
  ink2:       '#3C4B5A',
  muted:      '#5B6775',
  accent:     '#0F6B5C',
  accentSoft: '#E3F1EE',
}

const W   = 1080   // canvas width
const H   = 1350   // canvas height
const ML  = 80     // margin left/right (symmetric)
const CW  = W - ML * 2   // content width = 920

// Font stacks — never fall back to a serif
const SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Arial, sans-serif'
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, "Courier New", monospace'

// ─── Font-load helper ────────────────────────────────────────────────────────
async function loadFonts() {
  await document.fonts.ready
  // Explicitly request the exact variants we use so the browser actually loads them
  await Promise.allSettled([
    document.fonts.load(`700 36px ${SANS}`),
    document.fonts.load(`600 28px ${SANS}`),
    document.fonts.load(`500 32px ${SANS}`),
    document.fonts.load(`400 24px ${SANS}`),
    document.fonts.load(`italic 400 28px ${SANS}`),
    document.fonts.load(`700 88px ${MONO}`),
    document.fonts.load(`400 26px ${MONO}`),
  ])
}

// ─── Wrap left-aligned text, returning the y AFTER the last line ─────────────
// ctx.textAlign must be 'left' when calling this.
function wrapLeft(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,       // y of the FIRST baseline
  maxWidth: number,
  lineHeight: number,  // distance between baselines
): number {
  const words = text.split(' ')
  let line = ''
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y)
      y += lineHeight
      line = word
    } else {
      line = test
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight }
  return y
}

// ─── Wrap centered text, returning the y AFTER the last line ─────────────────
// Measures each word individually to split lines, then centers each line.
function wrapCenter(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,       // y of the FIRST baseline
  maxWidth: number,
  lineHeight: number,
): number {
  const savedAlign = ctx.textAlign
  ctx.textAlign = 'left'
  const words = text.split(' ')
  let line = ''
  const lines: string[] = []
  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  ctx.textAlign = 'center'
  for (const l of lines) {
    ctx.fillText(l, W / 2, y)
    y += lineHeight
  }
  ctx.textAlign = savedAlign
  return y
}

// ─── Round-rect helper ───────────────────────────────────────────────────────
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ─── Divider (returns y after the gap) ──────────────────────────────────────
function drawDivider(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.strokeStyle = T.line
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(ML, y); ctx.lineTo(W - ML, y)
  ctx.stroke()
  return y + 32
}

// ─── Detail row: LABEL above VALUE, left-aligned ─────────────────────────────
// Returns y after the bottom of the value text + gap.
function drawRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  mono = false,
): number {
  const LABEL_SIZE = 22
  const VALUE_SIZE = mono ? 24 : 27
  const LINE_H     = mono ? 34 : 38   // line height for wrapped value

  ctx.textAlign    = 'left'
  ctx.letterSpacing = '1.5px'
  ctx.font         = `600 ${LABEL_SIZE}px ${SANS}`
  ctx.fillStyle    = T.muted
  ctx.fillText(label.toUpperCase(), ML, y)
  y += LABEL_SIZE + 10   // gap between label baseline and value baseline

  ctx.letterSpacing = '0px'
  ctx.font         = `400 ${VALUE_SIZE}px ${mono ? MONO : SANS}`
  ctx.fillStyle    = T.ink
  y = wrapLeft(ctx, value, ML, y, CW, LINE_H)
  return y + 20   // gap after this row
}

// ─── Public data interface ────────────────────────────────────────────────────
export interface ReceiptData {
  amount:       string          // formatted, e.g. "150.00"
  memo:         string
  purpose:      string
  category:     number
  payeeLabel:   string
  payeeAddress: string
  payerAddress: string
  dateTime:     string
  potId:        string
  txHash:       string | null
  receiptUrl:   string
}

// ─── Main draw function ───────────────────────────────────────────────────────
export async function drawReceiptCanvas(data: ReceiptData): Promise<HTMLCanvasElement> {
  await loadFonts()

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // Default state
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'
  ctx.letterSpacing = '0px'

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = T.bg
  ctx.fillRect(0, 0, W, H)

  // ── White card ──────────────────────────────────────────────────────────
  const CARD_X = 40
  const CARD_Y = 56
  const CARD_W = W - 80
  const CARD_H = H - 112
  ctx.shadowColor   = 'rgba(15,34,51,0.10)'
  ctx.shadowBlur    = 40
  ctx.shadowOffsetY = 6
  ctx.fillStyle = T.surface
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24)
  ctx.fill()
  // Reset shadow before all text
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

  // ── Accent bar ──────────────────────────────────────────────────────────
  ctx.fillStyle = T.accent
  roundRect(ctx, CARD_X, CARD_Y, CARD_W, 10, 5)
  ctx.fill()

  // ── HEADER BLOCK — each element owns its own fontSize + gap ─────────────
  //
  // Rule: after drawing a text element at baseline y,
  //   advance: y += fontSize + gap_to_next
  //
  //  Element               fontSize  gap_after
  //  ─────────────────────────────────────────
  //  Wordmark "Earmark"      36        20
  //  Tagline                 24        36
  //  "PAYMENT RECEIPT"       28        36
  //  Divider line                      32 (inside drawDivider)
  //  Amount (big number)     88        16
  //  "USDC"                  32        28
  //  Memo (if present)       26        24
  //  Divider into rows               (32)
  //
  // Total header: 56(card top pad) + 36+20 + 24+36 + 28+36 + 32(div)
  //             = 56 + 56 + 60 + 64 + 32 = 268  (before amount)
  //
  // Amount baseline:  268
  // "USDC" baseline:  268 + 88 + 16 = 372
  // Memo (if any):    372 + 32 + 28 = 432

  let y = CARD_Y + 64   // 56 card-top + 8 accent bar height + padding

  // Wordmark
  ctx.textAlign    = 'center'
  ctx.letterSpacing = '-0.5px'
  ctx.font         = `700 36px ${SANS}`
  ctx.fillStyle    = T.accent
  ctx.fillText('Earmark', W / 2, y)
  y += 36 + 20   // fontSize + gap → y = CARD_Y+64 + 56

  // Tagline
  ctx.letterSpacing = '0px'
  ctx.font         = `400 24px ${SANS}`
  ctx.fillStyle    = T.muted
  ctx.fillText('Purpose-bound payments on Arc', W / 2, y)
  y += 24 + 36   // → +60

  // "PAYMENT RECEIPT" label
  ctx.letterSpacing = '3px'
  ctx.font         = `600 28px ${SANS}`
  ctx.fillStyle    = T.muted
  ctx.fillText('PAYMENT RECEIPT', W / 2, y)
  y += 28 + 40   // → +68

  // Divider between header and amount
  y = drawDivider(ctx, y)   // +32 inside

  // Amount (large monospace number)
  ctx.letterSpacing = '-2px'
  ctx.font         = `700 88px ${MONO}`
  ctx.fillStyle    = T.ink
  ctx.fillText(data.amount, W / 2, y)
  y += 88 + 16   // fontSize + gap

  // "USDC"
  ctx.letterSpacing = '3px'
  ctx.font         = `500 32px ${SANS}`
  ctx.fillStyle    = T.muted
  ctx.fillText('USDC', W / 2, y)
  y += 32 + 32   // → enough room before memo

  // Memo (if present) — centered, wrapped
  if (data.memo) {
    ctx.letterSpacing = '0px'
    ctx.font         = `italic 400 26px ${SANS}`
    ctx.fillStyle    = T.ink2
    y = wrapCenter(ctx, `"${data.memo}"`, y, CW - 64, 36)
    y += 24   // gap after memo
  }

  // Divider into detail rows
  ctx.textAlign = 'left'
  y = drawDivider(ctx, y)

  // ── Detail rows ──────────────────────────────────────────────────────────
  y = drawRow(ctx, 'Purpose', data.purpose, y)
  y = drawRow(ctx, 'Category', CATEGORY_NAMES[data.category] ?? 'Other', y)

  // Paid to: "Label  fullAddress" or just fullAddress
  const payeeDisplay = data.payeeLabel && data.payeeLabel !== data.payeeAddress
    ? `${data.payeeLabel}  ${data.payeeAddress}`
    : data.payeeAddress
  y = drawRow(ctx, 'Paid to', payeeDisplay, y, /* mono */ true)

  y = drawRow(ctx, 'Paid by', data.payerAddress, y, true)
  y = drawRow(ctx, 'Date and time', data.dateTime, y)
  y = drawRow(ctx, 'Pot', `#${data.potId}`, y)
  y = drawRow(ctx, 'Network', EARMARK_CHAIN.name, y)

  if (data.txHash) {
    y = drawRow(ctx, 'Transaction', data.txHash, y, true)
  }

  y = drawDivider(ctx, y)

  // ── QR code (220 px) ─────────────────────────────────────────────────────
  const QR_SIZE = 220
  try {
    const qrCanvas = document.createElement('canvas')
    await QRCode.toCanvas(qrCanvas, data.receiptUrl, {
      width: QR_SIZE,
      margin: 1,
      color: { dark: T.ink, light: T.surface },
    })
    const qrX = (W - QR_SIZE) / 2
    ctx.drawImage(qrCanvas, qrX, y)
    y += QR_SIZE + 16

    ctx.textAlign    = 'center'
    ctx.letterSpacing = '0px'
    ctx.font         = `400 22px ${SANS}`
    ctx.fillStyle    = T.muted
    ctx.fillText('Scan to verify on Earmark', W / 2, y)
    y += 22 + 28
  } catch {
    // QR generation failed — fall back to URL text
    ctx.textAlign    = 'center'
    ctx.letterSpacing = '0px'
    ctx.font         = `600 22px ${SANS}`
    ctx.fillStyle    = T.accent
    ctx.fillText('Verify this receipt at:', W / 2, y)
    y += 22 + 12
    ctx.font      = `400 20px ${MONO}`
    ctx.fillStyle = T.ink2
    y = wrapCenter(ctx, data.receiptUrl, y, CW - 32, 28)
    y += 20
  }

  // ── Footer ───────────────────────────────────────────────────────────────
  y = drawDivider(ctx, y)
  ctx.textAlign    = 'center'
  ctx.letterSpacing = '0px'
  ctx.font         = `400 20px ${SANS}`
  ctx.fillStyle    = T.muted
  ctx.fillText('Recorded on Arc · Earmark · Not audited, use small amounts', W / 2, y)

  return canvas
}

// ─── Public helpers ──────────────────────────────────────────────────────────

export async function downloadReceiptPng(data: ReceiptData, filename: string): Promise<void> {
  const canvas = await drawReceiptCanvas(data)
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href     = dataUrl
  a.download = filename
  a.click()
}

export async function receiptPngFile(data: ReceiptData, filename: string): Promise<File> {
  const canvas = await drawReceiptCanvas(data)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return }
      resolve(new File([blob], filename, { type: 'image/png' }))
    }, 'image/png')
  })
}
