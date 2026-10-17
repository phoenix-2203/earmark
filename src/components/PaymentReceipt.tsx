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
}

export default function PaymentReceipt({ payment, index, potId, payees, txHash }: Props) {
  const payeeEntry = payees.find((p) => p.address.toLowerCase() === payment.payee.toLowerCase())

  return (
    <div
      className="rounded-2xl p-4 space-y-2"
      style={{ background: 'var(--surface-muted)' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {formatUsdc(payment.amount)} USDC
          </p>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            {payeeEntry?.label ?? shortAddr(payment.payee)}
          </p>
        </div>
        <span className="text-xs tabular-nums shrink-0" style={{ color: 'var(--subtle)' }}>
          {formatDate(payment.timestamp)}
        </span>
      </div>

      {payment.memo && (
        <p className="text-xs italic" style={{ color: 'var(--muted)' }}>
          "{payment.memo}"
        </p>
      )}

      <div className="flex items-center justify-between">
        <a
          href={`/receipt/${potId}/${index}`}
          className="text-xs font-medium hover:underline"
          style={{ color: 'var(--accent-hover)' }}
        >
          View receipt
        </a>
        {txHash && (
          <a
            href={buildTxExplorerUrl(EARMARK_CHAIN_ID, txHash)}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs"
            style={{ color: 'var(--subtle)' }}
          >
            Explorer <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  )
}
