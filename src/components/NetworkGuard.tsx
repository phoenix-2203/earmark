/**
 * Renders a banner when the wallet is on the wrong chain,
 * with a one-click "Switch to Arc" button.
 */
import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import { EARMARK_CHAIN_ID, EARMARK_CHAIN } from '@/earmarkConfig'
import { Button } from '@/components/ui/Button'

export default function NetworkGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()

  if (!isConnected || chainId === EARMARK_CHAIN_ID) return null

  return (
    <div
      role="alert"
      className="mx-4 mb-4 flex items-center gap-3 rounded-card p-4 border"
      style={{ background: '#FDECEC', borderColor: '#F5C6C3' }}
    >
      <AlertTriangle className="size-5 shrink-0 text-danger" aria-hidden />
      <p className="flex-1 text-sm text-[var(--ink)]">
        Switch to <strong>{EARMARK_CHAIN.name}</strong> to use Earmark.
      </p>
      <Button
        variant="danger"
        size="sm"
        loading={isPending}
        loadingLabel="Switching…"
        onClick={() => switchChain({ chainId: EARMARK_CHAIN_ID })}
      >
        Switch to Arc
      </Button>
    </div>
  )
}
