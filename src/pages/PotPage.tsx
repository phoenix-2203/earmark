/**
 * Public pot page — /pot/:potId
 * No wallet needed. Shows full pot details, approved payees, and all payment receipts.
 */
import { useState } from 'react'
import { usePot, usePayees, usePayments } from '@/hooks/useEarmark'
import { EARMARK_CHAIN } from '@/earmarkConfig'
import { formatUsdc, shortAddr, formatDate, isExpired } from '@/utils/format'
import CategoryBadge from '@/components/CategoryBadge'
import PotProgress from '@/components/PotProgress'
import {
  ArrowLeft,
  Share2,
  Check,
  Loader2,
  ExternalLink,
  Users,
  Receipt,
} from 'lucide-react'
import type { Pot } from '@/earmarkTypes'

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '1.5rem',
  } as React.CSSProperties,
  inner: {
    background: 'var(--surface-muted)',
    borderRadius: '1rem',
  } as React.CSSProperties,
}

interface Props {
  potId: bigint
  onBack: () => void
  onReceipt: (potId: bigint, index: number) => void
}

function StatusBadge({ pot }: { pot: Pot }) {
  if (pot.closed) {
    return (
      <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
        Closed
      </span>
    )
  }
  if (isExpired(pot.expiry)) {
    return (
      <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}>
        Ended
      </span>
    )
  }
  return (
    <span className="inline-block rounded-full px-3 py-1 text-xs font-semibold" style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}>
      Open
    </span>
  )
}

export default function PotPage({ potId, onBack, onReceipt }: Props) {
  const { data: potRaw, isLoading: potLoading } = usePot(potId)
  const { data: payees, isLoading: payeesLoading } = usePayees(potId)
  const { data: payments, isLoading: paymentsLoading } = usePayments(potId)
  const [copied, setCopied] = useState(false)

  const pot = potRaw

  function handleShare() {
    const url = `${window.location.origin}/#/pot/${potId}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (potLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-8 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    )
  }

  if (!pot || pot.id === 0n) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4">
        <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>Pot not found.</p>
        <button onClick={onBack} className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Go back</button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh px-4 pb-20 pt-6" style={{ maxWidth: '28rem', margin: '0 auto' }}>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--accent)' }}
        >
          <ArrowLeft className="size-4" />
          Back
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
        >
          {copied ? <Check className="size-4" style={{ color: 'var(--success)' }} /> : <Share2 className="size-4" />}
          {copied ? 'Copied!' : 'Share this pot'}
        </button>
      </div>

      {/* Hero card */}
      <section className="mb-4 p-5" style={glass.card}>
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="display text-xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
              {pot.title}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <CategoryBadge category={pot.category} />
              <StatusBadge pot={pot} />
            </div>
          </div>
        </div>

        <div className="mt-4">
          <PotProgress pot={pot} />
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="display text-3xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
            {formatUsdc(pot.totalFunded)}
          </span>
          <span className="text-base font-medium" style={{ color: 'var(--subtle)' }}>USDC funded</span>
        </div>
      </section>

      {/* Participants */}
      <section className="mb-4 p-4" style={glass.card}>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
          Participants
        </h2>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Sender</span>
            <span className="mono text-sm tabular-nums" style={{ color: 'var(--ink)' }}>{shortAddr(pot.sender)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>Beneficiary</span>
            <span className="mono text-sm tabular-nums" style={{ color: 'var(--ink)' }}>{shortAddr(pot.beneficiary)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--muted)' }}>End date</span>
            <span className="text-sm tabular-nums" style={{ color: 'var(--ink)' }}>{formatDate(pot.expiry)}</span>
          </div>
        </div>
      </section>

      {/* Approved payees */}
      <section className="mb-4 p-4" style={glass.card}>
        <div className="mb-3 flex items-center gap-2">
          <Users className="size-4" style={{ color: 'var(--muted)' }} />
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Approved payees
          </h2>
        </div>
        {payeesLoading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : !payees || payees.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No approved payees yet.</p>
        ) : (
          <div className="space-y-2">
            {payees.map((p) => (
              <div key={p.address} className="flex items-center justify-between rounded-xl p-3" style={glass.inner}>
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{p.label}</p>
                  <p className="mono text-xs" style={{ color: 'var(--muted)' }}>{shortAddr(p.address)}</p>
                </div>
                <a
                  href={`${EARMARK_CHAIN.explorerBase}/address/${p.address}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2"
                >
                  <ExternalLink className="size-3.5" style={{ color: 'var(--subtle)' }} />
                </a>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payments */}
      <section className="p-4" style={glass.card}>
        <div className="mb-3 flex items-center gap-2">
          <Receipt className="size-4" style={{ color: 'var(--muted)' }} />
          <h2 className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--muted)' }}>
            Payments
          </h2>
        </div>
        {paymentsLoading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : !payments || payments.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No payments yet.</p>
        ) : (
          <div className="space-y-2">
            {payments.map((payment, i) => {
              const payeeLabel = payees?.find((p) => p.address.toLowerCase() === payment.payee.toLowerCase())?.label
              return (
                <div
                  key={i}
                  className="cursor-pointer rounded-xl p-3 transition-all hover:scale-[1.005]"
                  style={glass.inner}
                  onClick={() => onReceipt(potId, i)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                        {payeeLabel ?? shortAddr(payment.payee)}
                      </p>
                      {payment.memo && (
                        <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--muted)' }}>{payment.memo}</p>
                      )}
                      <p className="mt-0.5 text-xs" style={{ color: 'var(--subtle)' }}>{formatDate(payment.timestamp)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="display text-sm font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {formatUsdc(payment.amount)} USDC
                      </span>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ background: 'rgba(26,128,71,0.10)', color: 'var(--success)' }}
                      >
                        Receipt #{i + 1}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <p className="mt-8 text-center text-xs" style={{ color: 'var(--subtle)' }}>
        Experimental. Not audited. Use small amounts.
      </p>
    </div>
  )
}
