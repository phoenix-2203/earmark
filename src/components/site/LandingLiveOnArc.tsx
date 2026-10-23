/**
 * Section 6 — Live on Arc.
 * Real data: potCount() from contract + 5 most recent Paid events. No wallet.
 *
 * Key fixes vs previous version:
 * - Uses Paid/PotCreated event definitions extracted from EARMARK_ABI (not hand-written)
 * - potCount read from potCount() view function, not counted from logs
 * - timestamp read from getPayments(potId)[paymentIndex].timestamp (Paid event has no timestamp)
 * - payee label read from getPayees(potId) when available
 * - Every stat shows "—" while loading or on RPC error
 */
import { useState, useEffect, useCallback } from 'react'
import { decodeEventLog } from 'viem'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { publicClient, EARMARK_ADDRESS, EARMARK_ABI, EARMARK_FROM_BLOCK, EARMARK_CHAIN } from '@/earmarkConfig'
import { formatUsdc } from '@/onchain-money'

const CHUNK = 9000n
const MAX_PAYMENTS = 5

// Extract the Paid event ABI entry from EARMARK_ABI so we never
// hand-write a signature that can drift out of sync with the contract.
const PAID_ABI_EVENT = EARMARK_ABI.find(
  (e): e is typeof e & { type: 'event'; name: 'Paid' } =>
    e.type === 'event' && e.name === 'Paid'
)!

interface RecentPayment {
  potId: bigint
  paymentIndex: number
  payee: `0x${string}`
  payeeLabel: string | null
  amount: bigint
  timestamp: bigint | null   // from getPayments; null if RPC call failed
  txHash: `0x${string}`
}

export default function LandingLiveOnArc() {
  const [potCount, setPotCount] = useState<bigint | null>(null)
  const [payments, setPayments] = useState<RecentPayment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // 1. Read potCount() from the contract — authoritative, never under-counts
      const rawCount = await publicClient.readContract({
        address: EARMARK_ADDRESS,
        abi: EARMARK_ABI,
        functionName: 'potCount',
      })
      setPotCount(rawCount)

      // 2. Scan for Paid events newest-first, stop after MAX_PAYMENTS
      const head = await publicClient.getBlockNumber()
      const startBlock = EARMARK_FROM_BLOCK > 0n ? EARMARK_FROM_BLOCK : 0n
      const rawResults: Array<{
        potId: bigint
        paymentIndex: bigint
        payee: `0x${string}`
        amount: bigint
        txHash: `0x${string}`
      }> = []

      let from = head
      while (from > startBlock && rawResults.length < MAX_PAYMENTS) {
        const to = from
        const chunkFrom = from > CHUNK ? from - CHUNK : startBlock
        const paidLogs = await publicClient.getLogs({
          address: EARMARK_ADDRESS,
          // Pass the event ABI entry directly — viem uses it to build the topic filter
          event: PAID_ABI_EVENT,
          fromBlock: chunkFrom,
          toBlock: to,
        })
        const sorted = [...paidLogs].sort(
          (a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n))
        )
        for (const log of sorted) {
          if (rawResults.length >= MAX_PAYMENTS) break
          try {
            const decoded = decodeEventLog({
              abi: EARMARK_ABI,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === 'Paid') {
              const args = decoded.args as unknown as {
                potId: bigint
                paymentIndex: bigint
                payee: `0x${string}`
                amount: bigint
              }
              rawResults.push({
                potId: args.potId,
                paymentIndex: args.paymentIndex,
                payee: args.payee,
                amount: args.amount,
                txHash: log.transactionHash ?? ('0x'),
              })
            }
          } catch { /* skip log if decode fails */ }
        }
        if (from <= CHUNK) break
        from = chunkFrom - 1n
      }

      // 3. For each result, enrich with timestamp (from getPayments) and payee label (from getPayees)
      //    Use Promise.allSettled so a per-pot RPC failure doesn't drop the whole list.
      const enriched = await Promise.allSettled(
        rawResults.map(async (r) => {
          let timestamp: bigint | null = null
          let payeeLabel: string | null = null
          try {
            const [payments, payees] = await Promise.all([
              publicClient.readContract({
                address: EARMARK_ADDRESS,
                abi: EARMARK_ABI,
                functionName: 'getPayments',
                args: [r.potId],
              }) as Promise<Array<{ payee: `0x${string}`; amount: bigint; memo: string; timestamp: bigint; payer: `0x${string}` }>>,
              publicClient.readContract({
                address: EARMARK_ADDRESS,
                abi: EARMARK_ABI,
                functionName: 'getPayees',
                args: [r.potId],
              }) as Promise<[`0x${string}`[], string[]]>,
            ])
            const paymentRecord = payments[Number(r.paymentIndex)]
            if (paymentRecord) timestamp = paymentRecord.timestamp
            const payeeIdx = payees[0].findIndex(
              (a) => a.toLowerCase() === r.payee.toLowerCase()
            )
            if (payeeIdx !== -1 && payees[1][payeeIdx]) {
              payeeLabel = payees[1][payeeIdx]
            }
          } catch { /* leave timestamp/label null */ }
          return {
            potId: r.potId,
            paymentIndex: Number(r.paymentIndex),
            payee: r.payee,
            payeeLabel,
            amount: r.amount,
            timestamp,
            txHash: r.txHash,
          } satisfies RecentPayment
        })
      )

      setPayments(
        enriched
          .filter((r): r is PromiseFulfilledResult<RecentPayment> => r.status === 'fulfilled')
          .map((r) => r.value)
      )
    } catch {
      setError("Couldn't reach Arc right now.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(id)
  }, [load])

  const explorerUrl = `${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`

  return (
    <section id="live" className="py-16 md:py-20 scroll-mt-16" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[1040px] px-4">
        <p className="mb-2 text-center text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Live on Arc
        </p>
        <h2
          className="display mb-4 text-center text-2xl font-semibold text-[var(--ink)] text-balance"
          style={{ letterSpacing: '-0.02em' }}
        >
          Real data, straight from the chain.
        </h2>
        <p className="mb-8 text-center text-sm text-[var(--ink-2)]">
          Every number below is read from {EARMARK_CHAIN.name} — no database, no backend.
        </p>

        {/* Stats bar — show "—" until data loads or on error */}
        <div className="mb-6 flex flex-wrap justify-center gap-6">
          <StatChip
            label="Pots created"
            value={loading || error ? '—' : (potCount ?? 0n).toString()}
          />
          <StatChip label="Network" value={EARMARK_CHAIN.name} />
          <StatChip
            label="Contract"
            value={`${EARMARK_ADDRESS.slice(0, 6)}…${EARMARK_ADDRESS.slice(-4)}`}
            href={explorerUrl}
          />
        </div>

        {/* Recent payments table */}
        <div className="rounded-card border border-[var(--line)] bg-[var(--surface)] shadow-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
            <p className="text-sm font-semibold text-[var(--ink)]">Recent payments</p>
            <button
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh"
              className="rounded p-1 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            </button>
          </div>

          {loading && (
            <div className="divide-y divide-[var(--line)]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-4 animate-pulse">
                  <div className="h-3 w-20 rounded bg-[var(--surface-2)]" />
                  <div className="h-3 w-32 rounded bg-[var(--surface-2)]" />
                  <div className="ml-auto h-3 w-14 rounded bg-[var(--surface-2)]" />
                </div>
              ))}
            </div>
          )}

          {!loading && error && (
            <div className="px-5 py-8 text-center">
              <p className="text-sm text-[var(--ink-2)]">{error}</p>
              <button
                onClick={() => void load()}
                className="mt-3 text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && payments.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[var(--ink-2)]">
              No payments yet on this network.
            </div>
          )}

          {!loading && !error && payments.length > 0 && (
            <div className="divide-y divide-[var(--line)]">
              {payments.map((p, i) => (
                <PaymentRow key={i} payment={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function StatChip({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-card border border-[var(--line)] bg-[var(--surface)] px-5 py-3 shadow-card text-center min-w-[120px]">
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline font-mono focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          {value}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : (
        <span className="text-sm font-semibold text-[var(--ink)] font-mono">{value}</span>
      )}
    </div>
  )
}

function PaymentRow({ payment }: { payment: RecentPayment }) {
  const dateStr = payment.timestamp
    ? new Date(Number(payment.timestamp) * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null

  const receiptHash = `#/receipt/${payment.potId.toString()}/${payment.paymentIndex}`
  const txUrl = `${EARMARK_CHAIN.explorerBase}/tx/${payment.txHash}`

  // Show label if available, else shortened address
  const payeeDisplay = payment.payeeLabel
    ? payment.payeeLabel
    : `${payment.payee.slice(0, 8)}…${payment.payee.slice(-6)}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-[var(--ink-2)]">{payeeDisplay}</span>
        <span className="text-[10px] text-[var(--muted)]">
          Pot #{payment.potId.toString()}
          {dateStr ? ` · ${dateStr}` : ''}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-[var(--ink)]">
          {formatUsdc(payment.amount)} USDC
        </span>
        <a
          href={receiptHash}
          className="text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          Receipt
        </a>
        <a
          href={txUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View transaction on explorer"
          className="text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
    </div>
  )
}
