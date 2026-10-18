/**
 * ForMePage — compact list of pots for me (beneficiary).
 * All actions live on the pot detail page.
 */
import { ArrowRight, Inbox, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { usePotsOfBeneficiary, useMultiplePots } from '@/hooks/useEarmark'
import CategoryBadge from '@/components/CategoryBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { AddressChip } from '@/components/ui/AddressChip'
import { formatUsdc, isExpired } from '@/utils/format'
import type { Pot } from '@/earmarkTypes'
import type { Status } from '@/components/ui/StatusBadge'

function potStatus(pot: Pot): Status {
  if (pot.closed) return 'Closed'
  if (isExpired(pot.expiry)) return 'Ended'
  return 'Open'
}

interface Props {
  onViewPot: (potId: bigint) => void
}

export default function ForMePage({ onViewPot }: Props) {
  const { address, isConnected } = useAccount()
  const { data: potIds, isLoading: idsLoading } = usePotsOfBeneficiary(address)
  const ids: bigint[] = (potIds as bigint[] | undefined) ?? []
  const { pots, isLoading: potsLoading } = useMultiplePots(ids)
  const loading = idsLoading || potsLoading

  if (!isConnected) {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-12 md:pb-16">
        <EmptyState
          icon={<Inbox className="size-6" />}
          title="Connect your wallet"
          description="Connect your wallet to see pots created for you."
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
      <h1 className="display mb-6 text-2xl font-semibold text-[var(--ink)]">Pots for me</h1>

      {validPots.length === 0 ? (
        <EmptyState
          icon={<Inbox className="size-6" />}
          title="No pots for this wallet"
          description="Share your address with the sender so they can create a pot for you."
          action={address ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-[var(--ink-2)]">Your address:</span>
              <AddressChip address={address} />
            </div>
          ) : undefined}
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
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-[var(--ink)] truncate">{pot.title}</p>
                      <CategoryBadge category={pot.category} />
                      <StatusBadge status={status} />
                    </div>
                    <div className="flex items-center gap-2 text-xs text-[var(--muted)]">
                      <span>From</span>
                      <AddressChip address={pot.sender} />
                    </div>
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
