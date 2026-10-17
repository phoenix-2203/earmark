import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi } from 'viem'
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { usePotsOfSender, useMultiplePots, usePayees, usePayments, usePayeeRequests } from '@/hooks/useEarmark'
import {
  EARMARK_ADDRESS,
  EARMARK_ABI,
  EARMARK_CHAIN_ID,
  USDC_ADDRESS,
} from '@/earmarkConfig'
import CategoryBadge from '@/components/CategoryBadge'
import PotProgress from '@/components/PotProgress'
import PaymentReceipt from '@/components/PaymentReceipt'
import TxButton from '@/components/TxButton'
import { parseUsdc, shortAddr, formatDate, isExpired } from '@/utils/format'

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
  onViewPot: (potId: bigint) => void
  onReceipt: (potId: bigint, index: number) => void
}

export default function MyPotsPage({ onBack, onViewPot, onReceipt }: Props) {
  const { address } = useAccount()
  const { data: potIds, isLoading: idsLoading } = usePotsOfSender(address)
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
          My pots
        </h2>

        {pots.length === 0 ? (
          <div className="rounded-3xl p-8 text-center" style={glass.card}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              You have no pots yet. Create one to send money home.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pots.map((pot, i) =>
              pot ? (
                <PotCard
                  key={pot.id.toString()}
                  pot={pot}
                  potId={ids[i]}
                  onViewPot={onViewPot}
                  onReceipt={onReceipt}
                />
              ) : null
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function PotCard({ pot, potId, onViewPot, onReceipt: _onReceipt }: { pot: NonNullable<ReturnType<typeof useMultiplePots>['pots'][number]>; potId: bigint; onViewPot: (potId: bigint) => void; onReceipt: (potId: bigint, index: number) => void }) {
  const [open, setOpen] = useState(false)
  const [showTopUp, setShowTopUp] = useState(false)
  const [showExtend, setShowExtend] = useState(false)

  const { data: payees, refetch: refetchPayees } = usePayees(potId)
  const { data: payments } = usePayments(potId)
  const { data: requests, refetch: refetchRequests } = usePayeeRequests(potId)

  const expired = isExpired(pot.expiry)

  return (
    <div style={glass.card} className="overflow-hidden">
      {/* Header */}
      <button
        className="flex w-full items-start justify-between p-5"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="space-y-2 text-left">
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>
            {pot.title}
          </p>
          <CategoryBadge category={pot.category} />
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            For {shortAddr(pot.beneficiary)} · expires {formatDate(pot.expiry)}
          </p>
        </div>
        {open ? (
          <ChevronUp className="mt-1 size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
        ) : (
          <ChevronDown className="mt-1 size-4 shrink-0" style={{ color: 'var(--subtle)' }} />
        )}
      </button>

      {/* View pot link */}
      <div className="px-5 pb-1">
        <button
          onClick={() => onViewPot(potId)}
          className="text-xs font-semibold"
          style={{ color: 'var(--accent-hover)' }}
        >
          View pot page →
        </button>
      </div>

      <div className="px-5 pb-2">
        <PotProgress pot={pot} />
      </div>

      {open && (
        <div className="px-5 pb-5 space-y-5">
          {/* Payees */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Approved payees
            </p>
            <div className="space-y-1.5">
              {(payees ?? []).map((p) => (
                <PayeeRow key={p.address} potId={potId} payee={p} pot={pot} onRemoved={refetchPayees} />
              ))}
              {!pot.closed && (
                <AddPayeeInline potId={potId} onAdded={refetchPayees} />
              )}
            </div>
          </div>

          {/* Pending payee requests */}
          {(requests ?? []).filter((r) => !r.resolved).length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                Payee requests
              </p>
              <div className="space-y-2">
                {requests!.map((req, i) =>
                  !req.resolved ? (
                    <PayeeRequestCard key={i} potId={potId} req={req} requestId={BigInt(i)} onResolved={refetchRequests} />
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Payments */}
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
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowTopUp((v) => !v)}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
              >
                Top up
              </button>
              <button
                onClick={() => setShowExtend((v) => !v)}
                className="rounded-xl px-4 py-2.5 text-xs font-semibold"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
              >
                Extend
              </button>
              <ReleaseButton potId={potId} />
              {expired && <ReclaimButton potId={potId} />}
            </div>
          )}

          {showTopUp && <TopUpForm potId={potId} onDone={() => setShowTopUp(false)} />}
          {showExtend && <ExtendForm potId={potId} currentExpiry={pot.expiry} onDone={() => setShowExtend(false)} />}
        </div>
      )}
    </div>
  )
}

function PayeeRow({
  potId,
  payee,
  pot,
  onRemoved,
}: {
  potId: bigint
  payee: { address: `0x${string}`; label: string }
  pot: { closed: boolean }
  onRemoved: () => void
}) {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) onRemoved()

  return (
    <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: 'var(--surface-muted)' }}>
      <div>
        <p className="text-xs font-medium" style={{ color: 'var(--ink)' }}>
          {payee.label}
        </p>
        <p className="mono text-xs" style={{ color: 'var(--subtle)' }}>
          {shortAddr(payee.address)}
        </p>
      </div>
      {!pot.closed && (
        <button
          onClick={() =>
            writeContract({
              address: EARMARK_ADDRESS,
              abi: EARMARK_ABI,
              functionName: 'removePayee',
              args: [potId, payee.address],
              chainId: EARMARK_CHAIN_ID,
            })
          }
          disabled={isPending || isConfirming}
        >
          {isPending || isConfirming ? (
            <Loader2 className="size-4 animate-spin" style={{ color: 'var(--muted)' }} />
          ) : (
            <X className="size-4" style={{ color: 'var(--danger)' }} />
          )}
        </button>
      )}
    </div>
  )
}

function AddPayeeInline({ potId, onAdded }: { potId: bigint; onAdded: () => void }) {
  const [addr, setAddr] = useState('')
  const [label, setLabel] = useState('')
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) {
    setAddr(''); setLabel(''); onAdded()
  }

  return (
    <div className="space-y-2 rounded-xl p-3" style={{ background: 'var(--surface-muted)' }}>
      <input
        value={addr}
        onChange={(e) => setAddr(e.target.value)}
        placeholder="0x… new payee address"
        className="mono w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
        style={{ color: 'var(--ink)' }}
      />
      <div className="flex gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label"
          maxLength={48}
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
          style={{ color: 'var(--ink)' }}
        />
        <button
          onClick={() => {
            if (!addr.startsWith('0x') || addr.length !== 42 || !label.trim()) {
              toast.error('Valid address and label required.')
              return
            }
            writeContract({
              address: EARMARK_ADDRESS,
              abi: EARMARK_ABI,
              functionName: 'addPayee',
              args: [potId, addr as `0x${string}`, label],
              chainId: EARMARK_CHAIN_ID,
            })
          }}
          disabled={isPending || isConfirming}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          {isPending || isConfirming ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          Add
        </button>
      </div>
    </div>
  )
}

function PayeeRequestCard({
  potId,
  req,
  requestId,
  onResolved,
}: {
  potId: bigint
  req: { payee: `0x${string}`; label: string; reason: string }
  requestId: bigint
  onResolved: () => void
}) {
  const { writeContract: approve, data: aHash, isPending: aP } = useWriteContract()
  const { writeContract: reject, data: rHash, isPending: rP } = useWriteContract()
  const { isSuccess: aOk } = useWaitForTransactionReceipt({ hash: aHash })
  const { isSuccess: rOk } = useWaitForTransactionReceipt({ hash: rHash })

  if (aOk || rOk) onResolved()

  const tx = {
    address: EARMARK_ADDRESS,
    abi: EARMARK_ABI,
    chainId: EARMARK_CHAIN_ID,
  }

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(16,97,166,0.06)', border: '1px solid rgba(16,97,166,0.15)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
        {req.label} <span className="font-normal text-[10px]" style={{ color: 'var(--subtle)' }}>({shortAddr(req.payee)})</span>
      </p>
      {req.reason && <p className="text-xs italic" style={{ color: 'var(--muted)' }}>"{req.reason}"</p>}
      <div className="flex gap-2">
        <button
          onClick={() => approve({ ...tx, functionName: 'approvePayeeRequest', args: [potId, requestId] })}
          disabled={aP || rP}
          className="flex-1 rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--success)' }}
        >
          {aP ? <Loader2 className="mx-auto size-3 animate-spin" /> : 'Approve'}
        </button>
        <button
          onClick={() => reject({ ...tx, functionName: 'rejectPayeeRequest', args: [potId, requestId] })}
          disabled={aP || rP}
          className="flex-1 rounded-xl py-2 text-xs font-semibold text-white disabled:opacity-40"
          style={{ background: 'var(--danger)' }}
        >
          {rP ? <Loader2 className="mx-auto size-3 animate-spin" /> : 'Reject'}
        </button>
      </div>
    </div>
  )
}

function TopUpForm({ potId, onDone }: { potId: bigint; onDone: () => void }) {
  const [amount, setAmount] = useState('')
  const { writeContract: approveUsdc, data: aHash, isPending: aP } = useWriteContract()
  const { isLoading: aCon, isSuccess: aOk } = useWaitForTransactionReceipt({ hash: aHash })
  const { writeContract: topUp, data: tHash, isPending: tP } = useWriteContract()
  const { isLoading: tCon, isSuccess: tOk } = useWaitForTransactionReceipt({ hash: tHash })

  if (aOk && !tP && !tHash) {
    topUp({
      address: EARMARK_ADDRESS,
      abi: EARMARK_ABI,
      functionName: 'topUp',
      args: [potId, parseUsdc(amount)],
      chainId: EARMARK_CHAIN_ID,
    })
  }
  if (tOk) { toast.success('Topped up!'); onDone() }

  const loading = aP || aCon || tP || tCon

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-muted)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>Top up amount (USDC)</p>
      <input
        inputMode="decimal"
        value={amount}
        onChange={(e) => { const v = e.target.value.replace(/[^0-9.]/g, ''); if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v) }}
        placeholder="0.00"
        className="display w-full bg-transparent text-3xl font-bold tabular-nums outline-none"
        style={{ color: 'var(--ink)' }}
      />
      <div className="flex gap-2">
        <TxButton
          onClick={() => {
            if (!amount || parseFloat(amount) <= 0) { toast.error('Enter an amount.'); return }
            approveUsdc({ address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [EARMARK_ADDRESS, parseUsdc(amount)], chainId: EARMARK_CHAIN_ID })
          }}
          disabled={loading}
          isPending={aP}
          isConfirming={aCon || tP || tCon}
          label="Top up"
          pendingLabel="Approving…"
          confirmingLabel="Topping up…"
          className="flex-1"
        />
        <button onClick={onDone} className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ExtendForm({ potId, currentExpiry, onDone }: { potId: bigint; currentExpiry: bigint; onDone: () => void }) {
  const [newDate, setNewDate] = useState('')
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) { toast.success('Expiry extended!'); onDone() }

  const minDate = new Date((Number(currentExpiry) + 86400) * 1000).toISOString().split('T')[0]

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'var(--surface-muted)' }}>
      <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>New end date</p>
      <input
        type="date"
        value={newDate}
        min={minDate}
        onChange={(e) => setNewDate(e.target.value)}
        className="w-full rounded-xl text-sm outline-none"
        style={{ color: 'var(--ink)', background: 'white', padding: '0.5rem 0.75rem' }}
      />
      <div className="flex gap-2">
        <TxButton
          onClick={() => {
            if (!newDate) { toast.error('Select a date.'); return }
            const ts = BigInt(Math.floor(new Date(newDate).getTime() / 1000))
            writeContract({ address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'extendExpiry', args: [potId, ts], chainId: EARMARK_CHAIN_ID })
          }}
          disabled={isPending || isConfirming}
          isPending={isPending}
          isConfirming={isConfirming}
          label="Extend"
          className="flex-1"
        />
        <button onClick={onDone} className="rounded-2xl px-4 py-3 text-sm" style={{ background: 'var(--surface-muted)', color: 'var(--muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function ReleaseButton({ potId }: { potId: bigint }) {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  if (isSuccess) toast.success('Released to family!')
  return (
    <TxButton
      onClick={() => writeContract({ address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'releaseToBeneficiary', args: [potId], chainId: EARMARK_CHAIN_ID })}
      isPending={isPending}
      isConfirming={isConfirming}
      label="Release to family"
      variant="ghost"
    />
  )
}

function ReclaimButton({ potId }: { potId: bigint }) {
  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })
  if (isSuccess) toast.success('Reclaimed!')
  return (
    <TxButton
      onClick={() => writeContract({ address: EARMARK_ADDRESS, abi: EARMARK_ABI, functionName: 'reclaim', args: [potId], chainId: EARMARK_CHAIN_ID })}
      isPending={isPending}
      isConfirming={isConfirming}
      label="Reclaim"
      variant="danger"
    />
  )
}
