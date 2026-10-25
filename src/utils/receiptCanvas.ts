/**
 * receiptCanvas.ts
 *
 * Two-pass layout:
 *   Pass 1 (measure): walk the full layout without drawing; track y to get
 *                     total content height.
 *   Pass 2 (draw):    set canvas.height = max(1350, contentHeight + margins),
 *                     then walk the same path with drawing enabled.
 *
 * Nothing is ever drawn outside the canvas.
 * Mono values (addresses, hashes) wrap by character so long tokens don't overflow.
 */

import QRCode from 'qrcode'
import { EARMARK_CHAIN } from '@/earmarkConfig'
import { CATEGORY_NAMES } from '@/earmarkTypes'

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#F5F6F8',
  surface: '#FFFFFF',
  line:    '#DCE1E6',
  ink:     '#0F2233',
  ink2:    '#3C4B5A',
  muted:   '#5B6775',
  accent:  '#0F6B5C',
}

const W   = 1080
const ML  = 80          // margin left/right
const CW  = W - ML * 2  // 920 px content width

const SANS = '"IBM Plex Sans", system-ui, -apple-system, "Segoe UI", Arial, sans-serif'
const MONO = '"IBM Plex Mono", ui-monospace, Menlo, "Courier New", monospace'

// ─── Font loading ─────────────────────────────────────────────────────────────
async function loadFonts() {
  await document.fonts.ready
  await Promise.allSettled([
    document.fonts.load(`700 36px ${SANS}`),
    document.fonts.load(`600 28px ${SANS}`),
    document.fonts.load(`600 22px ${SANS}`),
    document.fonts.load(`500 32px ${SANS}`),
    document.fonts.load(`400 24px ${SANS}`),
    document.fonts.load(`400 22px ${SANS}`),
    document.fonts.load(`400 20px ${SANS}`),
    document.fonts.load(`italic 400 26px ${SANS}`),
    document.fonts.load(`700 88px ${MONO}`),
    document.fonts.load(`400 27px ${MONO}`),
    document.fonts.load(`400 24px ${MONO}`),
    document.fonts.load(`400 20px ${MONO}`),
  ])
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

/** Split text into lines that fit maxWidth using word-wrap. */
function wordWrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
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
  return lines
}

/**
 * Split text by character so long unspaced tokens (addresses, hashes) wrap.
 * Uses word-wrap first; any word that still exceeds maxWidth gets char-split.
 */
function monoWrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''

  for (const word of words) {
    // Does this word alone exceed maxWidth? Char-split it.
    if (ctx.measureText(word).width > maxWidth) {
      // Flush current line first
      if (line) { lines.push(line); line = '' }
      // Character-split the long word
      let chunk = ''
      for (const ch of word) {
        if (ctx.measureText(chunk + ch).width > maxWidth) {
          if (chunk) lines.push(chunk)
          chunk = ch
        } else {
          chunk += ch
        }
      }
      if (chunk) { line = chunk }
    } else {
      const test = line ? `${line} ${word}` : word
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line)
        line = word
      } else {
        line = test
      }
    }
  }
  if (line) lines.push(line)
  return lines
}

// ─── Layout engine ────────────────────────────────────────────────────────────
// The engine is a single function that accepts a `draw` flag.
// When draw=false it measures; when draw=true it renders.
// Both passes MUST follow the exact same code path so heights match.

function layoutEngine(
  ctx: CanvasRenderingContext2D,
  data: ReceiptData,
  canvasHeight: number,
  draw: boolean,
): number {
  const CARD_X = 40
  const CARD_Y = 56
  const CARD_W = W - 80

  if (draw) {
    // Background
    ctx.fillStyle = T.bg
    ctx.fillRect(0, 0, W, canvasHeight)

    // Card shadow + fill
    ctx.shadowColor   = 'rgba(15,34,51,0.10)'
    ctx.shadowBlur    = 40
    ctx.shadowOffsetY = 6
    ctx.fillStyle = T.surface
    const CARD_H = canvasHeight - 112
    roundRect(ctx, CARD_X, CARD_Y, CARD_W, CARD_H, 24)
    ctx.fill()
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

    // Accent bar
    ctx.fillStyle = T.accent
    roundRect(ctx, CARD_X, CARD_Y, CARD_W, 10, 5)
    ctx.fill()
  }

  // ── Helper: set font + optional draw ───────────────────────────────────────
  const font = (f: string, size: number, style = '') => {
    ctx.letterSpacing = '0px'
    ctx.font = `${style}${f === MONO ? '400' : '400'} ${size}px ${f}`
  }

  // ── y cursor starts at card top + accent bar + padding ─────────────────────
  let y = CARD_Y + 72   // 56 card top + 10 accent + 6 internal pad + 0 → 72

  // ── SECTION 1: Header ──────────────────────────────────────────────────────

  // Ledger-E mark + "earmark" wordmark, drawn as a centred unit
  // Bars in a 64-unit grid at scale=1: (10,10,44,10), (10,27,30,10), (10,44,44,10), rx=5
  // Mark bounding box: 54×54px (x0..54, y0..54 after shifting origin)
  const MARK_W = 54, MARK_H = 54, MARK_RX = 5
  ctx.letterSpacing = '-0.5px'
  ctx.font = `700 36px ${SANS}`
  const textW = ctx.measureText('earmark').width
  const GAP   = 14
  const groupW = MARK_W + GAP + textW
  const gx = W / 2 - groupW / 2    // left edge of group
  const markOriginY = y - MARK_H + 4  // align mark baseline with text baseline (~4px fudge)

  if (draw) {
    // Outer bar top: x=gx+10, y=markOriginY+10, w=44, h=10, rx=5
    ctx.fillStyle = T.accent
    roundRect(ctx, gx + 10, markOriginY + 10, 44, 10, MARK_RX); ctx.fill()
    // Middle bar (mint): x=gx+10, y=markOriginY+27, w=30, h=10, rx=5
    ctx.fillStyle = '#7CC4B4'
    roundRect(ctx, gx + 10, markOriginY + 27, 30, 10, MARK_RX); ctx.fill()
    // Outer bar bottom: x=gx+10, y=markOriginY+44, w=44, h=10, rx=5
    ctx.fillStyle = T.accent
    roundRect(ctx, gx + 10, markOriginY + 44, 44, 10, MARK_RX); ctx.fill()
    // "earmark" wordmark text
    ctx.textAlign = 'left'
    ctx.fillStyle = T.accent
    ctx.fillText('earmark', gx + MARK_W + GAP, y)
  }
  y += 36 + 18

  // Tagline
  ctx.letterSpacing = '0px'
  ctx.font = `400 22px ${SANS}`
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = T.muted
    ctx.fillText('Purpose-bound payments on Arc', W / 2, y)
  }
  y += 22 + 28

  // PAYMENT RECEIPT
  ctx.letterSpacing = '3px'
  ctx.font = `600 26px ${SANS}`
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = T.muted
    ctx.fillText('PAYMENT RECEIPT', W / 2, y)
  }
  y += 26 + 44

  // ── SECTION 2: Amount block (no divider above it) ─────────────────────────

  // Amount
  ctx.letterSpacing = '-2px'
  ctx.font = `700 88px ${MONO}`
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = T.ink
    ctx.fillText(data.amount, W / 2, y)
  }
  y += 88 + 10

  // USDC label
  ctx.letterSpacing = '3px'
  ctx.font = `500 30px ${SANS}`
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = T.muted
    ctx.fillText('USDC', W / 2, y)
  }
  y += 30 + 36

  // Memo — centered, word-wrapped
  if (data.memo) {
    ctx.letterSpacing = '0px'
    ctx.font = `italic 400 26px ${SANS}`
    const memoText = `"${data.memo}"`
    const memoLines = wordWrapLines(ctx, memoText, CW - 64)
    const memoLH = 36
    if (draw) {
      ctx.textAlign = 'center'
      ctx.fillStyle = T.ink2
      for (const line of memoLines) {
        ctx.fillText(line, W / 2, y)
        y += memoLH
      }
    } else {
      y += memoLines.length * memoLH
    }
    y += 24
  }

  // ── Divider between header block and detail rows ───────────────────────────
  if (draw) {
    ctx.strokeStyle = T.line
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ML, y); ctx.lineTo(W - ML, y)
    ctx.stroke()
  }
  y += 36

  // ── SECTION 3: Detail rows ─────────────────────────────────────────────────
  // Each row: LABEL (caps, small) + VALUE (normal or mono, wrapped)
  const LABEL_FS = 20
  const SANS_FS  = 26
  const MONO_FS  = 24
  const MONO_LH  = 34
  const SANS_LH  = 36

  const drawRow = (label: string, value: string, mono = false): void => {
    const valueFS = mono ? MONO_FS : SANS_FS
    const lineLH  = mono ? MONO_LH : SANS_LH
    const valueFont = mono ? MONO : SANS

    // Label
    ctx.letterSpacing = '1.5px'
    ctx.font = `600 ${LABEL_FS}px ${SANS}`
    if (draw) {
      ctx.textAlign = 'left'
      ctx.fillStyle = T.muted
      ctx.fillText(label.toUpperCase(), ML, y)
    }
    y += LABEL_FS + 8

    // Value — use mono char-wrap for mono, word-wrap for sans
    ctx.letterSpacing = '0px'
    ctx.font = `400 ${valueFS}px ${valueFont}`
    const lines = mono
      ? monoWrapLines(ctx, value, CW)
      : wordWrapLines(ctx, value, CW)
    if (draw) {
      ctx.textAlign = 'left'
      ctx.fillStyle = T.ink
      for (const line of lines) {
        ctx.fillText(line, ML, y)
        y += lineLH
      }
    } else {
      y += lines.length * lineLH
    }
    y += 22  // gap after row
  }

  font(SANS, SANS_FS)
  drawRow('Purpose', data.purpose)
  drawRow('Category', CATEGORY_NAMES[data.category] ?? 'Other')

  const payeeDisplay = data.payeeLabel && data.payeeLabel !== data.payeeAddress
    ? `${data.payeeLabel}  ${data.payeeAddress}`
    : data.payeeAddress
  drawRow('Paid to', payeeDisplay, true)
  drawRow('Paid by', data.payerAddress, true)
  drawRow('Date and time', data.dateTime)
  drawRow('Pot', `#${data.potId}`)
  drawRow('Network', EARMARK_CHAIN.name)

  if (data.txHash) {
    drawRow('Transaction', data.txHash, true)
  }

  // Divider before QR
  if (draw) {
    ctx.strokeStyle = T.line
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ML, y); ctx.lineTo(W - ML, y)
    ctx.stroke()
  }
  y += 36

  // ── SECTION 4: QR code ─────────────────────────────────────────────────────
  // The QR is drawn async during pass 2; in pass 1 we just advance y.
  // We tag a placeholder so we know the y position when drawing.
  const QR_SIZE = 220
  const QR_Y    = y      // remember for pass-2 draw
  y += QR_SIZE + 16

  // QR caption
  ctx.letterSpacing = '0px'
  ctx.font = `400 22px ${SANS}`
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = T.muted
    ctx.fillText('Scan to verify on Earmark', W / 2, y)
  }
  y += 22 + 36

  // ── SECTION 5: Footer ──────────────────────────────────────────────────────
  if (draw) {
    ctx.strokeStyle = T.line
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ML, y); ctx.lineTo(W - ML, y)
    ctx.stroke()
  }
  y += 28

  ctx.letterSpacing = '0px'
  ctx.font = `400 20px ${SANS}`
  if (draw) {
    ctx.textAlign = 'center'
    ctx.fillStyle = T.muted
    ctx.fillText('Recorded on Arc · Earmark · Not audited, use small amounts', W / 2, y)
  }
  y += 20 + 56  // font + bottom card padding

  // Store QR_Y in a side-channel so the draw pass can use it.
  // We can't return two values from layoutEngine so we use a simple trick:
  // stash it on the canvas element as a data attribute (only the draw pass reads it).
  if (!draw) {
    // pass 1: tag the canvas with the QR y position
    ;(ctx.canvas as HTMLCanvasElement & { _qrY?: number })._qrY = QR_Y
  }

  return y
}

// ─── Public data interface ────────────────────────────────────────────────────
export interface ReceiptData {
  amount:       string
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

  // ── Pass 1: measure ────────────────────────────────────────────────────────
  const measureCanvas = document.createElement('canvas')
  measureCanvas.width  = W
  measureCanvas.height = 2000   // generous scratch height for measurement
  const mCtx = measureCanvas.getContext('2d')!
  mCtx.textBaseline = 'alphabetic'
  mCtx.textAlign    = 'left'
  mCtx.letterSpacing = '0px'

  const contentBottom = layoutEngine(mCtx, data, 2000, false)
  const canvasH = Math.max(1350, contentBottom + 56)  // 56 = bottom bg margin

  // ── Pass 2: draw ───────────────────────────────────────────────────────────
  const canvas = document.createElement('canvas')
  canvas.width  = W
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign    = 'left'
  ctx.letterSpacing = '0px'

  layoutEngine(ctx, data, canvasH, true)

  // ── Draw QR code at the position measured in pass 1 ───────────────────────
  // (layoutEngine is synchronous; QR is async so we draw it after)
  const qrY = (measureCanvas as HTMLCanvasElement & { _qrY?: number })._qrY ?? 0
  const QR_SIZE = 220

  try {
    const qrCanvas = document.createElement('canvas')
    await QRCode.toCanvas(qrCanvas, data.receiptUrl, {
      width: QR_SIZE,
      margin: 1,
      color: { dark: '#0F2233', light: '#FFFFFF' },
    })
    ctx.drawImage(qrCanvas, (W - QR_SIZE) / 2, qrY)
  } catch {
    // QR failed — draw URL text instead
    ctx.letterSpacing = '0px'
    ctx.font = `400 18px ${MONO}`
    ctx.textAlign = 'center'
    ctx.fillStyle = T.ink2
    const urlLines = wordWrapLines(ctx, data.receiptUrl, CW - 32)
    let uy = qrY + 24
    for (const line of urlLines) {
      ctx.fillText(line, W / 2, uy)
      uy += 26
    }
  }

  return canvas
}

// ─── Public helpers ───────────────────────────────────────────────────────────

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
