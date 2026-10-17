/**
 * Renders a banner when the wallet is on the wrong chain,
 * with a one-click "Switch network" button.
 */
import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import { EARMARK_CHAIN_ID, EARMARK_CHAIN } from '@/earmarkConfig'

export default function NetworkGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === EARMARK_CHAIN_ID) return null

  return (
    <div
      className="mx-4 mb-4 flex items-center gap-3 rounded-2xl p-4"
      style={{ background: 'rgba(186,43,76,0.08)', border: '1px solid rgba(186,43,76,0.25)' }}
    >
      <AlertTriangle className="size-5 shrink-0" style={{ color: 'var(--danger)' }} />
      <p className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>
        Switch to <strong>{EARMARK_CHAIN.name}</strong> to use Earmark.
      </p>
      <button
        onClick={() => switchChain({ chainId: EARMARK_CHAIN_ID })}
        disabled={isPending}
        className="rounded-xl px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        style={{ background: 'var(--danger)' }}
      >
        {isPending ? 'Switching…' : 'Switch'}
      </button>
    </div>
  )
}
