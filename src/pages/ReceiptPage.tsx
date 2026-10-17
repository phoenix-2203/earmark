/**
 * Public receipt page: /receipt/:potId/:paymentIndex
 * No wallet needed. Shows purpose, payee, amount, memo, date, explorer link.
 */
import { usePot, usePayments, usePayees } from '@/hooks/useEarmark'
import { EARMARK_CHAIN } from '@/earmarkConfig'
import { formatUsdc, shortAddr, formatDate } from '@/utils/format'
import CategoryBadge from '@/components/CategoryBadge'
import { CheckCircle, Loader2 } from 'lucide-react'

interface Props {
  potId: bigint
  paymentIndex: number
}

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '1.5rem',
  } as React.CSSProperties,
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>{label}</p>
      <p className={`text-sm font-medium break-all ${mono ? 'mono' : ''}`} style={{ color: 'var(--ink)' }}>{value}</p>
    </div>
  )
}

export default function ReceiptPage({ potId, paymentIndex }: Props) {
  const { data: pot, isLoading: potLoading } = usePot(potId)
  const { data: payments, isLoading: pmtLoading } = usePayments(potId)
  const { data: payees } = usePayees(potId)

  const loading = potLoading || pmtLoading

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    )
  }

  if (!pot || !payments || payments.length === 0 || paymentIndex >= payments.length) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-sm text-center rounded-3xl p-8" style={glass.card}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Receipt not found.</p>
        </div>
      </div>
    )
  }

  const payment = payments[paymentIndex]
  const payeeEntry = (payees ?? []).find((p) => p.address.toLowerCase() === payment.payee.toLowerCase())

  return (
    <div className="min-h-dvh px-4 pb-20 pt-10">
      <div className="mx-auto max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full"
            style={{ background: 'rgba(26,128,71,0.12)' }}
          >
            <CheckCircle className="size-7" style={{ color: 'var(--success)' }} />
          </div>
          <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
            Payment receipt
          </h1>
          <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
            Verified on {EARMARK_CHAIN.name}
          </p>
        </div>

        {/* Amount hero */}
        <div className="mb-6 rounded-3xl p-6 text-center" style={glass.card}>
          <p className="display text-5xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatUsdc(payment.amount)}
          </p>
          <p className="mt-1 text-lg" style={{ color: 'var(--subtle)' }}>USDC</p>
          {payment.memo && (
            <p className="mt-3 text-sm italic" style={{ color: 'var(--muted)' }}>
              "{payment.memo}"
            </p>
          )}
        </div>

        {/* Details */}
        <div className="rounded-3xl p-5 space-y-4" style={glass.card}>
          <Row label="Purpose" value={pot.title} />
          <div className="flex items-center gap-2">
            <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>Category</p>
            <CategoryBadge category={pot.category} />
          </div>
          {payeeEntry ? (
            <>
              <Row label="Paid to" value={payeeEntry.label} />
              <Row label="Payee address" value={payment.payee} mono />
            </>
          ) : (
            <Row label="Paid to" value={payment.payee} mono />
          )}
          <Row label="Paid by" value={shortAddr(payment.payer)} mono />
          <Row label="Date" value={formatDate(payment.timestamp)} />
          <Row label="Pot" value={`#${potId}`} />

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              This payment is permanently recorded on-chain. The receipt cannot be altered.
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: 'var(--subtle)' }}>
          Experimental. Not audited. Use small amounts.
        </p>
      </div>
    </div>
  )
}
