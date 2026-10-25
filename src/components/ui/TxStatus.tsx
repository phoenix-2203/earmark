import { Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { EARMARK_CHAIN_ID } from '@/earmarkConfig'
import type { ActionState } from '@/hooks/useContractAction'

interface TxStatusProps {
  state: ActionState
  txHash?: `0x${string}`
  errorMessage?: string
  /** Short technical detail shown under the friendly error message (≤160 chars). */
  errorDetail?: string
  className?: string
}

const STATE_LABELS: Partial<Record<ActionState, string>> = {
  checking:          'Checking details…',
  awaitingSignature: 'Confirm in your wallet…',
  submitted:         'Waiting for Arc…',
  confirmed:         'Confirmed',
  failed:            'Failed',
}

export function TxStatus({ state, txHash, errorMessage, errorDetail, className = '' }: TxStatusProps) {
  if (state === 'idle') return null

  const label = STATE_LABELS[state] ?? state
  const explorerUrl = txHash ? buildTxExplorerUrl(EARMARK_CHAIN_ID, txHash) : undefined

  return (
    <div className={`flex items-start gap-2 rounded-input bg-[var(--surface-2)] px-3 py-2.5 text-sm ${className}`}>
      {(state === 'checking' || state === 'awaitingSignature' || state === 'submitted') && (
        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-[var(--accent)]" aria-hidden />
      )}
      {state === 'confirmed' && (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[var(--success)]" aria-hidden />
      )}
      {state === 'failed' && (
        <XCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      )}

      <div className="flex-1 min-w-0">
        <span
          className={
            state === 'confirmed' ? 'font-medium text-[var(--success)]' :
            state === 'failed'    ? 'font-medium text-danger' :
            'text-[var(--ink-2)]'
          }
        >
          {state === 'failed' && errorMessage ? errorMessage : label}
        </span>

        {state === 'failed' && errorDetail && (
          <p className="mt-0.5 text-xs text-[var(--muted)]">Details: {errorDetail}</p>
        )}

        {explorerUrl && (
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 inline-flex items-center gap-0.5 text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
          >
            View on explorer
            <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  )
}
