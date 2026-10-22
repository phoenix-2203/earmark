/**
 * receiptCanvas.ts
 *
 * Draws a 1080 × 1350 px Earmark payment receipt as a PNG using Canvas 2D.
 * No DOM screenshots, no external libraries.
 * Waits for document.fonts.ready so IBM Plex fonts are available.
 */

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
  success:    '#157A55',
}

const W  = 1080   // canvas width
const H  = 1350   // canvas height
const ML = 72     // margin left/right
const CW = W - ML * 2  // content width

// ─── Text utilities ──────────────────────────────────────────────────────────

/**
 * Draw wrapped text, returning the y position after the last line.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
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

// ─── Round-rect helper (polyfills older Chrome) ──────────────────────────────
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

// ─── Row helper ──────────────────────────────────────────────────────────────
function drawRow(
  ctx: CanvasRenderingContext2D,
  label: string,
  value: string,
  y: number,
  mono = false,
): number {
  // Label
  ctx.font = '600 26px "IBM Plex Sans"'
  ctx.fillStyle = T.muted
  ctx.letterSpacing = '1.5px'
  ctx.fillText(label.toUpperCase(), ML, y)
  y += 38
  // Value (may wrap)
  ctx.font = mono ? '400 28px "IBM Plex Mono"' : '400 30px "IBM Plex Sans"'
  ctx.fillStyle = T.ink
  ctx.letterSpacing = '0px'
  y = wrapText(ctx, value, ML, y, CW, 40)
  return y + 12
}

// ─── Divider ─────────────────────────────────────────────────────────────────
function drawDivider(ctx: CanvasRenderingContext2D, y: number): number {
  ctx.strokeStyle = T.line
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(ML, y); ctx.lineTo(W - ML, y)
  ctx.stroke()
  return y + 28
}

// ─── Main draw function ──────────────────────────────────────────────────────

export interface ReceiptData {
  amount: string          // formatted, e.g. "150.00"
  memo: string
  purpose: string
  category: number
  payeeLabel: string
  payeeAddress: string
  payerAddress: string
  dateTime: string
  potId: string
  txHash: string | null
  receiptUrl: string
}

export async function drawReceiptCanvas(data: ReceiptData): Promise<HTMLCanvasElement> {
  // Wait for fonts so IBM Plex is available
  await document.fonts.ready

  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = T.bg
  ctx.fillRect(0, 0, W, H)

  // ── White card ──────────────────────────────────────────────────────────
  const CARD_TOP = 60
  const CARD_H   = H - 120
  ctx.shadowColor   = 'rgba(15,34,51,0.08)'
  ctx.shadowBlur    = 32
  ctx.shadowOffsetY = 4
  ctx.fillStyle = T.surface
  roundRect(ctx, 40, CARD_TOP, W - 80, CARD_H, 24)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.shadowBlur  = 0
  ctx.shadowOffsetY = 0

  // ── Accent bar at top ───────────────────────────────────────────────────
  ctx.fillStyle = T.accent
  roundRect(ctx, 40, CARD_TOP, W - 80, 8, 4)
  ctx.fill()

  let y = CARD_TOP + 56

  // ── Wordmark ─────────────────────────────────────────────────────────────
  ctx.font = '700 36px "IBM Plex Sans"'
  ctx.fillStyle = T.accent
  ctx.letterSpacing = '-0.5px'
  ctx.textAlign = 'center'
  ctx.fillText('Earmark', W / 2, y)
  y += 20

  ctx.font = '400 24px "IBM Plex Sans"'
  ctx.fillStyle = T.muted
  ctx.letterSpacing = '0px'
  ctx.fillText('Purpose-bound payments on Arc', W / 2, y)
  y += 44

  // ── "Payment receipt" ─────────────────────────────────────────────────────
  ctx.font = '600 28px "IBM Plex Sans"'
  ctx.fillStyle = T.muted
  ctx.letterSpacing = '3px'
  ctx.fillText('PAYMENT RECEIPT', W / 2, y)
  y += 52

  // ── Amount ───────────────────────────────────────────────────────────────
  ctx.font = '700 96px "IBM Plex Mono"'
  ctx.fillStyle = T.ink
  ctx.letterSpacing = '-2px'
  ctx.fillText(data.amount, W / 2, y)
  y += 24

  ctx.font = '500 32px "IBM Plex Sans"'
  ctx.fillStyle = T.muted
  ctx.letterSpacing = '2px'
  ctx.fillText('USDC', W / 2, y)
  y += 52

  // ── Memo ─────────────────────────────────────────────────────────────────
  if (data.memo) {
    ctx.font = 'italic 28px "IBM Plex Sans"'
    ctx.fillStyle = T.ink2
    ctx.letterSpacing = '0px'
    const quoted = `"${data.memo}"`
    y = wrapText(ctx, quoted, W / 2 - CW / 2, y, CW, 40) + 16
    // centre-align trick: we used left-aligned wrapText anchored at the text
    // start; for true centre we'd need to measure each line — simpler: just
    // use textAlign = 'left' for memo and reset after
  }

  // ── Divider ──────────────────────────────────────────────────────────────
  ctx.textAlign = 'left'
  y = drawDivider(ctx, y)

  // ── Detail rows ──────────────────────────────────────────────────────────
  y = drawRow(ctx, 'Purpose', data.purpose, y)
  y = drawRow(ctx, 'Category', CATEGORY_NAMES[data.category] ?? 'Other', y)

  const payeeDisplay = data.payeeLabel && data.payeeLabel !== data.payeeAddress
    ? `${data.payeeLabel}  ${data.payeeAddress}`
    : data.payeeAddress
  y = drawRow(ctx, 'Paid to', payeeDisplay, y, true)

  y = drawRow(ctx, 'Paid by', data.payerAddress, y, true)
  y = drawRow(ctx, 'Date and time', data.dateTime, y)
  y = drawRow(ctx, 'Pot', `#${data.potId}`, y)
  y = drawRow(ctx, 'Network', EARMARK_CHAIN.name, y)

  if (data.txHash) {
    y = drawRow(ctx, 'Transaction', data.txHash, y, true)
  }

  y = drawDivider(ctx, y)

  // ── Verify URL box ───────────────────────────────────────────────────────
  const BOX_H = 90
  const BOX_Y = y
  ctx.fillStyle = T.accentSoft
  roundRect(ctx, ML, BOX_Y, CW, BOX_H, 12)
  ctx.fill()

  ctx.font = '600 24px "IBM Plex Sans"'
  ctx.fillStyle = T.accent
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'center'
  ctx.fillText('Verify this receipt at:', W / 2, BOX_Y + 32)

  ctx.font = '400 22px "IBM Plex Mono"'
  ctx.fillStyle = T.ink2
  // Wrap URL if too long
  wrapText(ctx, data.receiptUrl, ML + 16, BOX_Y + 60, CW - 32, 28)
  y = BOX_Y + BOX_H + 28

  // ── Footer ───────────────────────────────────────────────────────────────
  ctx.textAlign = 'center'
  ctx.font = '400 22px "IBM Plex Sans"'
  ctx.fillStyle = T.muted
  ctx.fillText('Recorded on Arc · Earmark · Not audited, use small amounts', W / 2, y)

  return canvas
}

/**
 * Trigger a PNG download of the receipt canvas.
 */
export async function downloadReceiptPng(data: ReceiptData, filename: string): Promise<void> {
  const canvas = await drawReceiptCanvas(data)
  const dataUrl = canvas.toDataURL('image/png')
  const a = document.createElement('a')
  a.href     = dataUrl
  a.download = filename
  a.click()
}

/**
 * Return the receipt as a File for Web Share API.
 */
export async function receiptPngFile(data: ReceiptData, filename: string): Promise<File> {
  const canvas = await drawReceiptCanvas(data)
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('Canvas toBlob failed')); return }
      resolve(new File([blob], filename, { type: 'image/png' }))
    }, 'image/png')
  })
}
