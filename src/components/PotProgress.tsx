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
      <div className="h-2 overflow-hidden rounded-full" style={{ background: 'var(--surface-2)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(pct, 100)}%`,
            background: pct >= 90 ? 'var(--danger)' : 'var(--success)',
          }}
        />
      </div>

      {/* labels */}
      <div className="flex justify-between text-xs tabular-nums text-[var(--muted)]">
        <span>
          <span className="font-mono font-medium text-[var(--ink)]">{formatUsdc(spent)}</span> USDC spent
        </span>
        <span>
          <span className="font-mono font-medium text-[var(--accent)]">{formatUsdc(balance)}</span> USDC left
        </span>
      </div>

      {/* expiry */}
      {pot.closed ? (
        <span className="inline-block rounded-pill px-2 py-0.5 text-xs font-medium bg-[var(--surface-2)] text-[var(--muted)]">
          Closed
        </span>
      ) : expired ? (
        <span className="inline-block rounded-pill px-2 py-0.5 text-xs font-medium bg-[#FFF4E0] text-[var(--warning)]">
          Ended — reclaim available
        </span>
      ) : (
        <span className="inline-block text-xs text-[var(--muted)]">
          {days} day{days !== 1 ? 's' : ''} remaining
        </span>
      )}
    </div>
  )
}
