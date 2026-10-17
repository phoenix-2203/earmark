import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { ArrowLeft, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { usePotsOfBeneficiary, useMultiplePots, usePayees, usePayments, usePayeeRequests } from '@/hooks/useEarmark'
import { EARMARK_ADDRESS, EARMARK_ABI, EARMARK_CHAIN_ID } from '@/earmarkConfig'
import { friendlyError } from '@/earmarkTypes'
import CategoryBadge from '@/components/CategoryBadge'
import PotProgress from '@/components/PotProgress'
import PaymentReceipt from '@/components/PaymentReceipt'
import TxButton from '@/components/TxButton'
import { formatUsdc, parseUsdc, shortAddr, formatDate, isExpired } from '@/utils/format'
import type { PayeeEntry } from '@/earmarkTypes'

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '1.5rem',
  } as React.CSSProperties,
}

interface Props {
  onBack: () => void
}

export default function ForMePage({ onBack }: Props) {
  const { address } = useAccount()
  const { data: potIds, isLoading: idsLoading } = usePotsOfBeneficiary(address)
  const ids: bigint[] = (potIds as bigint[] | undefined) ?? []
  const { pots, isLoading: potsLoading } = useMultiplePots(ids)

  if (idsLoading || potsLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-6 animate-spin" style={{ color: 'var(--muted)' }} />
      </div>
    )
  }

  return (
    <div className="min-h-dvh px-4 pb-20 pt-6">
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="size-4" /> Back
        </button>
        <h2 className="display mb-6 text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Pots for me
        </h2>

        {pots.length === 0 ? (
          <div className="rounded-3xl p-8 text-center" style={glass.card}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No pots yet. Ask someone to create a pot for your wallet address.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pots.map((pot, i) =>
              pot ? <BeneficiaryPotCard key={pot.id.toString()} pot={pot} potId={ids[i]} /> : null
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function BeneficiaryPotCard({
  pot,
  potId,
}: {
  pot: NonNullable<ReturnType<typeof useMultiplePots>['pots'][number]>
  potId: bigint
}) {
  const [showPay, setShowPay] = useState(false)
  const [showRequest, setShowRequest] = useState(false)

  const { data: payees, refetch: refetchPayees } = usePayees(potId)
  const { data: payments } = usePayments(potId)
  const { data: requests } = usePayeeRequests(potId)

  const expired = isExpired(pot.expiry)
  const canPay = !pot.closed && !expired && pot.balance > 0n

  return (
    <div style={glass.card} className="overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="font-semibold" style={{ color: 'var(--ink)' }}>
              {pot.title}
            </p>
            <CategoryBadge category={pot.category} />
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              From {shortAddr(pot.sender)} · expires {formatDate(pot.expiry)}
            </p>
          </div>
        </div>

        <PotProgress pot={pot} />

        {/* Approved payees list */}
        {(payees ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Approved payees
            </p>
            <div className="space-y-1">
              {payees!.map((p) => (
                <div key={p.address} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--surface-muted)' }}>
                  <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>{p.label}</p>
                  <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>{shortAddr(p.address)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending my requests */}
        {(requests ?? []).filter((r) => !r.resolved).length > 0 && (
          <div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {requests!.filter((r) => !r.resolved).length} payee request(s) pending sender approval.
            </p>
          </div>
        )}

        {/* Past payments */}
        {(payments ?? []).length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Payments
            </p>
            <div className="space-y-2">
              {payments!.map((pmt, i) => (
                <PaymentReceipt key={i} payment={pmt} index={i} potId={potId} payees={payees ?? []} />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        {!pot.closed && (
          <div className="flex gap-2 flex-wrap">
            {canPay && (
              <button
                onClick={() => { setShowPay((v) => !v); setShowRequest(false) }}
                className="flex items-center gap-1.5 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white"
                style={{ background: 'var(--accent)' }}
              >
                <Send className="size-4" /> Pay
              </button>
            )}
            <button
              onClick={() => { setShowRequest((v) => !v); setShowPay(false) }}
              className="rounded-2xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
            >
              Request payee
            </button>
          </div>
        )}

        {showPay && (
          <PayForm potId={potId} payees={payees ?? []} balance={pot.balance} onDone={() => setShowPay(false)} />
        )}
        {showRequest && (
          <RequestPayeeForm potId={potId} onDone={() => { setShowRequest(false); refetchPayees() }} />
        )}
      </div>
    </div>
  )
}

function PayForm({
  potId,
  payees,
  balance,
  onDone,
}: {
  potId: bigint
  payees: PayeeEntry[]
  balance: bigint
  onDone: () => void
}) {
  const [selectedPayee, setSelectedPayee] = useState<`0x${string}`>(payees[0]?.address ?? '0x')
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')

  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) { toast.success('Payment sent!'); onDone() }
  if (error) toast.error(friendlyError(error))

  const rawAmount = parseUsdc(amount)
  const overBalance = rawAmount > balance

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Make a payment</p>

      <div>
        <label className="mb-1 block text-xs" style={{ color: 'var(--muted)' }}>Pay to</label>
        <select
          value={selectedPayee}
          onChange={(e) => setSelectedPayee(e.target.value as `0x${string}`)}
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: 'none' }}
        >
          {payees.map((p) => (
            <option key={p.address} value={p.address}>
              {p.label} ({shortAddr(p.address)})
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs" style={{ color: 'var(--muted)' }}>
          Amount (USDC) · Balance: {formatUsdc(balance)}
        </label>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v) }}
          placeholder="0.00"
          className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none"
          style={{ color: overBalance ? 'var(--danger)' : 'var(--ink)' }}
        />
        {overBalance && <p className="text-xs" style={{ color: 'var(--danger)' }}>Exceeds pot balance.</p>}
      </div>

      <div>
        <label className="mb-1 block text-xs" style={{ color: 'var(--muted)' }}>Memo (optional, max 140 chars)</label>
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value.slice(0, 140))}
          placeholder="e.g. Term 1 fees, invoice 0042"
          className="w-full rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: 'none' }}
        />
      </div>

      <div className="flex gap-2">
        <TxButton
          onClick={() => {
            if (!selectedPayee || rawAmount === 0n || overBalance) { toast.error('Check the amount.'); return }
            writeContract({
              address: EARMARK_ADDRESS,
              abi: EARMARK_ABI,
              functionName: 'pay',
              args: [potId, selectedPayee, rawAmount, memo],
              chainId: EARMARK_CHAIN_ID,
            })
          }}
          isPending={isPending}
          isConfirming={isConfirming}
          label="Send payment"
          disabled={overBalance || rawAmount === 0n}
          className="flex-1"
        />
        <button onClick={onDone} className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function RequestPayeeForm({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const [addr, setAddr] = useState('')
  const [label, setLabel] = useState('')
  const [reason, setReason] = useState('')
  const { writeContract, data: hash, isPending, error } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) { toast.success('Request sent to sender!'); onDone() }
  if (error) toast.error(friendlyError(error))

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ border: '1px solid var(--border)', background: 'var(--surface)' }}>
      <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>Request a new payee</p>

      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="0x… payee address"
        className="mono w-full rounded-xl px-3 py-2 text-xs outline-none"
        style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: 'none' }}
      />
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value.slice(0, 48))}
        placeholder="Label (e.g. City Medical Clinic)"
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: 'none' }}
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value.slice(0, 140))}
        placeholder="Reason (max 140 chars)"
        className="w-full rounded-xl px-3 py-2 text-sm outline-none"
        style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: 'none' }}
      />

      <div className="flex gap-2">
        <TxButton
          onClick={() => {
            if (!addr.startsWith('0x') || addr.length !== 42) { toast.error('Enter a valid address.'); return }
            if (!label.trim()) { toast.error('Enter a label.'); return }
            writeContract({
              address: EARMARK_ADDRESS,
              abi: EARMARK_ABI,
              functionName: 'requestPayee',
              args: [potId, addr as `0x${string}`, label, reason],
              chainId: EARMARK_CHAIN_ID,
            })
          }}
          isPending={isPending}
          isConfirming={isConfirming}
          label="Send request"
          className="flex-1"
        />
        <button onClick={onDone} className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
