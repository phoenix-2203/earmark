/**
 * Section 6 — Live on Arc.
 * Real data: potCount + 5 most recent Paid events. No wallet required.
 * Chunked getLogs scan newest-first, stops after 5 results.
 */
import { useState, useEffect, useCallback } from 'react'
import { createPublicClient, http, decodeEventLog, parseAbiItem } from 'viem'
import { arcTestnet } from 'viem/chains'
import { RefreshCw, ExternalLink } from 'lucide-react'
import { EARMARK_ADDRESS, EARMARK_ABI, EARMARK_FROM_BLOCK, EARMARK_CHAIN } from '@/earmarkConfig'
import { formatUsdc } from '@/onchain-money'

const CHUNK = 9000n
const MAX_PAYMENTS = 5

interface RecentPayment {
  potId: bigint
  payee: `0x${string}`
  amount: bigint
  timestamp: bigint
  txHash: `0x${string}`
  blockNumber: bigint
  paymentIndex: number
}

const PAID_EVENT = parseAbiItem(
  'event Paid(uint256 indexed potId, address indexed payer, address indexed payee, uint256 amount, string memo, uint256 timestamp, uint256 paymentIndex)'
)
const POT_CREATED_EVENT = parseAbiItem(
  'event PotCreated(uint256 indexed potId, address indexed sender, address indexed beneficiary, string title, uint8 category, uint256 amount, uint256 expiry)'
)

function makeClient() {
  const proxyChains = String(import.meta.env.VITE_RPC_PROXY_CHAINS ?? '').split(',')
  const proxyBase = import.meta.env.VITE_RPC_PROXY_BASE_URL as string | undefined
  const proxyToken = import.meta.env.VITE_RPC_PROXY_TOKEN as string | undefined
  const rpcUrl = proxyBase && proxyChains.includes('Arc_Testnet')
    ? `${proxyBase}/api/rpc/Arc_Testnet?_rpc_token=${proxyToken ?? ''}`
    : (EARMARK_CHAIN.rpcUrls[0] ?? 'https://rpc.arc.io')
  return createPublicClient({ chain: arcTestnet, transport: http(rpcUrl) })
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
      const client = makeClient()
      const head = await client.getBlockNumber()

      const results: RecentPayment[] = []
      let potCountSeen = 0n
      let from = head
      const startBlock = EARMARK_FROM_BLOCK > 0n ? EARMARK_FROM_BLOCK : 0n

      while (from > startBlock && results.length < MAX_PAYMENTS) {
        const to = from
        const chunkFrom = from > CHUNK ? from - CHUNK : startBlock
        const [paidLogs, createdLogs] = await Promise.all([
          client.getLogs({
            address: EARMARK_ADDRESS,
            event: PAID_EVENT,
            fromBlock: chunkFrom,
            toBlock: to,
          }),
          client.getLogs({
            address: EARMARK_ADDRESS,
            event: POT_CREATED_EVENT,
            fromBlock: chunkFrom,
            toBlock: to,
          }),
        ])
        potCountSeen += BigInt(createdLogs.length)
        const sorted = [...paidLogs].sort((a, b) => Number((b.blockNumber ?? 0n) - (a.blockNumber ?? 0n)))
        for (const log of sorted) {
          if (results.length >= MAX_PAYMENTS) break
          try {
            const decoded = decodeEventLog({ abi: EARMARK_ABI, data: log.data, topics: log.topics })
            if (decoded.eventName === 'Paid') {
              const args = decoded.args as unknown as { potId: bigint; payee: `0x${string}`; amount: bigint; memo: string; timestamp: bigint; paymentIndex: bigint }
              results.push({
                potId: args.potId,
                payee: args.payee,
                amount: args.amount,
                timestamp: args.timestamp,
                txHash: (log.transactionHash ?? '0x'),
                blockNumber: log.blockNumber ?? 0n,
                paymentIndex: Number(args.paymentIndex),
              })
            }
          } catch { /* skip undecoded */ }
        }
        if (from <= CHUNK) break
        from = chunkFrom - 1n
      }

      setPotCount(potCountSeen)
      setPayments(results)
    } catch {
      setError("Couldn't reach Arc right now.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Defer so setLoading(true) doesn't fire synchronously inside the effect
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
          Every number below is read from Arc Testnet — no database, no backend.
        </p>

        {/* Stats bar */}
        <div className="mb-6 flex flex-wrap justify-center gap-6">
          <StatChip label="Pots created" value={loading || error ? '—' : (potCount ?? 0n).toString()} />
          <StatChip label="Network" value={EARMARK_CHAIN.name} />
          <StatChip
            label="Contract"
            value={`${EARMARK_ADDRESS.slice(0, 6)}…${EARMARK_ADDRESS.slice(-4)}`}
            href={explorerUrl}
          />
        </div>

        {/* Recent payments */}
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

          {error && (
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
      <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--muted)]">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-semibold text-[var(--accent)] hover:underline font-mono focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded">
          {value}<ExternalLink className="size-3" aria-hidden />
        </a>
      ) : (
        <span className="text-sm font-semibold text-[var(--ink)] font-mono">{value}</span>
      )}
    </div>
  )
}

function PaymentRow({ payment }: { payment: RecentPayment }) {
  const date = new Date(Number(payment.timestamp) * 1000)
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  const receiptHash = `#/receipt/${payment.potId}/${payment.paymentIndex}`
  const txUrl = `${EARMARK_CHAIN.explorerBase}/tx/${payment.txHash}`

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-xs text-[var(--ink-2)]">
          {payment.payee.slice(0, 8)}…{payment.payee.slice(-6)}
        </span>
        <span className="text-[10px] text-[var(--muted)]">Pot #{payment.potId.toString()} · {dateStr}</span>
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
