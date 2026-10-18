/**
 * PotPage — role-aware pot detail page.
 *
 * - No wallet needed for public view
 * - Sender panel: top up, add payee, remove payee, approve/reject requests, extend, release, reclaim
 * - Beneficiary panel: pay, request payee, view own requests
 * - All writes use useContractAction (no side effects in render)
 * - Confirm dialogs before destructive/irreversible actions
 * - Distinguishes "loading", "not found" (id === 0), "network error"
 */

import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import {
  simulateContract, writeContract, waitForTransactionReceipt, readContract,
} from '@wagmi/core'
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'
import {
  ArrowLeft, Share2, Check, ExternalLink, UserPlus, X, CalendarClock,
  Gift, Undo2, Send, ReceiptText, Loader2, RefreshCw, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/config'
import {
  EARMARK_ADDRESS, EARMARK_ABI, EARMARK_CHAIN_ID, EARMARK_CHAIN,
  USDC_ADDRESS,
} from '@/earmarkConfig'
import { usePot, usePayees, usePayments, usePayeeRequests } from '@/hooks/useEarmark'
import { usePotCreatedTxHash, usePaidEventTxHash } from '@/hooks/useEventTxHash'
import CategoryBadge from '@/components/CategoryBadge'
import PotProgress from '@/components/PotProgress'
import PaymentReceipt from '@/components/PaymentReceipt'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AddressChip } from '@/components/ui/AddressChip'
import { AddressInput } from '@/components/ui/AddressInput'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/Field'
import { Dialog } from '@/components/ui/Dialog'
import { TxStatus } from '@/components/ui/TxStatus'
import {
  formatUsdc, parseUsdc, shortAddr, formatDate, isExpired,
  localDateToExpiry, formatExpiry, isValidUsdcAmount,
} from '@/utils/format'
import type { Pot, PayeeEntry } from '@/earmarkTypes'
import { friendlyErrorName } from '@/earmarkTypes'
import type { Status } from '@/components/ui/StatusBadge'

interface Props {
  potId: bigint
  onBack: () => void
  onReceipt: (potId: bigint, index: number) => void
}

function potStatus(pot: Pot): Status {
  if (pot.closed) return 'Closed'
  if (isExpired(pot.expiry)) return 'Ended'
  return 'Open'
}


function extractErr(err: unknown): string {
  if (err instanceof UserRejectedRequestError) return 'You cancelled in your wallet. Nothing was sent.'
  if (err instanceof BaseError) {
    const rej = err.walk((e) => e instanceof UserRejectedRequestError)
    if (rej) return 'You cancelled in your wallet. Nothing was sent.'
    const rev = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (rev instanceof ContractFunctionRevertedError) {
      const name = rev.data?.errorName
      return name ? friendlyErrorName(name) : rev.shortMessage ?? 'Transaction reverted.'
    }
    return err.shortMessage ?? err.message
  }
  const s = String(err).toLowerCase()
  if (s.includes('user rejected') || s.includes('4001')) return 'You cancelled in your wallet. Nothing was sent.'
  return 'Something went wrong. Please try again.'
}

interface SimpleCall {
  address: `0x${string}`
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  chainId?: number
}

// ── Simple single-action hook ─────────────────────────────────────────────────
function useSimpleAction() {
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [done, setDone] = useState(false)

  function reset() { setLoading(false); setTxHash(undefined); setError(undefined); setDone(false) }

  async function run(call: SimpleCall, onSuccess?: () => void) {
    setLoading(true); setError(undefined); setDone(false)
    try {
      // @ts-expect-error – SimpleCall is valid at runtime; gas-param generics don't match statically
      await simulateContract(config, call)
      // @ts-expect-error – SimpleCall is valid at runtime; gas-param generics don't match statically
      const hash = await writeContract(config, call)
      setTxHash(hash)
      await waitForTransactionReceipt(config, { hash, chainId: EARMARK_CHAIN_ID })
      setDone(true)
      if (onSuccess) onSuccess()
    } catch (err) {
      setError(extractErr(err))
    } finally {
      setLoading(false)
    }
  }

  return { loading, txHash, error, done, run, reset }
}

// ── PotCreated tx hash for "Created in transaction…" ─────────────────────────
function CreatedTxLink({ potId }: { potId: bigint }) {
  const { txHash } = usePotCreatedTxHash(potId)
  if (!txHash) return null
  return (
    <a
      href={`${EARMARK_CHAIN.explorerBase}/tx/${txHash}`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs text-[var(--muted)] hover:text-[var(--ink)] underline"
    >
      Created in transaction {shortAddr(txHash)}
      <ExternalLink className="size-3" aria-hidden />
    </a>
  )
}

// ── Paid event tx hash per payment ────────────────────────────────────────────
function PaidReceiptRow({ potId, index, payment, payees, onReceipt }: {
  potId: bigint; index: number; payment: { payee: `0x${string}`; amount: bigint; memo: string; timestamp: bigint; payer: `0x${string}` }; payees: PayeeEntry[]; onReceipt: (potId: bigint, i: number) => void
}) {
  const { txHash } = usePaidEventTxHash(potId, index)
  return (
    <PaymentReceipt
      payment={payment}
      index={index}
      potId={potId}
      payees={payees}
      txHash={txHash ?? undefined}
      onReceipt={onReceipt}
    />
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function PotPage({ potId, onBack, onReceipt }: Props) {
  const { address: connectedAddress } = useAccount()
  const { data: potRaw, isLoading: potLoading, error: potError, refetch: refetchPot } = usePot(potId)
  const { data: payees, isLoading: payeesLoading, refetch: refetchPayees } = usePayees(potId)
  const { data: payments, isLoading: paymentsLoading, refetch: refetchPayments } = usePayments(potId)
  const { data: requests, isLoading: _requestsLoading, refetch: refetchRequests } = usePayeeRequests(potId)
  const [copied, setCopied] = useState(false)

  const pot = potRaw

  // Role detection
  const isSender = pot && connectedAddress
    ? pot.sender.toLowerCase() === connectedAddress.toLowerCase()
    : false
  const isBeneficiary = pot && connectedAddress
    ? pot.beneficiary.toLowerCase() === connectedAddress.toLowerCase()
    : false

  const expired = pot ? isExpired(pot.expiry) : false
  const status = pot ? potStatus(pot) : 'Open'

  function handleShare() {
    const url = `${window.location.origin}/#/pot/${potId}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // ── Loading ──
  if (potLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-[var(--muted)]" aria-label="Loading pot" />
      </div>
    )
  }

  // ── Network error ──
  if (potError && !pot) {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-12 text-center">
        <AlertTriangle className="mx-auto mb-3 size-8 text-[var(--warning)]" />
        <p className="text-sm font-semibold text-[var(--ink)]">Couldn't reach the Arc network</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Your connection may be offline. Try again in a moment.</p>
        <Button variant="secondary" className="mt-4" onClick={() => void refetchPot()}>
          <RefreshCw className="size-4" aria-hidden /> Retry
        </Button>
      </main>
    )
  }

  // ── Not found ──
  if (!pot || pot.id === 0n) {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-12 text-center">
        <p className="text-sm font-semibold text-[var(--ink)]">This pot doesn't exist.</p>
        <p className="mt-1 text-xs text-[var(--muted)]">Check the pot number and try again.</p>
        <Button variant="secondary" className="mt-4" onClick={onBack}>
          <ArrowLeft className="size-4" aria-hidden /> Go back
        </Button>
      </main>
    )
  }

  const pendingRequests = (requests ?? []).filter((r) => !r.resolved)

  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
      {/* ── Header bar ── */}
      <div className="mb-5 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          <ArrowLeft className="size-4" aria-hidden /> Back
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          {copied ? <Check className="size-4 text-[var(--success)]" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
          {copied ? 'Copied!' : 'Share this pot'}
        </button>
      </div>

      {/* ── Hero card ── */}
      <Card padding="lg" className="mb-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div>
            <h1 className="display text-xl font-semibold text-[var(--ink)]">{pot.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <CategoryBadge category={pot.category} />
              <StatusBadge status={status} />
            </div>
          </div>
        </div>
        <PotProgress pot={pot} />
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">{formatUsdc(pot.totalFunded)}</p>
            <p className="text-xs text-[var(--muted)]">Funded</p>
          </div>
          <div>
            <p className="font-mono text-sm font-semibold tabular-nums text-[var(--ink)]">{formatUsdc(pot.totalSpent)}</p>
            <p className="text-xs text-[var(--muted)]">Spent</p>
          </div>
          <div>
            <p className="font-mono text-sm font-semibold tabular-nums text-[var(--accent)]">{formatUsdc(pot.balance)}</p>
            <p className="text-xs text-[var(--muted)]">Left</p>
          </div>
        </div>
      </Card>

      {/* ── Participants ── */}
      <Card padding="md" className="mb-4 space-y-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">People</h2>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Sender</span>
          <AddressChip address={pot.sender} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Family member</span>
          <AddressChip address={pot.beneficiary} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">End date</span>
          <span className="text-xs text-[var(--ink-2)]">{formatExpiry(pot.expiry)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Contract</span>
          <a
            href={`${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-[var(--muted)] hover:text-[var(--ink)]"
          >
            {shortAddr(EARMARK_ADDRESS)} <ExternalLink className="size-3" aria-hidden />
          </a>
        </div>
        <CreatedTxLink potId={potId} />
      </Card>

      {/* ── Sender management panel ── */}
      {isSender && (
        <SenderPanel
          pot={pot}
          potId={potId}
          payees={payees ?? []}
          requests={requests ?? []}
          pendingCount={pendingRequests.length}
          onRefetchPayees={() => void refetchPayees()}
          onRefetchPot={() => void refetchPot()}
          onRefetchRequests={() => void refetchRequests()}
          expired={expired}
        />
      )}

      {/* ── Beneficiary panel ── */}
      {isBeneficiary && (
        <BeneficiaryPanel
          pot={pot}
          potId={potId}
          payees={payees ?? []}
          requests={requests ?? []}
          onRefetchPayments={refetchPayments}
          onRefetchRequests={refetchRequests}
          expired={expired}
        />
      )}

      {/* ── Approved payees (public) ── */}
      <section className="mb-4" aria-labelledby="payees-heading">
        <Card padding="md" className="space-y-3">
          <h2 id="payees-heading" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            <UserPlus className="size-4" aria-hidden /> Approved payees
          </h2>
          {payeesLoading ? (
            <p className="text-xs text-[var(--muted)]">Loading…</p>
          ) : !payees || payees.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No approved payees yet.</p>
          ) : (
            <ul className="space-y-2">
              {payees.map((p) => (
                <li key={p.address} className="flex items-center justify-between rounded-input bg-[var(--surface-2)] px-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink)]">{p.label}</p>
                    <AddressChip address={p.address} />
                  </div>
                  <a
                    href={`${EARMARK_CHAIN.explorerBase}/address/${p.address}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`View ${p.label} on explorer`}
                    className="ml-2 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>

      {/* ── Payments (public) ── */}
      <section aria-labelledby="payments-heading">
        <Card padding="md" className="space-y-3">
          <h2 id="payments-heading" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
            <ReceiptText className="size-4" aria-hidden /> Payments
          </h2>
          {paymentsLoading ? (
            <p className="text-xs text-[var(--muted)]">Loading…</p>
          ) : !payments || payments.length === 0 ? (
            <p className="text-xs text-[var(--muted)]">No payments yet.</p>
          ) : (
            <ul className="space-y-2">
              {payments.map((pmt, i) => (
                <li key={i}>
                  <PaidReceiptRow
                    potId={potId}
                    index={i}
                    payment={pmt}
                    payees={payees ?? []}
                    onReceipt={onReceipt}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </main>
  )
}

// ── Sender management panel ───────────────────────────────────────────────────
function SenderPanel({ pot, potId, payees, requests, pendingCount, onRefetchPayees, onRefetchPot, onRefetchRequests, expired }: {
  pot: Pot; potId: bigint; payees: PayeeEntry[];
  requests: { payee: `0x${string}`; label: string; reason: string; resolved: boolean; approved: boolean }[]
  pendingCount: number;
  onRefetchPayees: () => void; onRefetchPot: () => void; onRefetchRequests: () => void;
  expired: boolean;
}) {
  const [showTopUp, setShowTopUp] = useState(false)
  const [showAddPayee, setShowAddPayee] = useState(false)
  const [showExtend, setShowExtend] = useState(false)
  const [releaseDialog, setReleaseDialog] = useState(false)
  const [reclaimDialog, setReclaimDialog] = useState(false)

  return (
    <Card padding="md" className="mb-4 space-y-4 border-[var(--accent-soft)] bg-[var(--accent-soft)]">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Sender actions</h2>

      {pot.closed && (
        <p className="text-xs text-[var(--muted)]">This pot is closed. No more actions available.</p>
      )}

      {!pot.closed && (
        <>
          {/* Pending requests badge */}
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-input bg-[#E6F0FF] px-3 py-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--info)] text-[10px] font-semibold text-white">{pendingCount}</span>
              <span className="text-xs font-medium text-[var(--info)]">
                {pendingCount} payee request{pendingCount > 1 ? 's' : ''} waiting for your review
              </span>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowTopUp((v) => !v)}>
              Top up
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowAddPayee((v) => !v)}>
              <UserPlus className="size-3.5" aria-hidden /> Add payee
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setShowExtend((v) => !v)}>
              <CalendarClock className="size-3.5" aria-hidden /> Extend end date
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setReleaseDialog(true)}>
              <Gift className="size-3.5" aria-hidden /> Give the rest to family
            </Button>
            {expired && (
              <Button variant="danger" size="sm" onClick={() => setReclaimDialog(true)}>
                <Undo2 className="size-3.5" aria-hidden /> Take back unspent money
              </Button>
            )}
            {!expired && (
              <p className="w-full text-xs text-[var(--muted)]">
                "Take back unspent money" becomes available after the end date ({formatDate(pot.expiry)}).
              </p>
            )}
          </div>

          {showTopUp && <TopUpForm potId={potId} onDone={() => { setShowTopUp(false); onRefetchPot() }} />}
          {showAddPayee && <AddPayeeForm potId={potId} pot={pot} payees={payees} onDone={() => { setShowAddPayee(false); onRefetchPayees() }} />}
          {showExtend && <ExtendForm potId={potId} currentExpiry={pot.expiry} onDone={() => { setShowExtend(false); onRefetchPot() }} />}

          {/* Pending payee requests */}
          {requests.filter((r) => !r.resolved).length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--ink)]">Payee requests to review</p>
              {requests.map((req, i) =>
                !req.resolved ? (
                  <PayeeRequestCard
                    key={i}
                    potId={potId}
                    req={req}
                    requestId={BigInt(i)}
                    onResolved={() => { onRefetchRequests(); onRefetchPayees() }}
                  />
                ) : null
              )}
            </div>
          )}

          {/* Remove payees */}
          {payees.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[var(--ink-2)]">Remove a payee</p>
              <ul className="space-y-1.5">
                {payees.map((p) => (
                  <RemovePayeeRow key={p.address} potId={potId} payee={p} onRemoved={onRefetchPayees} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Release dialog */}
      <Dialog open={releaseDialog} onClose={() => setReleaseDialog(false)} title="Give the rest to family">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-2)]">
            <strong className="font-mono tabular-nums">{formatUsdc(pot.balance)} USDC</strong> goes to your family member with no restrictions.
            The pot closes. <strong>This can't be undone.</strong>
          </p>
          <ReleaseAction potId={potId} onDone={() => { setReleaseDialog(false); onRefetchPot() }} />
        </div>
      </Dialog>

      {/* Reclaim dialog */}
      <Dialog open={reclaimDialog} onClose={() => setReclaimDialog(false)} title="Take back unspent money">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-2)]">
            Reclaim <strong className="font-mono tabular-nums">{formatUsdc(pot.balance)} USDC</strong> to your wallet.
            The pot closes. <strong>This can't be undone.</strong>
          </p>
          <ReclaimAction potId={potId} onDone={() => { setReclaimDialog(false); onRefetchPot() }} />
        </div>
      </Dialog>
    </Card>
  )
}

// ── Beneficiary panel ─────────────────────────────────────────────────────────
function BeneficiaryPanel({ pot, potId, payees, requests, onRefetchPayments, onRefetchRequests, expired }: {
  pot: Pot; potId: bigint; payees: PayeeEntry[];
  requests: { payee: `0x${string}`; label: string; reason: string; resolved: boolean; approved: boolean }[]
  onRefetchPayments: () => void; onRefetchRequests: () => void;
  expired: boolean;
}) {
  const [showPay, setShowPay] = useState(false)
  const [showRequest, setShowRequest] = useState(false)

  const canPay = !pot.closed && !expired && pot.balance > 0n && payees.length > 0

  return (
    <Card padding="md" className="mb-4 space-y-4 border-[#E6F0FF] bg-[#E6F0FF]">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--info)]">Your actions</h2>

      {pot.closed && <p className="text-xs text-[var(--muted)]">This pot is closed.</p>}
      {expired && !pot.closed && <p className="text-xs text-[var(--muted)]">This pot has ended — no more payments.</p>}

      {!pot.closed && (
        <div className="flex flex-wrap gap-2">
          {canPay && (
            <Button variant="primary" size="sm" onClick={() => { setShowPay((v) => !v); setShowRequest(false) }}>
              <Send className="size-3.5" aria-hidden /> Pay an approved payee
            </Button>
          )}
          {!expired && (
            <Button variant="secondary" size="sm" onClick={() => { setShowRequest((v) => !v); setShowPay(false) }}>
              <UserPlus className="size-3.5" aria-hidden /> Ask to add a payee
            </Button>
          )}
          {!canPay && !expired && pot.balance === 0n && (
            <p className="text-xs text-[var(--muted)]">The pot balance is 0 — nothing to pay.</p>
          )}
          {!canPay && !expired && pot.balance > 0n && payees.length === 0 && (
            <p className="text-xs text-[var(--muted)]">No approved payees yet. Ask the sender to add one.</p>
          )}
        </div>
      )}

      {showPay && (
        <PayForm
          potId={potId}
          payees={payees}
          balance={pot.balance}
          pot={pot}
          onDone={() => { setShowPay(false); onRefetchPayments() }}
        />
      )}

      {showRequest && (
        <RequestPayeeForm
          potId={potId}
          pot={pot}
          payees={payees}
          onDone={() => { setShowRequest(false); onRefetchRequests() }}
        />
      )}

      {/* My requests */}
      {requests.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-[var(--ink-2)]">Your payee requests</p>
          <ul className="space-y-2">
            {requests.map((req, i) => {
              const s: Status = req.resolved ? (req.approved ? 'Approved' : 'Rejected') : 'Pending'
              return (
                <li key={i} className="flex items-center justify-between rounded-input bg-[var(--surface)] px-3 py-2.5">
                  <div>
                    <p className="text-xs font-semibold text-[var(--ink)]">{req.label}</p>
                    <AddressChip address={req.payee} />
                  </div>
                  <StatusBadge status={s} />
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </Card>
  )
}

// ── TopUpForm ─────────────────────────────────────────────────────────────────
function TopUpForm({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const { address } = useAccount()
  const [amount, setAmount] = useState('')
  const [phase, setPhase] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [errMsg, setErrMsg] = useState<string | undefined>()

  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: EARMARK_CHAIN_ID,
    query: { enabled: !!address },
  })

  async function handleTopUp() {
    if (!isValidUsdcAmount(amount)) { setErrMsg('Enter a valid amount.'); return }
    const rawAmt = parseUsdc(amount)
    if (usdcBalance !== undefined && usdcBalance < rawAmt) {
      setErrMsg(`Insufficient balance. You have ${formatUsdc(usdcBalance)} USDC.`)
      return
    }
    setPhase('busy'); setErrMsg(undefined); setTxHash(undefined)
    try {
      const allowance = await readContract(config, {
        address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance',
        args: [address!, EARMARK_ADDRESS] as [`0x${string}`, `0x${string}`],
        chainId: EARMARK_CHAIN_ID,
      })
      if (allowance < rawAmt) {
        const approveCall = {
          address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve',
          args: [EARMARK_ADDRESS, rawAmt], chainId: EARMARK_CHAIN_ID,
        }
        // @ts-expect-error – approveCall is valid at runtime; gas-param generics don't match statically
        const ah = await writeContract(config, approveCall)
        await waitForTransactionReceipt(config, { hash: ah, chainId: EARMARK_CHAIN_ID })
      }
      const topUpCall = {
        address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'topUp',
        args: [potId, rawAmt], chainId: EARMARK_CHAIN_ID,
      }
      // @ts-expect-error – topUpCall is valid at runtime; gas-param generics don't match statically
      await simulateContract(config, topUpCall)
      // @ts-expect-error – topUpCall is valid at runtime; gas-param generics don't match statically
      const hash = await writeContract(config, topUpCall)
      setTxHash(hash)
      await waitForTransactionReceipt(config, { hash, chainId: EARMARK_CHAIN_ID })
      setPhase('done')
      toast.success('Pot topped up!')
      onDone()
    } catch (err) {
      setPhase('failed'); setErrMsg(extractErr(err))
    }
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Top up (USDC)</p>
      <AmountInput value={amount} onChange={setAmount} balance={usdcBalance} />
      {errMsg && <p role="alert" className="text-xs text-danger">{errMsg}</p>}
      {txHash && <TxStatus state={phase === 'busy' ? 'submitted' : phase === 'done' ? 'confirmed' : 'failed'} txHash={txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={phase === 'busy'} loadingLabel="Topping up…" onClick={() => void handleTopUp()} className="flex-1">
          Top up
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ── AddPayeeForm ──────────────────────────────────────────────────────────────
function AddPayeeForm({ potId, pot, payees, onDone }: { potId: bigint; pot: Pot; payees: PayeeEntry[]; onDone: () => void }) {
  const [rawAddr, setRawAddr] = useState('')
  const [checksumAddr, setChecksumAddr] = useState<`0x${string}` | null>(null)
  const [label, setLabel] = useState('')
  const [err, setErr] = useState<string | undefined>()
  const { loading, txHash, error, done, run } = useSimpleAction()

  useEffect(() => { if (done) { onDone() } }, [done, onDone])

  async function handleAdd() {
    if (!checksumAddr) { setErr('Enter a valid address.'); return }
    if (!label.trim()) { setErr('Enter a label.'); return }
    if (label.length > 48) { setErr('Label must be 48 characters or fewer.'); return }
    if (checksumAddr.toLowerCase() === pot.sender.toLowerCase()) { setErr('The sender cannot be a payee.'); return }
    if (checksumAddr.toLowerCase() === pot.beneficiary.toLowerCase()) { setErr('The family member cannot be a payee.'); return }
    if (payees.some((p) => p.address.toLowerCase() === checksumAddr.toLowerCase())) { setErr('This address is already an approved payee.'); return }
    setErr(undefined)
    await run({
      address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'addPayee',
      args: [potId, checksumAddr, label], chainId: EARMARK_CHAIN_ID,
    })
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Add an approved payee</p>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Label (e.g. Greenfield School)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={48}
          placeholder="Greenfield School"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Wallet address</label>
        <AddressInput value={rawAddr} onChange={(raw, cs) => { setRawAddr(raw); setChecksumAddr(cs) }} placeholder="0x…" />
      </div>
      {(err || error) && <p role="alert" className="text-xs text-danger">{err ?? error}</p>}
      {txHash && <TxStatus state={loading ? 'submitted' : 'confirmed'} txHash={txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={loading} loadingLabel="Adding…" onClick={() => void handleAdd()} className="flex-1">
          Add payee
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ── RemovePayeeRow ────────────────────────────────────────────────────────────
function RemovePayeeRow({ potId, payee, onRemoved }: { potId: bigint; payee: PayeeEntry; onRemoved: () => void }) {
  const { loading, txHash: _txHash, error: _error, done, run, reset } = useSimpleAction()
  useEffect(() => { if (done) { onRemoved(); reset() } }, [done, onRemoved, reset])

  return (
    <li className="flex items-center justify-between rounded-input bg-[var(--surface)] px-3 py-2">
      <div>
        <p className="text-xs font-semibold text-[var(--ink)]">{payee.label}</p>
        <AddressChip address={payee.address} />
      </div>
      <Button
        variant="danger"
        size="sm"
        loading={loading}
        aria-label={`Remove ${payee.label}`}
        onClick={() => void run({
          address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'removePayee',
          args: [potId, payee.address], chainId: EARMARK_CHAIN_ID,
        }, () => { toast.success('Payee removed'); onRemoved() })}
      >
        <X className="size-3.5" aria-hidden />
      </Button>
    </li>
  )
}

// ── PayeeRequestCard ──────────────────────────────────────────────────────────
function PayeeRequestCard({ potId, req, requestId, onResolved }: {
  potId: bigint;
  req: { payee: `0x${string}`; label: string; reason: string };
  requestId: bigint;
  onResolved: () => void;
}) {
  const approveAction = useSimpleAction()
  const rejectAction = useSimpleAction()
  const [confirmApprove, setConfirmApprove] = useState(false)

  useEffect(() => {
    if (approveAction.done) { onResolved(); approveAction.reset() }
    if (rejectAction.done) { onResolved(); rejectAction.reset() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveAction.done, rejectAction.done])

  const tx = { address: EARMARK_ADDRESS, abi: EARMARK_ABI, chainId: EARMARK_CHAIN_ID } as const
  const busy = approveAction.loading || rejectAction.loading

  return (
    <div className="rounded-card border border-[#DCE8F5] bg-[var(--surface)] p-3 space-y-2">
      <div>
        <p className="text-xs font-semibold text-[var(--ink)]">
          {req.label} <span className="font-normal text-[var(--muted)]">— <AddressChip address={req.payee} /></span>
        </p>
        {req.reason && <p className="text-xs italic text-[var(--muted)]">"{req.reason}"</p>}
      </div>
      {(approveAction.error || rejectAction.error) && (
        <p role="alert" className="text-xs text-danger">{approveAction.error ?? rejectAction.error}</p>
      )}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-[var(--success)] hover:opacity-90"
          loading={approveAction.loading}
          loadingLabel="Approving…"
          disabled={busy}
          onClick={() => setConfirmApprove(true)}
        >
          <Check className="size-3.5" aria-hidden /> Approve payee
        </Button>
        <Button
          variant="danger"
          size="sm"
          className="flex-1"
          loading={rejectAction.loading}
          loadingLabel="Rejecting…"
          disabled={busy}
          onClick={() => void rejectAction.run({ ...tx, functionName: 'rejectPayeeRequest', args: [potId, requestId] }, () => { toast.success('Request rejected'); onResolved() })}
        >
          <X className="size-3.5" aria-hidden /> Reject
        </Button>
      </div>

      <Dialog open={confirmApprove} onClose={() => setConfirmApprove(false)} title="Approve payee">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-2)]">
            Money from this pot can then be sent to <strong>{req.label}</strong> at:
          </p>
          <p className="font-mono text-xs text-[var(--ink)] break-all">{req.payee}</p>
          <p className="text-xs text-[var(--warning)]">
            Warning: Earmark cannot verify who owns this address. Confirm it belongs to the right institution before approving.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-[var(--success)] hover:opacity-90"
              loading={approveAction.loading}
              loadingLabel="Approving…"
              onClick={() => {
                setConfirmApprove(false)
                void approveAction.run({ ...tx, functionName: 'approvePayeeRequest', args: [potId, requestId] }, () => { toast.success('Payee approved'); onResolved() })
              }}
            >
              Approve payee
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmApprove(false)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

// ── ExtendForm ────────────────────────────────────────────────────────────────
function ExtendForm({ potId, currentExpiry, onDone }: { potId: bigint; currentExpiry: bigint; onDone: () => void }) {
  const [newDate, setNewDate] = useState('')
  const [err, setErr] = useState<string | undefined>()
  const { loading, txHash, error, done, run } = useSimpleAction()
  useEffect(() => { if (done) { toast.success('End date extended!'); onDone() } }, [done, onDone])

  const minDate = new Date((Number(currentExpiry) + 86400) * 1000).toISOString().split('T')[0]
  const previewLabel = newDate ? formatExpiry(localDateToExpiry(newDate)) : ''

  async function handleExtend() {
    if (!newDate) { setErr('Select a date.'); return }
    const ts = localDateToExpiry(newDate)
    if (ts <= currentExpiry) { setErr('New date must be later than the current end date.'); return }
    setErr(undefined)
    await run({
      address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'extendExpiry',
      args: [potId, ts], chainId: EARMARK_CHAIN_ID,
    })
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Extend end date</p>
      <Field label="New end date" help={previewLabel || `Must be after ${formatDate(currentExpiry)}`} error={err ?? error}>
        {({ id, ...rest }) => (
          <input
            id={id}
            {...rest}
            type="date"
            value={newDate}
            min={minDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          />
        )}
      </Field>
      {txHash && <TxStatus state={loading ? 'submitted' : 'confirmed'} txHash={txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={loading} loadingLabel="Extending…" onClick={() => void handleExtend()} className="flex-1">
          <CalendarClock className="size-3.5" aria-hidden /> Extend
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ── ReleaseAction ─────────────────────────────────────────────────────────────
function ReleaseAction({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const { loading, txHash, error, done, run } = useSimpleAction()
  useEffect(() => { if (done) { toast.success('Released to family!'); onDone() } }, [done, onDone])
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {txHash && <TxStatus state={loading ? 'submitted' : 'confirmed'} txHash={txHash} />}
      <Button
        size="sm"
        className="w-full bg-[var(--success)] hover:opacity-90"
        loading={loading}
        loadingLabel="Releasing…"
        onClick={() => void run({ address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'releaseToBeneficiary', args: [potId], chainId: EARMARK_CHAIN_ID }, onDone)}
      >
        <Gift className="size-4" aria-hidden /> Give the rest to family
      </Button>
    </div>
  )
}

// ── ReclaimAction ─────────────────────────────────────────────────────────────
function ReclaimAction({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const { loading, txHash, error, done, run } = useSimpleAction()
  useEffect(() => { if (done) { toast.success('Reclaimed!'); onDone() } }, [done, onDone])
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      {txHash && <TxStatus state={loading ? 'submitted' : 'confirmed'} txHash={txHash} />}
      <Button
        variant="danger"
        size="sm"
        className="w-full"
        loading={loading}
        loadingLabel="Reclaiming…"
        onClick={() => void run({ address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'reclaim', args: [potId], chainId: EARMARK_CHAIN_ID }, onDone)}
      >
        <Undo2 className="size-4" aria-hidden /> Take back unspent money
      </Button>
    </div>
  )
}

// ── PayForm ───────────────────────────────────────────────────────────────────
function PayForm({ potId, payees, balance, pot: _pot, onDone }: { potId: bigint; payees: PayeeEntry[]; balance: bigint; pot: Pot; onDone: () => void }) {
  const [selectedPayee, setSelectedPayee] = useState<`0x${string}` | ''>('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [err, setErr] = useState<string | undefined>()
  const { loading, txHash, error, done, run } = useSimpleAction()
  useEffect(() => { if (done) { toast.success('Payment sent!'); onDone() } }, [done, onDone])

  const rawAmount = parseUsdc(amount)
  const overBalance = rawAmount > balance
  const payeeEntry = payees.find((p) => p.address === selectedPayee)
  const afterBalance = balance - rawAmount

  function handleSubmit() {
    if (!selectedPayee) { setErr('Choose a payee.'); return }
    if (!isValidUsdcAmount(amount)) { setErr('Enter a valid amount.'); return }
    if (overBalance) { setErr('Amount exceeds the pot balance.'); return }
    if (memo.length > 140) { setErr('Memo must be 140 characters or fewer.'); return }
    setErr(undefined)
    setConfirmOpen(true)
  }

  function handleConfirm() {
    setConfirmOpen(false)
    void run({
      address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'pay',
      args: [potId, selectedPayee, rawAmount, memo],
      chainId: EARMARK_CHAIN_ID,
    })
  }

  return (
    <div className="space-y-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Make a payment</p>

      {/* Payee radio list */}
      <div>
        <p className="mb-2 text-xs text-[var(--muted)]">Pay to</p>
        <ul className="space-y-2" role="radiogroup" aria-label="Approved payees">
          {payees.map((p) => (
            <li key={p.address}>
              <label className={`flex cursor-pointer items-center gap-3 rounded-input border p-3 transition-colors
                ${selectedPayee === p.address ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--line)] bg-[var(--surface-2)] hover:bg-[var(--surface-2)]'}`}
              >
                <input
                  type="radio"
                  name={`payee-${potId}`}
                  value={p.address}
                  checked={selectedPayee === p.address}
                  onChange={() => setSelectedPayee(p.address)}
                  className="accent-[var(--accent)] size-4"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--ink)]">{p.label}</p>
                  <AddressChip address={p.address} />
                </div>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <AmountInput value={amount} onChange={setAmount} balance={balance} />
      {overBalance && <p className="text-xs text-danger">Amount exceeds pot balance.</p>}

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Memo (optional, max 140 chars)</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 140))}
          placeholder="e.g. Term 1 fees, invoice 0042"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>

      {(err || error) && <p role="alert" className="text-xs text-danger">{err ?? error}</p>}
      {txHash && <TxStatus state={loading ? 'submitted' : 'confirmed'} txHash={txHash} />}

      <div className="flex gap-2">
        <Button size="sm" loading={loading} loadingLabel="Sending…" onClick={() => void handleSubmit()} className="flex-1" disabled={overBalance || rawAmount === 0n}>
          <Send className="size-3.5" aria-hidden /> {payeeEntry ? `Pay ${payeeEntry.label}` : 'Send payment'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>

      {/* Confirm dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm payment">
        <div className="space-y-3">
          <div className="rounded-input bg-[var(--surface-2)] p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Payee</span>
              <span className="font-semibold text-[var(--ink)]">{payeeEntry?.label ?? shortAddr(selectedPayee)}</span>
            </div>
            <div className="flex justify-between font-mono">
              <span className="text-[var(--muted)]">Address</span>
              <span className="text-xs text-[var(--ink-2)] truncate max-w-[160px]">{selectedPayee}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Amount</span>
              <span className="font-semibold tabular-nums text-[var(--ink)]">{amount} USDC</span>
            </div>
            {memo && (
              <div className="flex justify-between">
                <span className="text-[var(--muted)]">Memo</span>
                <span className="text-[var(--ink-2)] max-w-[160px] truncate">{memo}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--line)] pt-1.5">
              <span className="text-[var(--muted)]">Pot balance after</span>
              <span className="font-mono tabular-nums text-[var(--ink-2)]">{formatUsdc(afterBalance)} USDC</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={handleConfirm}>Confirm payment</Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}

// ── RequestPayeeForm ──────────────────────────────────────────────────────────
function RequestPayeeForm({ potId, pot, payees, onDone }: { potId: bigint; pot: Pot; payees: PayeeEntry[]; onDone: () => void }) {
  const { address: connectedAddress } = useAccount()
  const [rawAddr, setRawAddr] = useState('')
  const [checksumAddr, setChecksumAddr] = useState<`0x${string}` | null>(null)
  const [label, setLabel] = useState('')
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | undefined>()
  const { loading, txHash, error, done, run } = useSimpleAction()
  useEffect(() => { if (done) { toast.success('Request sent!'); onDone() } }, [done, onDone])

  async function handleRequest() {
    if (!checksumAddr) { setErr('Enter a valid address.'); return }
    if (!label.trim()) { setErr('Enter a label.'); return }
    if (label.length > 48) { setErr('Label must be 48 characters or fewer.'); return }
    if (reason.length > 140) { setErr('Reason must be 140 characters or fewer.'); return }
    // Client-side guards
    if (checksumAddr.toLowerCase() === pot.sender.toLowerCase()) {
      setErr("That's the sender. Earmark only pays outside payees — that's what keeps the money tied to its purpose."); return
    }
    if (checksumAddr.toLowerCase() === pot.beneficiary.toLowerCase()) {
      setErr("That's the family member. Earmark only pays outside payees — that's what keeps the money tied to its purpose."); return
    }
    if (payees.some((p) => p.address.toLowerCase() === checksumAddr.toLowerCase())) {
      setErr('This payee is already approved.'); return
    }
    if (connectedAddress && checksumAddr.toLowerCase() === connectedAddress.toLowerCase()) {
      setErr("You can't request yourself as a payee."); return
    }
    setErr(undefined)
    await run({
      address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'requestPayee',
      args: [potId, checksumAddr, label, reason], chainId: EARMARK_CHAIN_ID,
    })
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Ask to add a payee</p>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Label (e.g. City Medical Clinic)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 48))}
          placeholder="City Medical Clinic"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Wallet address</label>
        <AddressInput value={rawAddr} onChange={(raw, cs) => { setRawAddr(raw); setChecksumAddr(cs) }} placeholder="0x…" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Reason (optional, max 140 chars)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 140))}
          placeholder="e.g. I need to pay for a checkup next week"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>
      {(err || error) && <p role="alert" className="text-xs text-danger">{err ?? error}</p>}
      {txHash && <TxStatus state={loading ? 'submitted' : 'confirmed'} txHash={txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={loading} loadingLabel="Sending…" onClick={() => void handleRequest()} className="flex-1">
          Send request
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}
