/**
 * WalletPage — #/wallet
 *
 * Shows the signed-in user's Earmark embedded wallet:
 *  - Email + wallet address (copy + QR)
 *  - USDC balance
 *  - "Send USDC out" (to own wallet or an exchange)
 *  - "Export private key" via Privy exportWallet (behind a warning)
 *
 * Only meaningful when Privy is enabled. Falls back to a sign-in prompt
 * for non-Privy builds or unauthenticated users.
 */

import { useState, useCallback } from 'react'
import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi, isAddress, getAddress } from 'viem'
import { writeContract, waitForTransactionReceipt } from '@wagmi/core'
import { Copy, ExternalLink, Download, QrCode, ArrowLeft, AlertTriangle, Send } from 'lucide-react'
import QRCode from 'qrcode'
import { toast } from 'sonner'
import { usePrivy, useExportWallet } from '@privy-io/react-auth'
import { usePrivyReady } from '@/lib/privy'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { AmountInput } from '@/components/ui/AmountInput'
import { TxStatus } from '@/components/ui/TxStatus'
import { formatUsdc, parseUsdc, shortAddr, isValidUsdcAmount } from '@/utils/format'
import { USDC_ADDRESS, EARMARK_CHAIN_ID, EARMARK_CHAIN } from '@/earmarkConfig'
import { PRIVY_ENABLED } from '@/lib/privy'
import { config } from '@/config'
import type { ActionState } from '@/hooks/useContractAction'

// ── Minimum gas reserve (in USDC 6-dec) ──────────────────────────────────────
// Arc fees are tiny but non-zero. Reserve 0.02 USDC so the user can always pay gas.
const GAS_RESERVE = parseUsdc('0.02')

interface Props {
  onBack: () => void
  onSignIn: () => void
}

/** Outer shell — guards Privy availability. */
export default function WalletPage({ onBack, onSignIn }: Props) {
  if (!PRIVY_ENABLED) {
    return (
      <PageShell onBack={onBack}>
        <Card padding="lg" className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-[var(--ink)]">My Earmark wallet</h1>
          <p className="text-sm text-[var(--ink-2)]">Sign-in isn't enabled on this site.</p>
          <Button size="md" variant="secondary" className="w-full" onClick={onBack}>Go home</Button>
        </Card>
      </PageShell>
    )
  }
  return <PrivyWalletContent onBack={onBack} onSignIn={onSignIn} />
}

/** Inner component — only rendered when PRIVY_ENABLED. usePrivy is called unconditionally. */
function PrivyWalletContent({ onBack, onSignIn }: Props) {
  const privy = usePrivy()
  const { ready, timedOut } = usePrivyReady()
  const { exportWallet } = useExportWallet()
  const { address: connectedAddress } = useAccount()

  // Detect the Privy-managed embedded wallet (walletClientType === 'privy')
  const embeddedWallet = privy.user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && 'walletClientType' in a && a.walletClientType === 'privy',
  ) as { address: string } | undefined

  const { data: usdcBalance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: connectedAddress ? [connectedAddress] : undefined,
    chainId: EARMARK_CHAIN_ID,
    query: { enabled: !!connectedAddress, refetchInterval: 15_000 },
  })

  // ── QR code state ──
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  async function handleShowQr() {
    if (!connectedAddress) return
    if (!qrDataUrl) {
      const url = await QRCode.toDataURL(connectedAddress, { width: 200, margin: 2 })
      setQrDataUrl(url)
    }
    setShowQr((v) => !v)
  }

  // ── Send USDC out ──
  const [sendTo, setSendTo] = useState('')
  const [sendAmount, setSendAmount] = useState('')
  const [sendErrors, setSendErrors] = useState<Record<string, string>>({})
  const [sendPhase, setSendPhase] = useState<'idle' | 'awaiting' | 'waiting' | 'done' | 'failed'>('idle')
  const [sendTxHash, setSendTxHash] = useState<`0x${string}` | undefined>()
  const [sendTxError, setSendTxError] = useState<string | undefined>()

  const maxSendable = usdcBalance !== undefined && usdcBalance > GAS_RESERVE
    ? usdcBalance - GAS_RESERVE
    : 0n

  const handleSend = useCallback(async () => {
    const errs: Record<string, string> = {}
    const toTrimmed = sendTo.trim()
    if (!isAddress(toTrimmed)) errs.to = 'Enter a valid wallet address.'
    if (!isValidUsdcAmount(sendAmount)) errs.amount = 'Enter an amount greater than zero.'
    else {
      const amt = parseUsdc(sendAmount)
      if (amt > maxSendable) errs.amount = `Maximum sendable is ${formatUsdc(maxSendable)} USDC (0.02 reserved for gas).`
    }
    setSendErrors(errs)
    if (Object.keys(errs).length) return

    setSendPhase('awaiting')
    setSendTxHash(undefined)
    setSendTxError(undefined)

    try {
      const toAddr = getAddress(sendTo.trim())
      const amt = parseUsdc(sendAmount)
      const hash = await writeContract(config, {
        address: USDC_ADDRESS,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [toAddr, amt],
        chainId: EARMARK_CHAIN_ID,
      })
      setSendTxHash(hash)
      setSendPhase('waiting')
      await waitForTransactionReceipt(config, { hash, chainId: EARMARK_CHAIN_ID })
      setSendPhase('done')
      toast.success('USDC sent!')
      void refetchBalance()
      setSendAmount('')
      setSendTo('')
    } catch (err) {
      setSendPhase('failed')
      const msg = err instanceof Error ? err.message : String(err)
      setSendTxError(msg.includes('rejected') || msg.includes('4001') ? 'You cancelled in your wallet.' : 'Transaction failed. Try again.')
    }
  }, [sendTo, sendAmount, maxSendable, refetchBalance])

  const sendActionState: ActionState =
    sendPhase === 'awaiting' ? 'awaitingSignature' :
    sendPhase === 'waiting'  ? 'submitted' :
    sendPhase === 'done'     ? 'confirmed' :
    sendPhase === 'failed'   ? 'failed' :
    'idle'

  // ── Export key warning ──
  const [showExportWarning, setShowExportWarning] = useState(false)

  function handleExport() {
    if (!embeddedWallet?.address) return
    void exportWallet({ address: embeddedWallet.address }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      toast.error(msg.includes('cancel') || msg.includes('4001') ? 'Cancelled.' : 'Export failed. Try again.')
    })
  }

  // ── Not ready ──
  if (!ready) {
    if (timedOut) {
      return (
        <PageShell onBack={onBack}>
          <Card padding="lg" className="text-center space-y-4">
            <h1 className="text-xl font-semibold text-[var(--ink)]">My Earmark wallet</h1>
            <p className="text-sm text-[var(--ink-2)]">
              Couldn't reach the sign-in service. Refresh the page, or connect a wallet instead.
            </p>
            <Button size="md" variant="secondary" className="w-full" onClick={onBack}>Go home</Button>
          </Card>
        </PageShell>
      )
    }
    return (
      <PageShell onBack={onBack}>
        <div className="flex justify-center py-12 text-[var(--muted)] text-sm">Loading…</div>
      </PageShell>
    )
  }

  if (!privy.authenticated) {
    return (
      <PageShell onBack={onBack}>
        <Card padding="lg" className="text-center space-y-4">
          <h1 className="text-xl font-semibold text-[var(--ink)]">My Earmark wallet</h1>
          <p className="text-sm text-[var(--ink-2)]">
            This wallet belongs to your email. Money sent to your email — even before you joined — is already here.
          </p>
          <Button size="lg" className="w-full" onClick={onSignIn}>Sign in</Button>
        </Card>
      </PageShell>
    )
  }

  const email = (privy.user?.email as { address?: string } | null | undefined)?.address ?? null
  const displayName = email ?? (connectedAddress ? shortAddr(connectedAddress) : 'Your wallet')

  return (
    <PageShell onBack={onBack}>
      <h1 className="text-xl font-semibold text-[var(--ink)] mb-6">My Earmark wallet</h1>

      {/* ── Identity + address ── */}
      <Card padding="lg" className="space-y-4 mb-4">
        {email && (
          <div>
            <p className="text-xs text-[var(--muted)] mb-0.5">Email</p>
            <p className="text-sm font-medium text-[var(--ink)]">{email}</p>
          </div>
        )}

        <div>
          <p className="text-xs text-[var(--muted)] mb-1">Wallet address</p>
          {connectedAddress ? (
            <div className="space-y-2">
              <p className="font-mono text-sm text-[var(--ink)] break-all tracking-wide">
                {connectedAddress.match(/.{1,4}/g)?.join(' ')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => { void navigator.clipboard.writeText(connectedAddress); toast.success('Address copied!') }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
                >
                  <Copy className="size-3.5" aria-hidden /> Copy
                </button>
                <button
                  onClick={() => void handleShowQr()}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
                >
                  <QrCode className="size-3.5" aria-hidden /> {showQr ? 'Hide QR' : 'Show QR'}
                </button>
                <a
                  href={`${EARMARK_CHAIN.explorerBase}/address/${connectedAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
                >
                  <ExternalLink className="size-3.5" aria-hidden /> Explorer
                </a>
              </div>
              {showQr && qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt={`QR code for wallet ${connectedAddress}`}
                  className="mx-auto rounded-lg border border-[var(--line)] p-2 bg-white"
                  width={200}
                  height={200}
                />
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Connecting…</p>
          )}
        </div>

        <div>
          <p className="text-xs text-[var(--muted)] mb-0.5">USDC balance</p>
          <p className="text-2xl font-semibold text-[var(--ink)]">
            {usdcBalance !== undefined ? formatUsdc(usdcBalance) : '—'} <span className="text-base text-[var(--muted)]">USDC</span>
          </p>
        </div>

        <p className="text-xs text-[var(--muted)]">
          This wallet belongs to your email. Money sent to your email — even before you joined — is already here.
        </p>
      </Card>

      {/* ── Send USDC out ── */}
      <Card padding="lg" className="space-y-4 mb-4">
        <div className="flex items-center gap-2">
          <Send className="size-4 text-[var(--accent)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--ink)]">Send USDC out</h2>
        </div>
        <p className="text-xs text-[var(--muted)]">Send to your own wallet or an exchange. Network fees are paid in USDC; 0.02 USDC is reserved for gas.</p>

        <Field label="Recipient address" error={sendErrors.to}>
          {({ id, ...rest }) => (
            <input
              id={id}
              {...rest}
              value={sendTo}
              onChange={(e) => { setSendTo(e.target.value); setSendErrors((er) => { const n = { ...er }; delete n.to; return n }) }}
              placeholder="0x…"
              className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm font-mono text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
              autoComplete="off"
              spellCheck={false}
            />
          )}
        </Field>

        <Field label="Amount (USDC)" error={sendErrors.amount}>
          {(fieldProps) => (
            <AmountInput
              {...fieldProps}
              value={sendAmount}
              onChange={(v) => { setSendAmount(v); setSendErrors((er) => { const n = { ...er }; delete n.amount; return n }) }}
              balance={maxSendable}
            />
          )}
        </Field>

        {sendPhase !== 'idle' && (
          <TxStatus state={sendActionState} txHash={sendTxHash} errorMessage={sendTxError} />
        )}

        {sendPhase !== 'done' && (
          <Button
            size="md"
            className="w-full"
            onClick={() => void handleSend()}
            disabled={sendPhase === 'awaiting' || sendPhase === 'waiting'}
          >
            Send USDC
          </Button>
        )}
        {sendPhase === 'done' && (
          <Button size="md" variant="secondary" className="w-full" onClick={() => setSendPhase('idle')}>
            Send again
          </Button>
        )}
      </Card>

      {/* ── Export private key — only for Privy embedded wallets ── */}
      {embeddedWallet && (
        <Card padding="lg" className="space-y-3 mb-4">
          <div className="flex items-center gap-2">
            <Download className="size-4 text-[var(--muted)]" aria-hidden />
            <h2 className="text-sm font-semibold text-[var(--ink)]">Export private key</h2>
          </div>

          {!showExportWarning ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowExportWarning(true)}
            >
              Show export option
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2 rounded-card border border-[#F5C6C3] bg-[#FDECEC] p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
                <p className="text-xs text-danger leading-relaxed">
                  <strong>Anyone with this key controls your money.</strong> Never share it with anyone.
                  Only export it to import into a wallet app you trust.
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleExport}
              >
                Export private key
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* ── Sign out ── */}
      <div className="text-center">
        <button
          onClick={() => { void privy.logout() }}
          className="text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
        >
          Sign out ({displayName})
        </button>
      </div>
    </PageShell>
  )
}

function PageShell({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <main className="mx-auto max-w-content px-4 pb-32 pt-6 md:pb-16">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
      >
        <ArrowLeft className="size-4" aria-hidden /> Back
      </button>
      {children}
    </main>
  )
}
