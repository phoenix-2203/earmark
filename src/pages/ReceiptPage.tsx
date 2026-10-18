/**
 * Public receipt page: #/receipt/:potId/:paymentIndex
 * No wallet needed. Shows purpose, payee, amount, memo, date, explorer link.
 */
import { ArrowLeft, CheckCircle2, ExternalLink } from 'lucide-react'
import { Loader2 } from 'lucide-react'
import { usePot, usePayments, usePayees } from '@/hooks/useEarmark'
import { usePaidEventTxHash } from '@/hooks/useEventTxHash'
import { EARMARK_CHAIN } from '@/earmarkConfig'
import { formatUsdc, shortAddr, formatDate } from '@/utils/format'
import CategoryBadge from '@/components/CategoryBadge'
import { Card } from '@/components/ui/Card'
import { AddressChip } from '@/components/ui/AddressChip'

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
  const { data: pot, isLoading: potLoading } = usePot(potId)
  const { data: payments, isLoading: pmtLoading } = usePayments(potId)
  const { data: payees } = usePayees(potId)
  const { txHash } = usePaidEventTxHash(potId, paymentIndex)

  const loading = potLoading || pmtLoading

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
        <button onClick={onBack} className="mt-4 text-sm text-[var(--accent)] hover:underline">Go back</button>
      </main>
    )
  }

  const payment = payments[paymentIndex]
  const payeeEntry = (payees ?? []).find((p) => p.address.toLowerCase() === payment.payee.toLowerCase())

  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>

      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)]">
          <CheckCircle2 className="size-7 text-[var(--success)]" aria-hidden />
        </div>
        <h1 className="display text-2xl font-semibold text-[var(--ink)]">Payment receipt</h1>
        <p className="mt-1 text-xs text-[var(--muted)]">Verified on {EARMARK_CHAIN.name}</p>
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
        <Row label="Purpose" value={(pot as { title: string }).title} />
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-widest text-[var(--muted)]">Category</span>
          <CategoryBadge category={(pot as { category: number }).category} />
        </div>
        {payeeEntry ? (
          <>
            <Row label="Paid to" value={payeeEntry.label} />
            <div>
              <p className="text-xs uppercase tracking-widest text-[var(--muted)] mb-1">Payee address</p>
              <AddressChip address={payment.payee} />
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
        <Row label="Date" value={formatDate(payment.timestamp)} />
        <Row label="Pot" value={`#${potId}`} />

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
          </div>
        )}

        <div className="border-t border-[var(--line)] pt-4">
          <p className="text-xs text-[var(--muted)]">
            This payment is permanently recorded on-chain. The receipt cannot be altered.
          </p>
        </div>
      </Card>

      <p className="text-center text-xs text-[var(--muted)]">
        Experimental. Not audited. Use small amounts.
      </p>
    </main>
  )
}
