/**
 * CreatePotPage — PART 1 compliant.
 *
 * - No side effects during render (all wallet calls inside event handlers)
 * - Reads USDC allowance + balance before opening wallet; only requests approval if needed
 * - 2-step progress indicator
 * - Validates all inputs client-side before any wallet interaction
 * - Address trim + isAddress + getAddress (checksummed)
 * - Date = 23:59:59 in user's local timezone
 * - Sends only completed payee rows to createPot
 * - Client-side guards mirror the contract
 */

import { useState, useCallback } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError, decodeEventLog } from 'viem'
import { Plus, Trash2, ArrowLeft, HelpCircle } from 'lucide-react'
import { toast } from 'sonner'
import { config } from '@/config'
import {
  EARMARK_ADDRESS, EARMARK_ABI, EARMARK_CHAIN_ID, EARMARK_CHAIN,
  USDC_ADDRESS,
} from '@/earmarkConfig'
import { CATEGORY_NAMES, CATEGORY_COLORS, friendlyErrorName } from '@/earmarkTypes'
import { parseUsdc, formatUsdc, localDateToExpiry, formatExpiry, isValidUsdcAmount } from '@/utils/format'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Card } from '@/components/ui/Card'
import { EmailAddressInput } from '@/components/ui/EmailAddressInput'
import { PublicDataNote } from '@/components/ui/PublicDataNote'
import { AmountInput } from '@/components/ui/AmountInput'
import { Stepper } from '@/components/ui/Stepper'
import { TxStatus } from '@/components/ui/TxStatus'
import type { ActionState } from '@/hooks/useContractAction'
import { GraduationCap, House, HeartPulse, Briefcase, Layers } from 'lucide-react'
import PayeeBadge from '@/components/PayeeBadge'
import AskPayeeToConfirmButton from '@/components/AskPayeeToConfirmButton'
import { encodeLabel, encodedByteLength } from '@/lib/payeeLabel'
import { normaliseDomain } from '@/lib/verifyPayee'
import type { PayeeWalletResponse } from '@/lib/emailPayee'
import { PRIVY_ENABLED, usePayingWith } from '@/lib/privy'
import { useTxSender, TxError } from '@/lib/txSender'
import { hashToSlug } from '@/lib/slugLinks'

const CATEGORY_ICONS_COMP = [GraduationCap, House, HeartPulse, Briefcase, Layers]

// Tomorrow's date string for the min constraint
const tomorrow = new Date(Date.now() + 86400000)
const MIN_DATE_STR = tomorrow.toISOString().split('T')[0]

interface PayeeRow {
  rawAddress: string
  checksumAddress: `0x${string}` | null
  label: string
  website: string   // raw user input; normalised before encoding
  emailData?: PayeeWalletResponse
}

/** One-liner shown on all transaction forms: "Paying with Earmark wallet 0x12…34 · 5.00 USDC" */
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
  onBack: () => void
  onSuccess: (potId: bigint) => void
}

type Step = 'form' | 'review' | 'tx'
type TxPhase = 'idle' | 'checkingAllowance' | 'awaitingApproval' | 'waitingApproval' | 'awaitingCreate' | 'waitingCreate' | 'done' | 'failed'

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

export default function CreatePotPage({ onBack, onSuccess }: Props) {
  const { address, chainId, isConnected } = useAccount()
  const { send } = useTxSender()
  const wrongChain = chainId !== EARMARK_CHAIN_ID

  // Form state
  const [beneficiaryRaw, setBeneficiaryRaw] = useState('')
  const [beneficiary, setBeneficiary] = useState<`0x${string}` | null>(null)
  const [beneficiaryEmailData, setBeneficiaryEmailData] = useState<PayeeWalletResponse | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState(0)
  const [amount, setAmount] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [payees, setPayees] = useState<PayeeRow[]>([{ rawAddress: '', checksumAddress: null, label: '', website: '' }])

  // Field errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step / tx state
  const [step, setStep] = useState<Step>('form')
  const [txPhase, setTxPhase] = useState<TxPhase>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [txError, setTxError] = useState<string | undefined>()
  const [txErrorDetail, setTxErrorDetail] = useState<string | undefined>()
  const [createdPotId, setCreatedPotId] = useState<bigint | undefined>()

  // Recipient balance (to decide whether to offer fee top-up)
  const { data: recipientBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: beneficiary ? [beneficiary] : undefined,
    chainId: EARMARK_CHAIN_ID,
    query: { enabled: !!beneficiary, refetchInterval: 60_000 },
  })
  // Offer fee top-up when recipient has < 0.02 USDC (e.g. brand-new email wallet)
  const FEE_OFFER_THRESHOLD = parseUsdc('0.02')
  const FEE_TOP_UP_AMOUNT   = parseUsdc('0.05')
  const showFeeOffer = beneficiary !== null && recipientBalance !== undefined && recipientBalance < FEE_OFFER_THRESHOLD
  const [sendFeeToRecipient, setSendFeeToRecipient] = useState(true)

  // Fee transfer phase (second step after pot creation)
  const [feeTxPhase, setFeeTxPhase] = useState<'idle' | 'awaiting' | 'waiting' | 'done' | 'failed'>('idle')
  const [feeTxHash, setFeeTxHash] = useState<`0x${string}` | undefined>()

  // USDC balance
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: EARMARK_CHAIN_ID,
    query: { enabled: isConnected && !!address, refetchInterval: 30_000 },
  })

  const rawAmount = parseUsdc(amount)
  const hasSufficientBalance = usdcBalance !== undefined ? usdcBalance >= rawAmount : true

  // Derived expiry label
  const expiryLabel = expiryDate ? formatExpiry(localDateToExpiry(expiryDate)) : ''

  function validateForm(): Record<string, string> {
    const e: Record<string, string> = {}

    if (!beneficiary) e.beneficiary = 'Enter a valid wallet address.'
    else if (address && beneficiary.toLowerCase() === address.toLowerCase()) {
      e.beneficiary = 'You can\'t create a pot for yourself.'
    }

    if (!title.trim()) e.title = 'Enter a title for this pot.'
    else if (title.length > 64) e.title = 'Title must be 64 characters or fewer.'

    if (!isValidUsdcAmount(amount)) e.amount = 'Enter an amount greater than zero.'
    else if (!hasSufficientBalance) {
      e.amount = `You have ${formatUsdc(usdcBalance ?? 0n)} USDC; this pot needs ${amount}.`
    }

    if (!expiryDate) e.expiry = 'Select an end date.'
    else if (localDateToExpiry(expiryDate) <= BigInt(Math.floor(Date.now() / 1000))) {
      e.expiry = 'End date must be in the future.'
    }

    // Validate completed payee rows
    const completed = payees.filter((p) => p.rawAddress.trim() || p.label.trim())
    if (completed.length === 0) e.payees = 'Add at least one approved payee.'

    const seenAddrs = new Set<string>()
    for (const p of completed) {
      if (!p.checksumAddress) { e.payees = `Invalid address: ${p.rawAddress}`; break }
      if (beneficiary && p.checksumAddress.toLowerCase() === beneficiary.toLowerCase()) {
        e.payees = 'The recipient cannot be an approved payee.'; break
      }
      if (address && p.checksumAddress.toLowerCase() === address.toLowerCase()) {
        e.payees = 'The funder cannot be an approved payee.'; break
      }
      if (!p.label.trim()) { e.payees = 'Every payee needs a label.'; break }
      const normWeb = p.website.trim() ? normaliseDomain(p.website) : null
      const domain = normWeb?.ok ? normWeb.domain : undefined
      if (encodedByteLength(p.label, domain) > 48) {
        e.payees = 'Name and website together must be 48 characters or fewer — shorten the name.'; break
      }
      if (seenAddrs.has(p.checksumAddress.toLowerCase())) { e.payees = 'Duplicate payee address.'; break }
      seenAddrs.add(p.checksumAddress.toLowerCase())
    }

    return e
  }

  function handleReview() {
    const e = validateForm()
    setErrors(e)
    if (Object.keys(e).length > 0) {
      toast.error('Please fix the errors above.')
      return
    }
    setStep('review')
  }

  const completedPayees = payees.filter((p) => p.checksumAddress && p.label.trim())

  const handleCreate = useCallback(async () => {
    if (!address || !beneficiary) return
    if (wrongChain) { toast.error('Switch to Arc network first.'); return }

    setStep('tx')
    setTxPhase('checkingAllowance')
    setTxHash(undefined)
    setTxError(undefined)
    setTxErrorDetail(undefined)

    try {
      const rawAmt = parseUsdc(amount)
      const expiryTs = localDateToExpiry(expiryDate)

      // 1. Check allowance — only approve if below the required amount
      const { readContract } = await import('@wagmi/core')
      const allowance = await readContract(config, {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, EARMARK_ADDRESS],
        chainId: EARMARK_CHAIN_ID,
      })

      if (allowance < rawAmt) {
        setTxPhase('awaitingApproval')
        await send(
          { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'approve', args: [EARMARK_ADDRESS, rawAmt] },
          `Allow Earmark to move ${amount} USDC`,
        )
        setTxPhase('waitingApproval')
      }

      // 2. Create pot (only completed rows)
      const payeeAddrs = completedPayees.map((p) => p.checksumAddress as `0x${string}`)
      const payeeLabels = completedPayees.map((p) => {
        const normWeb = p.website.trim() ? normaliseDomain(p.website) : null
        const domain = normWeb?.ok ? normWeb.domain : undefined
        return encodeLabel(p.label, domain)
      })

      setTxPhase('awaitingCreate')
      const createResult = await send(
        {
          address: EARMARK_ADDRESS,
          abi: EARMARK_ABI,
          functionName: 'createPot',
          args: [beneficiary, title, category, rawAmt, expiryTs, payeeAddrs, payeeLabels],
        },
        `Create pot '${title}'`,
      )
      setTxHash(createResult.hash)
      setTxPhase('waitingCreate')

      // Decode potId from the PotCreated event — need the full receipt
      const fullReceipt = await (await import('@wagmi/core')).waitForTransactionReceipt(config, {
        hash: createResult.hash,
        chainId: EARMARK_CHAIN_ID,
      })

      let potId: bigint | undefined
      for (const log of fullReceipt.logs) {
        if (log.address.toLowerCase() !== EARMARK_ADDRESS.toLowerCase()) continue
        try {
          const decoded = decodeEventLog({
            abi: EARMARK_ABI,
            data: log.data,
            topics: log.topics,
          })
          if (decoded.eventName === 'PotCreated') {
            const args = decoded.args as { potId?: bigint }
            if (typeof args.potId === 'bigint') { potId = args.potId; break }
          }
        } catch { /* not this event or wrong ABI entry, skip */ }
      }

      setTxPhase('done')
      setCreatedPotId(potId)
      toast.success('Pot created!')

      // Optional: send fee top-up to recipient
      if (sendFeeToRecipient && showFeeOffer && beneficiary) {
        setFeeTxPhase('awaiting')
        try {
          const feeResult = await send(
            { address: USDC_ADDRESS, abi: erc20Abi, functionName: 'transfer', args: [beneficiary, FEE_TOP_UP_AMOUNT] },
            `Send 0.05 USDC to recipient for fees`,
          )
          setFeeTxHash(feeResult.hash)
          setFeeTxPhase('waiting')
          if (feeResult.receipt.status === 'success') {
            setFeeTxPhase('done')
            toast.success('Fee USDC sent to recipient!')
          } else {
            setFeeTxPhase('failed')
            toast.error('Fee transfer reverted — the pot was still created.')
          }
        } catch {
          setFeeTxPhase('failed')
          toast.error('Fee transfer failed — the pot was still created.')
        }
      }
    } catch (err) {
      console.error('[CreatePotPage] createPot:', err)
      setTxPhase('failed')
      if (err instanceof TxError) {
        setTxError(err.friendlyMessage)
        setTxErrorDetail(err.detail)
      } else {
        setTxError(extractErr(err))
        setTxErrorDetail(err instanceof Error ? err.message.slice(0, 160) : undefined)
      }
    }
  }, [address, beneficiary, wrongChain, amount, expiryDate, completedPayees, title, category, sendFeeToRecipient, showFeeOffer, FEE_TOP_UP_AMOUNT, send])

  // Map txPhase → ActionState for TxStatus component
  const actionState: ActionState =
    txPhase === 'idle'           ? 'idle' :
    txPhase === 'checkingAllowance' ? 'checking' :
    txPhase === 'awaitingApproval' || txPhase === 'awaitingCreate' ? 'awaitingSignature' :
    txPhase === 'waitingApproval' || txPhase === 'waitingCreate'   ? 'submitted' :
    txPhase === 'done'           ? 'confirmed' :
    'failed'

  const stepperSteps = [
    { label: 'Allow Earmark to move USDC',      status: txPhase === 'idle' || txPhase === 'checkingAllowance' ? 'active' as const : txPhase === 'awaitingApproval' || txPhase === 'waitingApproval' ? 'active' as const : 'done' as const },
    { label: 'Create the pot',                  status: txPhase === 'awaitingCreate' || txPhase === 'waitingCreate' ? 'active' as const : txPhase === 'done' ? 'done' as const : 'pending' as const },
    ...(sendFeeToRecipient && showFeeOffer ? [{
      label: 'Send 0.05 USDC to recipient for fees',
      status: feeTxPhase === 'idle' ? 'pending' as const : feeTxPhase === 'awaiting' || feeTxPhase === 'waiting' ? 'active' as const : 'done' as const,
    }] : []),
  ]

  // ── Success state ──
  if (txPhase === 'done' && step === 'tx') {
    const potSlug = txHash ? hashToSlug(txHash) : undefined
    const potUrl = potSlug
      ? `${window.location.origin}/#/p/${potSlug}`
      : `${window.location.origin}/#/pot/${createdPotId ?? ''}`
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
        <Card padding="lg" className="text-center space-y-4">
          <div className="flex size-12 mx-auto items-center justify-center rounded-full bg-[var(--accent-soft)]">
            <span className="text-2xl" aria-hidden>✓</span>
          </div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">Pot created!</h2>
          <p className="text-sm text-[var(--muted)]">
            Share this link with the recipient so they can view the pot and make payments.
          </p>
          {feeTxPhase !== 'idle' && (
            <TxStatus
              state={feeTxPhase === 'awaiting' ? 'awaitingSignature' : feeTxPhase === 'waiting' ? 'submitted' : feeTxPhase === 'done' ? 'confirmed' : 'failed'}
              txHash={feeTxHash}
              errorMessage={feeTxPhase === 'failed' ? 'Fee transfer failed — the pot was still created.' : undefined}
            />
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="primary"
              onClick={() => { void navigator.clipboard.writeText(potUrl); toast.success('Link copied!') }}
            >
              Copy pot link
            </Button>
            {createdPotId !== undefined && (
              <Button variant="secondary" onClick={() => onSuccess(createdPotId)}>
                Go to pot
              </Button>
            )}
          </div>
          {txHash && (
            <TxStatus state="confirmed" txHash={txHash} />
          )}
        </Card>
      </main>
    )
  }

  // ── TX in-progress ──
  if (step === 'tx') {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
        <Card padding="lg" className="space-y-5">
          <h2 className="text-base font-semibold text-[var(--ink)]">Creating your pot</h2>
          <Stepper steps={stepperSteps} />
          <TxStatus state={actionState} txHash={txHash} errorMessage={txError} errorDetail={txErrorDetail} />
          {txPhase === 'failed' && (
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setStep('review'); setTxPhase('idle') }}>
                Go back
              </Button>
              <Button variant="primary" onClick={() => void handleCreate()}>
                Retry
              </Button>
            </div>
          )}
        </Card>
      </main>
    )
  }

  // ── Review panel ──
  if (step === 'review') {
    return (
      <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
        <button
          onClick={() => setStep('form')}
          className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          <ArrowLeft className="size-4" aria-hidden /> Edit
        </button>
        <h2 className="display mb-6 text-2xl font-semibold text-[var(--ink)]">Review your pot</h2>

        <Card padding="lg" className="mb-4 space-y-4">
          <ReviewRow label="Recipient" value={beneficiary ?? ''} mono />
          <ReviewRow label="Purpose" value={title} />
          <ReviewRow label="Category" value={CATEGORY_NAMES[category] ?? 'Other'} />
          <ReviewRow label="Amount" value={`${amount} USDC`} />
          <ReviewRow label="End date" value={expiryLabel} />
          <div>
            <p className="text-xs font-medium text-[var(--ink-2)] mb-2">Approved payees</p>
            {completedPayees.map((p, i) => (
              <div key={i} className="mb-1.5 rounded-input bg-[var(--surface-2)] px-3 py-2">
                <p className="text-sm font-medium text-[var(--ink)]">{p.label}</p>
                <p className="font-mono text-xs text-[var(--muted)]">{p.checksumAddress}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="md" className="mb-6 rounded-card border-[var(--line)] bg-[var(--accent-soft)]">
          <p className="text-sm text-[var(--accent)]">
            You will confirm <strong>up to 2 transactions</strong> in your wallet:
            first allow Earmark to move {amount} USDC (skipped if you already have approval),
            then create the pot.
            Network: {EARMARK_CHAIN.name}.
          </p>
        </Card>

        <PayingWithLine />
        <Button size="lg" className="w-full" onClick={() => void handleCreate()}>
          Create pot
        </Button>
      </main>
    )
  }

  // ── Form ──
  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>

      <h1 className="display mb-8 text-2xl font-semibold text-[var(--ink)]">Create a pot</h1>

      <div className="space-y-6">
        {/* Beneficiary */}
        <Card padding="lg">
          <Field
            label="Who is it for? (wallet address or email)"
            help="The person who will spend from this pot. You can't be your own recipient."
            error={errors.beneficiary}
          >
            {(fieldProps) => (
              <EmailAddressInput
                {...fieldProps}
                value={beneficiaryRaw}
                onChange={(result) => {
                  setBeneficiaryRaw(result.raw)
                  setBeneficiary(result.checksummed)
                  setBeneficiaryEmailData(result.emailData ?? null)
                  if (errors.beneficiary) setErrors((e) => { const ne = { ...e }; delete ne.beneficiary; return ne })
                }}
                placeholder="0x… or name@example.com"
                funder={address}
              />
            )}
          </Field>
          {beneficiary && beneficiaryEmailData && (
            <PayeeBadge
              address={beneficiary}
              email={beneficiaryEmailData.email}
              emailKind={beneficiaryEmailData.emailKind}
            />
          )}
        </Card>

        {/* Fee top-up offer (new email recipient with low balance) */}
        {showFeeOffer && (
          <div className="flex items-start gap-3 rounded-card border border-[var(--line)] bg-[var(--accent-soft)] p-4">
            <input
              type="checkbox"
              id="send-fee"
              checked={sendFeeToRecipient}
              onChange={(e) => setSendFeeToRecipient(e.target.checked)}
              className="mt-0.5 size-4 rounded focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
            />
            <label htmlFor="send-fee" className="text-sm text-[var(--accent)] cursor-pointer select-none">
              Also send <strong>0.05 USDC</strong> to the recipient for network fees (paid in USDC on Arc).
              They will need a small amount to make payments from the pot.
            </label>
          </div>
        )}

        {/* Title + Category */}
        <Card padding="lg" className="space-y-4">
          <Field
            label="What is it for?"
            help="A short title, e.g. 'Office fit-out · Phase 1'."
            error={errors.title}
          >
            {({ id, ...rest }) => (
              <input
                id={id}
                {...rest}
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value)
                  if (errors.title) setErrors((er) => { const ne = { ...er }; delete ne.title; return ne })
                }}
                placeholder="Office fit-out · Phase 1"
                maxLength={64}
                className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              />
            )}
          </Field>
          <PublicDataNote />

          <div>
            <p className="mb-2 text-xs font-medium text-[var(--ink-2)]">Category</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_NAMES.map((name, i) => {
                const Icon = CATEGORY_ICONS_COMP[i]
                const color = CATEGORY_COLORS[i]
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCategory(i)}
                    className="inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
                    style={
                      category === i
                        ? { background: color.bg, color: color.text, outline: `2px solid ${color.text}`, outlineOffset: '1px' }
                        : { background: 'var(--surface-2)', color: 'var(--muted)' }
                    }
                    aria-pressed={category === i}
                  >
                    <Icon className="size-3" aria-hidden />
                    {name}
                  </button>
                )
              })}
            </div>
          </div>
        </Card>

        {/* Amount + End date */}
        <Card padding="lg" className="space-y-5">
          <Field
            label="How much? (USDC)"
            error={errors.amount}
          >
            {(fieldProps) => (
              <AmountInput
                {...fieldProps}
                value={amount}
                onChange={(v) => {
                  setAmount(v)
                  if (errors.amount) setErrors((e) => { const ne = { ...e }; delete ne.amount; return ne })
                }}
                balance={usdcBalance}
              />
            )}
          </Field>

          <Field
            label="Until when? (end date)"
            help={expiryLabel || 'After this date you can take back unspent money.'}
            error={errors.expiry}
          >
            {({ id, ...rest }) => (
              <input
                id={id}
                {...rest}
                type="date"
                value={expiryDate}
                min={MIN_DATE_STR}
                onChange={(e) => {
                  setExpiryDate(e.target.value)
                  if (errors.expiry) setErrors((er) => { const ne = { ...er }; delete ne.expiry; return ne })
                }}
                className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              />
            )}
          </Field>
        </Card>

        {/* Payees */}
        <Card padding="lg" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-[var(--ink-2)]">Who can be paid? (approved payees)</p>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                Only these addresses can receive money from this pot. The recipient can ask you to add more later.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPayees((p) => [...p, { rawAddress: '', checksumAddress: null, label: '', website: '' }])}
              disabled={payees.length >= 20}
              className="flex items-center gap-1 text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
            >
              <Plus className="size-3.5" aria-hidden /> Add payee
            </button>
          </div>

          {errors.payees && (
            <p role="alert" className="text-xs font-medium text-danger">{errors.payees}</p>
          )}

          {payees.map((payee, i) => (
            <div key={i} className="space-y-2 rounded-input border border-[var(--line)] bg-[var(--surface-2)] p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium text-[var(--ink-2)]">Payee {i + 1}</p>
                {payees.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setPayees((p) => p.filter((_, j) => j !== i))}
                    aria-label={`Remove payee ${i + 1}`}
                    className="text-danger hover:opacity-75 focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded min-w-[32px] min-h-[32px] flex items-center justify-center"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Label (e.g. Halden Building Supplies)</label>
                <input
                  value={payee.label}
                  onChange={(e) => setPayees((p) => p.map((r, j) => j === i ? { ...r, label: e.target.value } : r))}
                  placeholder="Halden Building Supplies"
                  maxLength={48}
                  className="w-full rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                />
                <PublicDataNote />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Wallet address or email</label>
                <EmailAddressInput
                  value={payee.rawAddress}
                  onChange={(result) =>
                    setPayees((p) => p.map((r, j) => j === i ? { ...r, rawAddress: result.raw, checksumAddress: result.checksummed, emailData: result.emailData } : r))
                  }
                  placeholder="0x… or name@example.com"
                  funder={address}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)] flex items-center gap-1">
                  Website (optional)
                  <a
                    href="#/how"
                    className="ml-1 text-[var(--accent)] hover:underline inline-flex items-center gap-0.5 focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
                    title="How domain verification works"
                    aria-label="How payee domain verification works"
                  >
                    <HelpCircle className="size-3" aria-hidden /> How?
                  </a>
                </label>
                <input
                  value={payee.website}
                  onChange={(e) => setPayees((p) => p.map((r, j) => j === i ? { ...r, website: e.target.value } : r))}
                  placeholder="haldensupplies.com"
                  className="w-full rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
                  aria-label={`Website for payee ${i + 1}`}
                  autoComplete="off"
                />
                {payee.checksumAddress && (
                  <div className="mt-1 space-y-1">
                    <PayeeBadge
                      domain={payee.website.trim() ? (() => { const n = normaliseDomain(payee.website); return n.ok ? n.domain : undefined })() : undefined}
                      address={payee.checksumAddress}
                      funder={address}
                      email={payee.emailData?.email}
                      emailKind={payee.emailData?.emailKind}
                    />
                    <AskPayeeToConfirmButton
                      payee={payee.checksumAddress}
                      name={payee.label.trim() || 'Payee'}
                      purpose={title.trim() || 'this pot'}
                      disabled={!payee.label.trim()}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </Card>

        <PayingWithLine />
        <Button
          size="lg"
          className="w-full"
          onClick={handleReview}
          disabled={!isConnected}
        >
          {!isConnected ? 'Connect wallet to continue' : 'Review pot'}
        </Button>
      </div>
    </main>
  )
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`text-sm font-medium text-[var(--ink)] break-all ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}


