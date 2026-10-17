import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { erc20Abi } from 'viem'
import { Plus, Trash2, ArrowLeft, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { EARMARK_ADDRESS, EARMARK_ABI, EARMARK_CHAIN_ID, USDC_ADDRESS } from '@/earmarkConfig'
import { CATEGORY_NAMES, friendlyError } from '@/earmarkTypes'
import { parseUsdc } from '@/utils/format'

// Computed at module load — stable for the lifetime of this page visit
const _tomorrow = new Date(Date.now() + 86400000)
const MIN_DATE_STR = _tomorrow.toISOString().split('T')[0]

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '1.5rem',
  } as React.CSSProperties,
  inner: {
    background: 'var(--surface-muted)',
    borderRadius: '1rem',
  } as React.CSSProperties,
}

interface Props {
  onBack: () => void
  onSuccess: () => void
}

interface PayeeRow {
  address: string
  label: string
}

export default function CreatePotPage({ onBack, onSuccess }: Props) {
  const { address, chainId } = useAccount()
  const wrongChain = chainId !== EARMARK_CHAIN_ID

  const [beneficiary, setBeneficiary] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(0)
  const [amount, setAmount] = useState('')
  const [expiry, setExpiry] = useState('')
  const [payees, setPayees] = useState<PayeeRow[]>([{ address: '', label: '' }])

  // Step 1: approve USDC
  const {
    writeContract: approveUsdc,
    data: approveHash,
    isPending: isApprovePending,
  } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } =
    useWaitForTransactionReceipt({ hash: approveHash })

  // Step 2: createPot
  const {
    writeContract: createPot,
    data: createHash,
    isPending: isCreatePending,
  } = useWriteContract()
  const { isLoading: isCreateConfirming, isSuccess: isCreateSuccess } =
    useWaitForTransactionReceipt({ hash: createHash })

  // After approval confirmed, call createPot
  if (isApproveSuccess && !isCreatePending && !createHash) {
    const rawAmount = parseUsdc(amount)
    const expiryTs = BigInt(Math.floor(new Date(expiry).getTime() / 1000))
    const payeeAddrs = payees.map((p) => p.address as `0x${string}`)
    const payeeLabels = payees.map((p) => p.label)
    createPot({
      address: EARMARK_ADDRESS,
      abi: EARMARK_ABI,
      functionName: 'createPot',
      args: [beneficiary as `0x${string}`, title, category, rawAmount, expiryTs, payeeAddrs, payeeLabels],
      chainId: EARMARK_CHAIN_ID,
    })
  }

  if (isCreateSuccess) {
    toast.success('Pot created!')
    onSuccess()
  }

  function validate(): string | null {
    if (!beneficiary.startsWith('0x') || beneficiary.length !== 42) return 'Enter a valid beneficiary address.'
    if (!title.trim()) return 'Enter a title for this pot.'
    if (title.length > 64) return 'Title must be 64 characters or fewer.'
    if (!amount || parseFloat(amount) <= 0) return 'Enter an amount greater than zero.'
    if (!expiry) return 'Select an end date.'
    if (new Date(expiry).getTime() <= Date.now()) return 'End date must be in the future.'
    const validPayees = payees.filter((p) => p.address.trim())
    if (validPayees.length === 0) return 'Add at least one payee.'
    for (const p of validPayees) {
      if (!p.address.startsWith('0x') || p.address.length !== 42) return `Invalid payee address: ${p.address}`
      if (!p.label.trim()) return 'Every payee needs a label.'
      if (p.label.length > 48) return 'Payee labels must be 48 characters or fewer.'
    }
    return null
  }

  function handleSubmit() {
    const err = validate()
    if (err) { toast.error(err); return }
    if (!address) { toast.error('Connect your wallet first.'); return }
    if (wrongChain) { toast.error('Switch to the correct network first.'); return }

    const rawAmount = parseUsdc(amount)
    try {
      approveUsdc({
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'approve',
        args: [EARMARK_ADDRESS, rawAmount],
        chainId: EARMARK_CHAIN_ID,
      })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const isLoading = isApprovePending || isApproveConfirming || isCreatePending || isCreateConfirming
  const step = isApprovePending || isApproveConfirming ? 'Approving USDC…' : isCreatePending || isCreateConfirming ? 'Creating pot…' : null

  const minDateStr = MIN_DATE_STR

  return (
    <div className="min-h-dvh px-4 pb-20 pt-6">
      <div className="mx-auto max-w-md">
        <button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm" style={{ color: 'var(--muted)' }}>
          <ArrowLeft className="size-4" /> Back
        </button>

        <h2 className="display mb-6 text-2xl font-bold" style={{ color: 'var(--ink)', letterSpacing: '-0.02em' }}>
          Create a pot
        </h2>

        <div className="space-y-4">
          {/* Beneficiary */}
          <div style={glass.card} className="p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Family member's wallet address
            </label>
            <input
              value={beneficiary}
              onChange={(e) => setBeneficiary(e.target.value)}
              placeholder="0x…"
              className="mono w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              style={{ color: 'var(--ink)' }}
            />
          </div>

          {/* Title + Category */}
          <div style={glass.card} className="p-4 space-y-3">
            <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
              Purpose
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. School fees — Term 1"
              maxLength={64}
              className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
              style={{ color: 'var(--ink)' }}
            />
            <div className="flex flex-wrap gap-2 pt-1">
              {CATEGORY_NAMES.map((name, i) => (
                <button
                  key={i}
                  onClick={() => setCategory(i)}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-all"
                  style={
                    category === i
                      ? { background: 'var(--accent)', color: 'white' }
                      : { background: 'var(--surface-muted)', color: 'var(--muted)' }
                  }
                >
                  {name}
                </button>
              ))}
            </div>
          </div>

          {/* Amount + End date */}
          <div style={glass.card} className="p-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                Amount (USDC)
              </label>
              <div className="flex items-baseline gap-2">
                <input
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^0-9.]/g, '')
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setAmount(v)
                  }}
                  placeholder="0.00"
                  className="display w-full bg-transparent text-4xl font-bold tabular-nums outline-none placeholder:text-slate-300"
                  style={{ color: 'var(--ink)' }}
                />
                <span className="text-lg" style={{ color: 'var(--subtle)' }}>USDC</span>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                End date
              </label>
              <input
                type="date"
                value={expiry}
                min={minDateStr}
                onChange={(e) => setExpiry(e.target.value)}
                className="w-full rounded-xl bg-transparent text-sm outline-none"
                style={{ color: 'var(--ink)', background: 'var(--surface-muted)', padding: '0.5rem 0.75rem' }}
              />
            </div>
          </div>

          {/* Payees */}
          <div style={glass.card} className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--muted)', letterSpacing: '0.08em' }}>
                Approved payees
              </label>
              <button
                onClick={() => setPayees((p) => [...p, { address: '', label: '' }])}
                disabled={payees.length >= 20}
                className="flex items-center gap-1 text-xs font-semibold disabled:opacity-40"
                style={{ color: 'var(--accent-hover)' }}
              >
                <Plus className="size-3" /> Add payee
              </button>
            </div>

            {payees.map((payee, i) => (
              <div key={i} className="rounded-xl p-3 space-y-2" style={{ background: 'var(--surface-muted)' }}>
                <div className="flex items-center gap-2">
                  <input
                    value={payee.address}
                    onChange={(e) => setPayees((p) => p.map((r, j) => j === i ? { ...r, address: e.target.value } : r))}
                    placeholder="0x… wallet address"
                    className="mono flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
                    style={{ color: 'var(--ink)' }}
                  />
                  {payees.length > 1 && (
                    <button onClick={() => setPayees((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" style={{ color: 'var(--danger)' }} />
                    </button>
                  )}
                </div>
                <input
                  value={payee.label}
                  onChange={(e) => setPayees((p) => p.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                  placeholder="Label (e.g. Greenfield School)"
                  maxLength={48}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-slate-400"
                  style={{ color: 'var(--ink)' }}
                />
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            {isLoading && <Loader2 className="size-4 animate-spin" />}
            {step ?? (isApproveSuccess ? 'Creating pot…' : 'Approve USDC & Create pot')}
          </button>

          <p className="text-center text-xs" style={{ color: 'var(--subtle)' }}>
            Two steps: first approve USDC, then create the pot. Both require a wallet confirmation.
          </p>
        </div>
      </div>
    </div>
  )
}
