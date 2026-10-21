/**
 * PaymentReceipt row — shows amount, payee, date, memo,
 * "View receipt" link (always href, never callback-only), and
 * "View transaction" explorer link (shown when txHash is available).
 *
 * Both links are always visible so users can bookmark either one.
 * onReceipt is kept for in-app navigation (prevents full page reload).
 */
import { ExternalLink, ReceiptText } from 'lucide-react'
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
  const receiptHref = `#/receipt/${potId}/${index}`

  return (
    <div className="rounded-card border border-[var(--line)] bg-[var(--surface-2)] p-4 space-y-2">
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

      {/* Both links on the same row, always present */}
      <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
        {/* Receipt link — href always present; onReceipt intercepts for SPA nav */}
        <a
          href={receiptHref}
          onClick={onReceipt ? (e) => { e.preventDefault(); onReceipt(potId, index) } : undefined}
          className="inline-flex items-center gap-1 text-xs font-medium text-[var(--accent)] hover:text-[var(--accent-hover)] underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          <ReceiptText className="size-3" aria-hidden />
          View receipt
        </a>

        {/* Explorer link — only when txHash is known */}
        {txHash && (
          <a
            href={buildTxExplorerUrl(EARMARK_CHAIN_ID, txHash)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
          >
            View transaction <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  )
}
