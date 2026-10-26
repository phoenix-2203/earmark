/**
 * Public receipt page: #/receipt/:potId/:paymentIndex
 * No wallet needed. Shows purpose, payee, amount, memo, date, explorer link.
 * Supports: Download PNG, Share (mobile), Print / Save as PDF.
 */
import {
  ArrowLeft, ExternalLink, Copy, Check,
  Loader2, Download, Share2, Printer,
} from 'lucide-react'
import { useState, useCallback } from 'react'
import { usePot, usePayments, usePayees } from '@/hooks/useEarmark'
import { usePaidEventTxHash } from '@/hooks/useEventTxHash'
import { hashToSlug } from '@/lib/slugLinks'
import { EARMARK_CHAIN } from '@/earmarkConfig'
import { formatUsdc, shortAddr, formatDateTime } from '@/utils/format'
import { downloadReceiptPng, receiptPngFile } from '@/utils/receiptCanvas'
import CategoryBadge from '@/components/CategoryBadge'
import PayeeBadge from '@/components/PayeeBadge'
import { Card } from '@/components/ui/Card'
import { AddressChip } from '@/components/ui/AddressChip'
import { parseLabel } from '@/lib/payeeLabel'

interface Props {
  potId: bigint
  paymentIndex: number
  onBack: () => void
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs uppercase tracking-widest text-[var(--muted)]">{label}</p>
      <p className={`text-sm font-medium break-all text-[var(--ink)] ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

export default function ReceiptPage({ potId, paymentIndex, onBack }: Props) {
  const { data: pot,      isLoading: potLoading  } = usePot(potId)
  const { data: payments, isLoading: pmtLoading  } = usePayments(potId)
  const { data: payees                            } = usePayees(potId)
  const { txHash                                  } = usePaidEventTxHash(potId, paymentIndex)

  const [copied,       setCopied      ] = useState(false)
  const [downloading,  setDownloading ] = useState(false)
  const [sharing,      setSharing     ] = useState(false)

  const loading = potLoading || pmtLoading

  /* ── helpers ─────────────────────────────────────────────────────────── */

  const receiptSlug = txHash ? hashToSlug(txHash) : undefined
  // Use slug link when available; fall back to numeric for loading state
  const receiptUrl = receiptSlug
    ? `${window.location.origin}/#/r/${receiptSlug}`
    : `${window.location.origin}/#/receipt/${potId}/${paymentIndex}`
  const filename   = `earmark-receipt-pot${potId}-${paymentIndex}.png`

  function handleCopyLink() {
    void navigator.clipboard.writeText(receiptUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Build the data object for the canvas — only after data has loaded
  const buildReceiptData = useCallback(() => {
    if (!pot || !payments || payments.length === 0 || paymentIndex >= payments.length) return null
    const payment   = payments[paymentIndex]
    const payeeEntry = (payees ?? []).find(
      (p) => p.address.toLowerCase() === payment.payee.toLowerCase()
    )
    return {
      amount:       formatUsdc(payment.amount),
      memo:         payment.memo,
      purpose:      (pot as { title: string }).title,
      category:     (pot as { category: number }).category,
      payeeLabel:   payeeEntry ? parseLabel(payeeEntry.label).name : '',
      payeeAddress: payment.payee,
      payerAddress: payment.payer,
      dateTime:     formatDateTime(payment.timestamp),
      potId:        potId.toString(),
      txHash:       txHash ?? null,
      receiptUrl,
    }
  }, [pot, payments, payees, paymentIndex, potId, txHash, receiptUrl])

  const handleDownload = useCallback(() => {
    const data = buildReceiptData()
    if (!data) return
    setDownloading(true)
    void downloadReceiptPng(data, filename).finally(() => setDownloading(false))
  }, [buildReceiptData, filename])

  const handleShare = useCallback(() => {
    const data = buildReceiptData()
    if (!data) return
    setSharing(true)
    void receiptPngFile(data, filename).then(async (file) => {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Earmark receipt — ${data.amount} USDC`,
          text: `Payment receipt for pot #${data.potId}`,
          files: [file],
        })
      }
    }).finally(() => setSharing(false))
  }, [buildReceiptData, filename])

  function handlePrint() { window.print() }

  /* ── render states ──────────────────────────────────────────────────── */

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--muted)]" aria-label="Loading" />
      </div>
    )
  }

  if (!pot || !payments || payments.length === 0 || paymentIndex >= payments.length) {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-12 text-center">
        <p className="text-sm font-semibold text-[var(--ink)]">Receipt not found.</p>
        <button onClick={onBack} className="mt-4 text-sm text-[var(--accent)] hover:underline">
          Go back
        </button>
      </main>
    )
  }

  const payment    = payments[paymentIndex]
  const payeeEntry = (payees ?? []).find(
    (p) => p.address.toLowerCase() === payment.payee.toLowerCase()
  )
  const parsedPayee = payeeEntry ? parseLabel(payeeEntry.label) : null
  const dataReady    = !loading   // tx hash optional — still allow download

  // Does the browser support file sharing?
  const canShareFiles = typeof navigator.canShare === 'function'

  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">

      {/* ── Top action bar ─────────────────────────────────────────── */}
      <div className="receipt-actions mb-6 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Copy link */}
          <button
            onClick={handleCopyLink}
            aria-label="Copy receipt link"
            className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
          >
            {copied
              ? <Check className="size-4 text-[var(--success)]" aria-hidden />
              : <Copy className="size-4" aria-hidden />}
            {copied ? 'Copied!' : 'Copy link'}
          </button>

          {/* Download PNG */}
          <button
            onClick={handleDownload}
            disabled={!dataReady || downloading}
            aria-label="Download receipt image"
            className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {downloading
              ? <Loader2 className="size-4 animate-spin" aria-hidden />
              : <Download className="size-4" aria-hidden />}
            {downloading ? 'Generating…' : 'Download image'}
          </button>

          {/* Share (mobile only, when supported) */}
          {canShareFiles && (
            <button
              onClick={handleShare}
              disabled={!dataReady || sharing}
              aria-label="Share receipt"
              className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {sharing
                ? <Loader2 className="size-4 animate-spin" aria-hidden />
                : <Share2 className="size-4" aria-hidden />}
              {sharing ? 'Preparing…' : 'Share'}
            </button>
          )}

          {/* Print / Save as PDF */}
          <button
            onClick={handlePrint}
            aria-label="Print or save as PDF"
            className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
          >
            <Printer className="size-4" aria-hidden />
            Print / PDF
          </button>
        </div>
      </div>

      {/* ── Receipt card (gets a class so the print stylesheet can target it) */}
      <div className="receipt-card">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex justify-center">
            <img src="/earmark-mark.svg" alt="" aria-hidden className="h-10 w-auto" />
          </div>
          <h1 className="display text-2xl font-semibold text-[var(--ink)]">Payment receipt</h1>
          <p className="mt-1 text-xs text-[var(--muted)]">Verified on {EARMARK_CHAIN.name}</p>
          <p className="mt-2 text-xs text-[var(--muted)] max-w-xs mx-auto">
            Read directly from the Arc blockchain. It proves payments from this pot
            to these addresses; it doesn't prove who owns an address.
          </p>
        </div>

        {/* Amount hero */}
        <Card padding="lg" className="mb-5 text-center">
          <p className="font-mono text-5xl font-semibold tabular-nums text-[var(--ink)]">
            {formatUsdc(payment.amount)}
          </p>
          <p className="mt-1 text-base text-[var(--muted)]">USDC</p>
          {payment.memo && (
            <p className="mt-3 text-sm italic text-[var(--muted)]">"{payment.memo}"</p>
          )}
        </Card>

        {/* Details */}
        <Card padding="lg" className="mb-5 space-y-4">
          <Row label="Purpose"  value={(pot as { title: string }).title} />
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-[var(--muted)]">Category</span>
            <CategoryBadge category={(pot as { category: number }).category} />
          </div>
          {parsedPayee ? (
            <>
              <Row label="Paid to" value={parsedPayee.name} />
              <div>
                <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Payee address</p>
                <AddressChip address={payment.payee} />
                <PayeeBadge domain={parsedPayee.domain} address={payment.payee} className="mt-0.5" />
              </div>
            </>
          ) : (
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Paid to</p>
              <AddressChip address={payment.payee} />
            </div>
          )}
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Paid by</p>
            <AddressChip address={payment.payer} />
          </div>
          <Row label="Date and time" value={formatDateTime(payment.timestamp)} />
          <Row label="Pot"           value={`#${potId}`} />
          <Row label="Network"       value={EARMARK_CHAIN.name} />

          {txHash && (
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Transaction</p>
              <a
                href={`${EARMARK_CHAIN.explorerBase}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-[var(--accent)] hover:text-[var(--accent-hover)] underline"
              >
                {shortAddr(txHash)}
                <ExternalLink className="size-3" aria-hidden />
              </a>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--muted)] break-all">{txHash}</p>
            </div>
          )}

          <div className="border-t border-[var(--line)] pt-4">
            <p className="text-xs text-[var(--muted)]">
              This payment is permanently recorded on-chain. The receipt cannot be altered.
            </p>
            <p className="mt-1 text-xs font-mono text-[var(--muted)] break-all">{receiptUrl}</p>
          </div>
        </Card>

        <p className="text-center text-xs text-[var(--muted)]">
          Experimental. Not audited. Use small amounts.
        </p>
      </div>
    </main>
  )
}
