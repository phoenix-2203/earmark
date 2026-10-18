/**
 * MyPotsPage — compact list of pots I sent.
 * Clicking a row navigates to the role-aware pot detail page.
 * All management actions live on the detail page.
 */
import { useAccount } from 'wagmi'
import { ArrowRight, PiggyBank, Loader2 } from 'lucide-react'
import { usePotsOfSender, useMultiplePots, usePayeeRequests } from '@/hooks/useEarmark'
import CategoryBadge from '@/components/CategoryBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { AddressChip } from '@/components/ui/AddressChip'
import { formatUsdc, isExpired } from '@/utils/format'
import type { Pot } from '@/earmarkTypes'
import type { Status } from '@/components/ui/StatusBadge'

interface Props {
  onViewPot: (potId: bigint) => void
}

function potStatus(pot: Pot): Status {
  if (pot.closed) return 'Closed'
  if (isExpired(pot.expiry)) return 'Ended'
  return 'Open'
}

function PendingBadge({ potId }: { potId: bigint }) {
  const { data: requests } = usePayeeRequests(potId)
  const pending = (requests ?? []).filter((r) => !r.resolved).length
  if (pending === 0) return null
  return (
    <span className="inline-flex items-center justify-center rounded-pill bg-[var(--info)] px-1.5 py-0.5 text-[10px] font-semibold text-white">
      {pending}
    </span>
  )
}

export default function MyPotsPage({ onViewPot }: Props) {
  const { address, isConnected } = useAccount()
  const { data: potIds, isLoading: idsLoading } = usePotsOfSender(address)
  const ids: bigint[] = (potIds as bigint[] | undefined) ?? []
  const { pots, isLoading: potsLoading } = useMultiplePots(ids)
  const loading = idsLoading || potsLoading

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-12 md:pb-16">
        <EmptyState
          icon={<PiggyBank className="size-6" />}
          title="Connect your wallet"
          description="Connect your wallet to see the pots you've sent."
        />
      </main>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="size-6 animate-spin text-[var(--muted)]" aria-label="Loading" />
      </div>
    )
  }

  const validPots = pots.filter(Boolean) as Pot[]

  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
      <h1 className="display mb-6 text-2xl font-semibold text-[var(--ink)]">Pots I sent</h1>

      {validPots.length === 0 ? (
        <EmptyState
          icon={<PiggyBank className="size-6" />}
          title="No pots yet"
          description="Create your first pot to send money home for a purpose."
          action={
            <Button variant="primary" onClick={() => { window.history.pushState(null, '', '#/send'); window.dispatchEvent(new PopStateEvent('popstate')) }}>
              Send money
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {validPots.map((pot, i) => {
            const status = potStatus(pot)
            return (
              <li key={pot.id.toString()}>
                <button
                  onClick={() => onViewPot(ids[i])}
                  className="flex w-full items-center gap-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4 shadow-card hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] text-left"
                >
                  {/* Left: title + meta */}
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--ink)] truncate">{pot.title}</p>
                      <CategoryBadge category={pot.category} />
                      <StatusBadge status={status} />
                      <PendingBadge potId={ids[i]} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span>For</span>
                      <AddressChip address={pot.beneficiary} />
                    </div>
                    {/* Balance bar */}
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: pot.totalFunded > 0n ? `${Math.min(100, Number((pot.totalSpent * 100n) / pot.totalFunded))}%` : '0%',
                            background: 'var(--success)',
                          }}
                        />
                      </div>
                      <span className="font-mono text-xs tabular-nums text-[var(--ink-2)] shrink-0">
                        {formatUsdc(pot.balance)} USDC left
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-[var(--muted)]" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
