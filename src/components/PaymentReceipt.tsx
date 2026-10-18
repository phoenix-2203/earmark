import { ExternalLink } from 'lucide-react'
import { formatUsdc, shortAddr, formatDate } from '@/utils/format'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { EARMARK_CHAIN_ID } from '@/earmarkConfig'
import type { Payment, PayeeEntry } from '@/earmarkTypes'

interface Props {
  payment: Payment
  index: number
  potId: bigint
  payees: PayeeEntry[]
  txHash?: string
  onReceipt?: (potId: bigint, index: number) => void
}

export default function PaymentReceipt({ payment, index, potId, payees, txHash, onReceipt }: Props) {
  const payeeEntry = payees.find((p) => p.address.toLowerCase() === payment.payee.toLowerCase())

  return (
    <div
      className="rounded-card border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">
            {formatUsdc(payment.amount)} USDC
          </p>
          <p className="text-xs text-[var(--muted)]">
            {payeeEntry?.label ?? shortAddr(payment.payee)}
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums shrink-0 text-[var(--muted)]">
          {formatDate(payment.timestamp)}
        </span>
      </div>

      {payment.memo && (
        <p className="text-xs italic text-[var(--muted)]">
          "{payment.memo}"
        </p>
      )}

      <div className="flex items-center justify-between">
        {onReceipt ? (
          <button
            onClick={() => onReceipt(potId, index)}
            className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
          >
            View receipt
          </button>
        ) : (
          <a
            href={`#/receipt/${potId}/${index}`}
            className="text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
          >
            View receipt
          </a>
        )}
        {txHash && (
          <a
            href={buildTxExplorerUrl(EARMARK_CHAIN_ID, txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--ink)]"
          >
            Explorer <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  )
}
