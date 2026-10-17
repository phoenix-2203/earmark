import { formatUsdc, daysUntil, isExpired } from '@/utils/format'
import type { Pot } from '@/earmarkTypes'

interface Props {
  pot: Pot
}

export default function PotProgress({ pot }: Props) {
  const funded = pot.totalFunded
  const spent = pot.totalSpent
  const balance = pot.balance

  const pct = funded > 0n ? Number((spent * 100n) / funded) : 0
  const days = daysUntil(pot.expiry)
  const expired = isExpired(pot.expiry)

  return (
    <div className="space-y-1.5">
      {/* bar */}
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-muted)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: pct >= 90 ? 'var(--danger)' : 'var(--success)',
          }}
        />
      </div>

      {/* labels */}
      <div className="flex justify-between text-xs tabular-nums" style={{ color: 'var(--muted)' }}>
        <span>
          <span style={{ color: 'var(--ink)' }}>
            {formatUsdc(spent)} USDC
          </span>{' '}
          spent
        </span>
        <span>
          <span style={{ color: 'var(--ink)' }}>
            {formatUsdc(balance)} USDC
          </span>{' '}
          left
        </span>
      </div>

      {/* expiry */}
      {pot.closed ? (
        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
          Closed
        </span>
      ) : expired ? (
        <span className="inline-block rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)' }}>
          Expired — reclaim available
        </span>
      ) : (
        <span className="inline-block text-xs" style={{ color: 'var(--muted)' }}>
          {days} day{days !== 1 ? 's' : ''} remaining
        </span>
      )}
    </div>
  )
}
