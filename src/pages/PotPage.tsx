/**
 * PotPage — role-aware pot detail page.
 *
 * - No wallet needed for public view
 * - Sender panel: top up, add payee, remove payee, approve/reject requests, extend, release, reclaim
 * - Beneficiary panel: pay, request payee, view own requests
 * - All writes use useContractAction (wallet + chain check, pre-flight simulate, revert decode)
 * - Confirm dialogs before destructive/irreversible actions
 */

import { useState, useEffect } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { readContract } from '@wagmi/core'
import {
  ArrowLeft, Share2, Check, ExternalLink, UserPlus, X, CalendarClock,
  Gift, Undo2, Send, ReceiptText, Loader2, RefreshCw, AlertTriangle, HelpCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/config'
import {
  EARMARK_ADDRESS, EARMARK_ABI, EARMARK_CHAIN_ID, EARMARK_CHAIN,
  USDC_ADDRESS,
} from '@/earmarkConfig'
import { usePot, usePayees, usePayments, usePayeeRequests } from '@/hooks/useEarmark'
import { useContractAction } from '@/hooks/useContractAction'
import { usePotCreatedTxHash, usePaidEventTxHash } from '@/hooks/useEventTxHash'
import CategoryBadge from '@/components/CategoryBadge'
import PotProgress from '@/components/PotProgress'
import PaymentReceipt from '@/components/PaymentReceipt'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AddressChip } from '@/components/ui/AddressChip'
import { EmailAddressInput } from '@/components/ui/EmailAddressInput'
import { AmountInput } from '@/components/ui/AmountInput'
import { Field } from '@/components/ui/Field'
import { Dialog } from '@/components/ui/Dialog'
import { TxStatus } from '@/components/ui/TxStatus'
import {
  formatUsdc, parseUsdc, shortAddr, formatDate, isExpired,
  localDateToExpiry, formatExpiry, isValidUsdcAmount,
} from '@/utils/format'
import type { Pot, PayeeEntry } from '@/earmarkTypes'
import type { PayeeWalletResponse } from '@/lib/emailPayee'
import type { Status } from '@/components/ui/StatusBadge'
import PayeeBadge from '@/components/PayeeBadge'
import AskPayeeToConfirmButton from '@/components/AskPayeeToConfirmButton'
import { parseLabel, encodeLabel, encodedByteLength } from '@/lib/payeeLabel'
import { normaliseDomain } from '@/lib/verifyPayee'
import { PRIVY_ENABLED, usePayingWith } from '@/lib/privy'
import { useTxSender, TxError } from '@/lib/txSender'

function PayingWithLine() {
  const pw = usePayingWith()
  if (!PRIVY_ENABLED || !pw.address) return null
  return (
    <p className="text-xs text-[var(--muted)]">
      Paying with <span className="font-medium text-[var(--ink-2)]">{pw.label}</span>
      {pw.shortAddress && <span className="font-mono"> {pw.shortAddress}</span>}
      {' · '}{pw.balanceLabel} USDC
    </p>
  )
}

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
        <p className="mb-3 text-xs text-[var(--muted)]">
          Read directly from the Arc blockchain. It proves payments from this pot to these addresses; it doesn't prove who owns an address.
        </p>
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
          <span className="text-xs text-[var(--muted)]">Funder</span>
          <AddressChip address={pot.sender} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--muted)]">Recipient</span>
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
          onRefetchPayments={() => void refetchPayments()}
          onRefetchRequests={() => void refetchRequests()}
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
              {payees.map((p) => {
                const parsed = parseLabel(p.label)
                return (
                  <li key={p.address} className="flex items-center justify-between rounded-input bg-[var(--surface-2)] px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--ink)]">{parsed.name}</p>
                      <AddressChip address={p.address} />
                      <PayeeBadge domain={parsed.domain} address={p.address} funder={connectedAddress ?? undefined} className="mt-0.5" />
                    </div>
                    <a
                      href={`${EARMARK_CHAIN.explorerBase}/address/${p.address}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${parsed.name} on explorer`}
                      className="ml-2 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded min-w-[28px] min-h-[28px] flex items-center justify-center shrink-0"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  </li>
                )
              })}
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
      <h2 className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">Funder actions</h2>

      {pot.closed && (
        <p className="text-xs text-[var(--muted)]">This pot is closed. No more actions available.</p>
      )}

      {!pot.closed && (
        <>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 rounded-input bg-[#E6F0FF] px-3 py-2">
              <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--info)] text-[10px] font-semibold text-white">{pendingCount}</span>
              <span className="text-xs font-medium text-[var(--info)]">
                {pendingCount} payee request{pendingCount > 1 ? 's' : ''} waiting for your review
              </span>
            </div>
          )}

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
              <Gift className="size-3.5" aria-hidden /> Release the rest to recipient
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
                    potTitle={pot.title}
                    onResolved={() => { onRefetchRequests(); onRefetchPayees() }}
                  />
                ) : null
              )}
            </div>
          )}

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

      <Dialog open={releaseDialog} onClose={() => setReleaseDialog(false)} title="Release the rest to recipient">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-2)]">
            <strong className="font-mono tabular-nums">{formatUsdc(pot.balance)} USDC</strong> will be released to the recipient with no restrictions.
            The pot closes. <strong>This can't be undone.</strong>
          </p>
          <ReleaseAction potId={potId} onDone={() => { setReleaseDialog(false); onRefetchPot() }} />
        </div>
      </Dialog>

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
            <p className="text-xs text-[var(--muted)]">No approved payees yet. Ask the funder to add one.</p>
          )}
        </div>
      )}

      {showPay && (
        <PayForm
          potId={potId}
          payees={payees}
          balance={pot.balance}
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
  const { send } = useTxSender()
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
      // 1. Approve if allowance is insufficient
      const allowance = await readContract(config, {
        address: USDC_ADDRESS, abi: erc20Abi, functionName: 'allowance',
        args: [address!, EARMARK_ADDRESS] as [`0x${string}`, `0x${string}`],
        chainId: EARMARK_CHAIN_ID,
      })
      if (allowance < rawAmt) {
        await send(
          { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [EARMARK_ADDRESS, rawAmt] },
          `Allow Earmark to move ${amount} USDC`,
        )
      }

      // 2. Top up
      const result = await send(
        { address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'topUp', args: [potId, rawAmt] },
        `Top up pot with ${amount} USDC`,
      )
      setTxHash(result.hash)

      if (result.receipt.status === 'reverted') {
        setPhase('failed'); setErrMsg('Top up was reverted by the contract.')
        return
      }
      setPhase('done')
      toast.success('Pot topped up!')
      onDone()
    } catch (err) {
      setPhase('failed')
      if (err instanceof TxError) {
        setErrMsg(err.friendlyMessage)
      } else {
        setErrMsg('Something went wrong. Please try again.')
      }
    }
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Top up (USDC)</p>
      <AmountInput value={amount} onChange={setAmount} balance={usdcBalance} />
      {errMsg && <p role="alert" className="text-xs text-danger">{errMsg}</p>}
      {txHash && <TxStatus state={phase === 'busy' ? 'submitted' : phase === 'done' ? 'confirmed' : 'failed'} txHash={txHash} />}
      <PayingWithLine />
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
  const { address: funderAddress } = useAccount()
  const [addrRaw, setAddrRaw] = useState('')
  const [checksumAddr, setChecksumAddr] = useState<`0x${string}` | null>(null)
  const [emailData, setEmailData] = useState<PayeeWalletResponse | undefined>()
  const [label, setLabel] = useState('')
  const [website, setWebsite] = useState('')
  const [valErr, setValErr] = useState<string | undefined>()
  const action = useContractAction()

  useEffect(() => {
    if (action.state === 'confirmed') { onDone() }
  }, [action.state, onDone])

  const normWeb = website.trim() ? normaliseDomain(website) : null
  const domain = normWeb?.ok ? normWeb.domain : undefined

  async function handleAdd() {
    if (!checksumAddr) { setValErr('Enter a valid address.'); return }
    if (!label.trim()) { setValErr('Enter a label.'); return }
    if (encodedByteLength(label, domain) > 48) { setValErr('Name and website together must be 48 characters or fewer — shorten the name.'); return }
    if (checksumAddr.toLowerCase() === pot.sender.toLowerCase()) { setValErr('The funder cannot be a payee.'); return }
    if (checksumAddr.toLowerCase() === pot.beneficiary.toLowerCase()) { setValErr('The recipient cannot be a payee.'); return }
    if (payees.some((p) => p.address.toLowerCase() === checksumAddr.toLowerCase())) { setValErr('This address is already an approved payee.'); return }
    setValErr(undefined)
    const encodedLabel = encodeLabel(label, domain)
    await action.execute({
      contractCall: { address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'addPayee', args: [potId, checksumAddr, encodedLabel], chainId: EARMARK_CHAIN_ID },
    })
  }

  const err = valErr ?? action.errorMessage

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Add an approved payee</p>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Label (e.g. Halden Building Supplies)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={48}
          placeholder="Halden Building Supplies"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Wallet address or email</label>
        <EmailAddressInput
          value={addrRaw}
          funder={funderAddress ?? undefined}
          onChange={(result) => {
            setAddrRaw(result.raw)
            setChecksumAddr(result.checksummed)
            setEmailData(result.emailData)
            // Auto-fill label from email if still empty
            if (result.emailData && !label.trim()) setLabel(result.emailData.email)
          }}
          placeholder="0x… or name@company.com"
        />
      </div>
      {!emailData && (
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-[var(--muted)]">
            Website (optional)
            <a href="#/how" className="ml-1 text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded" title="How domain verification works">
              <HelpCircle className="size-3" aria-hidden /> How?
            </a>
          </label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="haldensupplies.com"
            autoComplete="off"
            className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          />
          {checksumAddr && (
            <div className="mt-1 space-y-1">
              <PayeeBadge domain={domain} address={checksumAddr} funder={funderAddress ?? undefined} />
              <AskPayeeToConfirmButton
                payee={checksumAddr}
                name={label.trim() || 'Payee'}
                purpose={pot.title}
                disabled={!label.trim()}
              />
            </div>
          )}
        </div>
      )}
      {emailData && checksumAddr && (
        <PayeeBadge
          address={checksumAddr}
          email={emailData.email}
          emailKind={emailData.emailKind}
          funder={funderAddress ?? undefined}
        />
      )}
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={action.isBusy} loadingLabel="Adding…" onClick={() => void handleAdd()} className="flex-1">
          Add payee
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ── RemovePayeeRow ────────────────────────────────────────────────────────────
function RemovePayeeRow({ potId, payee, onRemoved }: { potId: bigint; payee: PayeeEntry; onRemoved: () => void }) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const action = useContractAction()

  function handleConfirm() {
    void action.execute({
      contractCall: {
        address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'removePayee',
        args: [potId, payee.address], chainId: EARMARK_CHAIN_ID,
      },
      onSuccess: () => {
        setConfirmOpen(false)
        onRemoved()
      },
    })
  }

  const parsedPayee = parseLabel(payee.label)
  return (
    <li className="flex items-center justify-between rounded-input bg-[var(--surface)] px-3 py-2">
      <div>
        <p className="text-xs font-semibold text-[var(--ink)]">{parsedPayee.name}</p>
        <AddressChip address={payee.address} />
      </div>
      <Button
        variant="danger"
        size="sm"
        loading={action.isBusy}
        aria-label={`Remove ${parsedPayee.name}`}
        onClick={() => { action.reset(); setConfirmOpen(true) }}
      >
        <X className="size-3.5" aria-hidden />
      </Button>

      <Dialog open={confirmOpen} onClose={() => { setConfirmOpen(false); action.reset() }} title="Remove payee">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-2)]">
            Remove <strong>{parsedPayee.name}</strong>? The recipient won't be able to pay this address from this pot.
          </p>
          <p className="font-mono text-xs text-[var(--muted)] break-all">{payee.address}</p>
          {action.errorMessage && (
            <p role="alert" className="text-xs text-danger">{action.errorMessage}</p>
          )}
          {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              className="flex-1"
              loading={action.isBusy}
              loadingLabel="Removing…"
              onClick={handleConfirm}
            >
              Remove payee
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setConfirmOpen(false); action.reset() }}>Cancel</Button>
          </div>
        </div>
      </Dialog>
    </li>
  )
}

// ── PayeeRequestCard ──────────────────────────────────────────────────────────
function PayeeRequestCard({ potId, req, requestId, potTitle, onResolved }: {
  potId: bigint;
  req: { payee: `0x${string}`; label: string; reason: string };
  requestId: bigint;
  potTitle: string;
  onResolved: () => void;
}) {
  const { address: funderAddr } = useAccount()
  const approveAction = useContractAction()
  const rejectAction = useContractAction()
  const [confirmApprove, setConfirmApprove] = useState(false)
  const parsedReq = parseLabel(req.label)

  useEffect(() => {
    if (approveAction.state === 'confirmed' || rejectAction.state === 'confirmed') {
      onResolved()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [approveAction.state, rejectAction.state])

  const tx = { address: EARMARK_ADDRESS, abi: EARMARK_ABI, chainId: EARMARK_CHAIN_ID } as const
  const busy = approveAction.isBusy || rejectAction.isBusy
  const err = approveAction.errorMessage ?? rejectAction.errorMessage

  return (
    <div className="rounded-card border border-[#DCE8F5] bg-[var(--surface)] p-3 space-y-2">
      <div>
        <p className="text-xs font-semibold text-[var(--ink)]">
          {parsedReq.name} <span className="font-normal text-[var(--muted)]">— <AddressChip address={req.payee} /></span>
        </p>
        <PayeeBadge domain={parsedReq.domain} address={req.payee} funder={funderAddr ?? undefined} className="mt-0.5" />
        <div className="mt-1">
          <AskPayeeToConfirmButton payee={req.payee} name={parsedReq.name} purpose={potTitle} />
        </div>
        {req.reason && <p className="text-xs italic text-[var(--muted)] mt-0.5">"{req.reason}"</p>}
      </div>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      <div className="flex gap-2">
        <Button
          size="sm"
          className="flex-1 bg-[var(--success)] hover:opacity-90"
          loading={approveAction.isBusy}
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
          loading={rejectAction.isBusy}
          loadingLabel="Rejecting…"
          disabled={busy}
          onClick={() => void rejectAction.execute({
            contractCall: { ...tx, functionName: 'rejectPayeeRequest', args: [potId, requestId] },
            onSuccess: () => { toast.success('Request rejected'); onResolved() },
          })}
        >
          <X className="size-3.5" aria-hidden /> Reject
        </Button>
      </div>

      <Dialog open={confirmApprove} onClose={() => setConfirmApprove(false)} title="Approve payee">
        <div className="space-y-4">
          <p className="text-sm text-[var(--ink-2)]">
            Money from this pot can then be sent to <strong>{parsedReq.name}</strong> at:
          </p>
          <p className="font-mono text-xs text-[var(--ink)] break-all">{req.payee}</p>
          <PayeeBadge domain={parsedReq.domain} address={req.payee} funder={funderAddr ?? undefined} />
          {!parsedReq.domain && (
            <p className="text-xs text-[var(--warning)]">
              Not verified. Ask the payee to confirm before approving — use the button on the request card.
            </p>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 bg-[var(--success)] hover:opacity-90"
              loading={approveAction.isBusy}
              loadingLabel="Approving…"
              onClick={() => {
                setConfirmApprove(false)
                void approveAction.execute({
                  contractCall: { ...tx, functionName: 'approvePayeeRequest', args: [potId, requestId] },
                  onSuccess: () => { toast.success('Payee approved'); onResolved() },
                })
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
  const [valErr, setValErr] = useState<string | undefined>()
  const action = useContractAction()

  useEffect(() => {
    if (action.state === 'confirmed') { toast.success('End date extended!'); onDone() }
  }, [action.state, onDone])

  const minDate = new Date((Number(currentExpiry) + 86400) * 1000).toISOString().split('T')[0]
  const previewLabel = newDate ? formatExpiry(localDateToExpiry(newDate)) : ''
  const err = valErr ?? action.errorMessage

  async function handleExtend() {
    if (!newDate) { setValErr('Select a date.'); return }
    const ts = localDateToExpiry(newDate)
    if (ts <= currentExpiry) { setValErr('New date must be later than the current end date.'); return }
    setValErr(undefined)
    await action.execute({
      contractCall: { address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'extendExpiry', args: [potId, ts], chainId: EARMARK_CHAIN_ID },
    })
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Extend end date</p>
      <Field label="New end date" help={previewLabel || `Must be after ${formatDate(currentExpiry)}`} error={err}>
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
      {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={action.isBusy} loadingLabel="Extending…" onClick={() => void handleExtend()} className="flex-1">
          <CalendarClock className="size-3.5" aria-hidden /> Extend
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}

// ── ReleaseAction ─────────────────────────────────────────────────────────────
function ReleaseAction({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const action = useContractAction()
  useEffect(() => {
    if (action.state === 'confirmed') { toast.success('Released to recipient!'); onDone() }
  }, [action.state, onDone])
  return (
    <div className="space-y-3">
      {action.errorMessage && <p role="alert" className="text-xs text-danger">{action.errorMessage}</p>}
      {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}
      <Button
        size="sm"
        className="w-full bg-[var(--success)] hover:opacity-90"
        loading={action.isBusy}
        loadingLabel="Releasing…"
        onClick={() => void action.execute({
          contractCall: { address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'releaseToBeneficiary', args: [potId], chainId: EARMARK_CHAIN_ID },
          onSuccess: onDone,
        })}
      >
        <Gift className="size-4" aria-hidden /> Release the rest to recipient
      </Button>
    </div>
  )
}

// ── ReclaimAction ─────────────────────────────────────────────────────────────
function ReclaimAction({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const action = useContractAction()
  useEffect(() => {
    if (action.state === 'confirmed') { toast.success('Reclaimed!'); onDone() }
  }, [action.state, onDone])
  return (
    <div className="space-y-3">
      {action.errorMessage && <p role="alert" className="text-xs text-danger">{action.errorMessage}</p>}
      {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}
      <Button
        variant="danger"
        size="sm"
        className="w-full"
        loading={action.isBusy}
        loadingLabel="Reclaiming…"
        onClick={() => void action.execute({
          contractCall: { address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'reclaim', args: [potId], chainId: EARMARK_CHAIN_ID },
          onSuccess: onDone,
        })}
      >
        <Undo2 className="size-4" aria-hidden /> Take back unspent money
      </Button>
    </div>
  )
}

// ── PayForm ───────────────────────────────────────────────────────────────────
function PayForm({ potId, payees, balance, onDone }: { potId: bigint; payees: PayeeEntry[]; balance: bigint; onDone: () => void }) {
  const [selectedPayee, setSelectedPayee] = useState<`0x${string}` | ''>('')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [valErr, setValErr] = useState<string | undefined>()
  const action = useContractAction()
  useEffect(() => {
    if (action.state === 'confirmed') { toast.success('Payment sent!'); onDone() }
  }, [action.state, onDone])

  const rawAmount = parseUsdc(amount)
  const overBalance = rawAmount > balance
  const payeeEntry = payees.find((p) => p.address === selectedPayee)
  const afterBalance = balance - rawAmount
  const err = valErr ?? action.errorMessage

  function handleSubmit() {
    if (!selectedPayee) { setValErr('Choose a payee.'); return }
    if (!isValidUsdcAmount(amount)) { setValErr('Enter a valid amount.'); return }
    if (overBalance) { setValErr('Amount exceeds the pot balance.'); return }
    if (memo.length > 140) { setValErr('Memo must be 140 characters or fewer.'); return }
    setValErr(undefined)
    setConfirmOpen(true)
  }

  function handleConfirm() {
    setConfirmOpen(false)
    void action.execute({
      contractCall: {
        address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'pay',
        args: [potId, selectedPayee, rawAmount, memo],
        chainId: EARMARK_CHAIN_ID,
      },
    })
  }

  return (
    <div className="space-y-4 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Make a payment</p>

      <div>
        <p className="mb-2 text-xs text-[var(--muted)]">Pay to</p>
        <ul className="space-y-2" role="radiogroup" aria-label="Approved payees">
          {payees.map((p) => {
            const pp = parseLabel(p.label)
            return (
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
                  <p className="text-sm font-semibold text-[var(--ink)]">{pp.name}</p>
                  <AddressChip address={p.address} />
                  <PayeeBadge domain={pp.domain} address={p.address} className="mt-0.5" />
                </div>
              </label>
            </li>
            )
          })}
        </ul>
      </div>

      <AmountInput value={amount} onChange={setAmount} balance={balance} />
      {overBalance && <p className="text-xs text-danger">Amount exceeds pot balance.</p>}

      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Memo (optional, max 140 chars)</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 140))}
          placeholder="e.g. PO-1042 · materials"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>

      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}

      <PayingWithLine />
      <div className="flex gap-2">
        <Button size="sm" loading={action.isBusy} loadingLabel="Sending…" onClick={() => void handleSubmit()} className="flex-1" disabled={overBalance || rawAmount === 0n}>
          <Send className="size-3.5" aria-hidden /> {payeeEntry ? `Pay ${parseLabel(payeeEntry.label).name}` : 'Send payment'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>

      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} title="Confirm payment">
        <div className="space-y-3">
          <div className="rounded-input bg-[var(--surface-2)] p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-[var(--muted)]">Payee</span>
              <span className="font-semibold text-[var(--ink)]">{payeeEntry ? parseLabel(payeeEntry.label).name : shortAddr(selectedPayee)}</span>
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
  const [addrRaw, setAddrRaw] = useState('')
  const [checksumAddr, setChecksumAddr] = useState<`0x${string}` | null>(null)
  const [emailData, setEmailData] = useState<PayeeWalletResponse | undefined>()
  const [label, setLabel] = useState('')
  const [website, setWebsite] = useState('')
  const [reason, setReason] = useState('')
  const [valErr, setValErr] = useState<string | undefined>()
  const action = useContractAction()
  useEffect(() => {
    if (action.state === 'confirmed') { toast.success('Request sent!'); onDone() }
  }, [action.state, onDone])

  const normWeb = website.trim() ? normaliseDomain(website) : null
  const domain = normWeb?.ok ? normWeb.domain : undefined
  const err = valErr ?? action.errorMessage

  async function handleRequest() {
    if (!checksumAddr) { setValErr('Enter a valid address.'); return }
    if (!label.trim()) { setValErr('Enter a label.'); return }
    if (encodedByteLength(label, domain) > 48) { setValErr('Name and website together must be 48 characters or fewer — shorten the name.'); return }
    if (reason.length > 140) { setValErr('Reason must be 140 characters or fewer.'); return }
    if (checksumAddr.toLowerCase() === pot.sender.toLowerCase()) {
      setValErr("That's the funder or the recipient. Earmark only pays outside payees — that's what keeps the money tied to its purpose."); return
    }
    if (checksumAddr.toLowerCase() === pot.beneficiary.toLowerCase()) {
      setValErr("That's the funder or the recipient. Earmark only pays outside payees — that's what keeps the money tied to its purpose."); return
    }
    if (payees.some((p) => p.address.toLowerCase() === checksumAddr.toLowerCase())) {
      setValErr('This payee is already approved.'); return
    }
    if (connectedAddress && checksumAddr.toLowerCase() === connectedAddress.toLowerCase()) {
      setValErr("You can't request yourself as a payee."); return
    }
    setValErr(undefined)
    const encodedLabel = encodeLabel(label, domain)
    await action.execute({
      contractCall: { address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'requestPayee', args: [potId, checksumAddr, encodedLabel, reason], chainId: EARMARK_CHAIN_ID },
    })
  }

  return (
    <div className="space-y-3 rounded-card border border-[var(--line)] bg-[var(--surface)] p-4">
      <p className="text-xs font-semibold text-[var(--ink)]">Ask to add a payee</p>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Label (e.g. Halden Building Supplies)</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 48))}
          placeholder="Halden Building Supplies"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Wallet address or email</label>
        <EmailAddressInput
          value={addrRaw}
          funder={connectedAddress ?? undefined}
          onChange={(result) => {
            setAddrRaw(result.raw)
            setChecksumAddr(result.checksummed)
            setEmailData(result.emailData)
            if (result.emailData && !label.trim()) setLabel(result.emailData.email)
          }}
          placeholder="0x… or name@company.com"
        />
      </div>
      {emailData && checksumAddr && (
        <PayeeBadge
          address={checksumAddr}
          email={emailData.email}
          emailKind={emailData.emailKind}
        />
      )}
      {!emailData && (
        <div>
          <label className="mb-1 flex items-center gap-1 text-xs text-[var(--muted)]">
            Website (optional)
            <a href="#/how" className="ml-1 text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded" title="How domain verification works">
              <HelpCircle className="size-3" aria-hidden /> How?
            </a>
          </label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="haldensupplies.com"
            autoComplete="off"
            className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
          />
          {checksumAddr && (
            <div className="mt-1">
              <PayeeBadge domain={domain} address={checksumAddr} />
            </div>
          )}
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs text-[var(--muted)]">Reason (optional, max 140 chars)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 140))}
          placeholder="e.g. I need to pay for a checkup next week"
          className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
        />
      </div>
      {err && <p role="alert" className="text-xs text-danger">{err}</p>}
      {action.txHash && <TxStatus state={action.state} txHash={action.txHash} />}
      <div className="flex gap-2">
        <Button size="sm" loading={action.isBusy} loadingLabel="Sending…" onClick={() => void handleRequest()} className="flex-1">
          Send request
        </Button>
        <Button variant="secondary" size="sm" onClick={onDone}>Cancel</Button>
      </div>
    </div>
  )
}
