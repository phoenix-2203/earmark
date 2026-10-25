/**
 * ConfirmPayeePage — #/confirm-payee?r=<base64url>
 *
 * The payee opens this link, connects their wallet, and signs a free message
 * (no gas, no money moves) to prove they control the wallet.
 * After signing they get a reply link to send back to the funder.
 */

import { useState } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount, useSignMessage } from 'wagmi'
import { AlertTriangle, CheckCircle2, Copy, Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  decodeRequest, buildConfirmMessage, isRequestExpired, encodeRequest, formatCode,
} from '@/lib/confirmPayee'
import { shortAddr } from '@/utils/format'

// ─── Helper: parse ?r= from the current URL hash ─────────────────────────────

function getEncodedFromHash(): string | null {
  const search = window.location.hash.split('?')[1] ?? ''
  const params = new URLSearchParams(search)
  return params.get('r')
}

// ─── Address display: grouped in 4s ──────────────────────────────────────────

function GroupedAddress({ address }: { address: string }) {
  return (
    <div
      className="font-mono text-lg font-semibold text-[var(--ink)] tracking-wider break-all text-center leading-relaxed"
      aria-label={address}
    >
      {address.match(/.{1,4}/g)?.join('\u00A0') ?? address}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ConfirmPayeePage() {
  const encoded = getEncodedFromHash()
  const req = encoded ? decodeRequest(encoded) : null
  const { address: connectedAddress, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [signing, setSigning] = useState(false)
  const [replyLink, setReplyLink] = useState<string | null>(null)
  const [signError, setSignError] = useState<string | null>(null)

  // ── Bad link ──
  if (!encoded || !req) {
    return (
      <PageShell>
        <AlertTriangle className="mx-auto mb-3 size-10 text-[var(--warning)]" />
        <h1 className="mb-2 text-xl font-semibold text-[var(--ink)]">Invalid link</h1>
        <p className="text-sm text-[var(--ink-2)]">This link is not valid. Ask the person who sent it to share it again.</p>
      </PageShell>
    )
  }

  // ── Expired link ──
  if (isRequestExpired(req)) {
    return (
      <PageShell>
        <AlertTriangle className="mx-auto mb-3 size-10 text-[var(--warning)]" />
        <h1 className="mb-2 text-xl font-semibold text-[var(--ink)]">This link has expired</h1>
        <p className="text-sm text-[var(--ink-2)]">This link has expired — ask for a new one.</p>
      </PageShell>
    )
  }

  // ── Wrong wallet connected ──
  const wrongWallet =
    isConnected &&
    connectedAddress &&
    connectedAddress.toLowerCase() !== req.payee.toLowerCase()

  // ── Success: show reply link ──
  if (replyLink) {
    return (
      <PageShell>
        <CheckCircle2 className="mx-auto mb-3 size-10 text-[var(--success)]" />
        <h1 className="mb-2 text-xl font-semibold text-[var(--ink)]">Done!</h1>
        <p className="mb-4 text-sm text-[var(--ink-2)]">
          Send this link back to the person who asked you. Use the same channel they used to contact you.
        </p>
        <div className="mb-4 rounded-input bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs break-all text-[var(--ink)]">
          {replyLink}
        </div>
        <div className="flex flex-wrap gap-3 justify-center">
          <Button
            onClick={() => {
              void navigator.clipboard.writeText(replyLink)
              toast.success('Reply link copied!')
            }}
          >
            <Copy className="size-4" aria-hidden /> Copy reply link
          </Button>
          {typeof navigator.share === 'function' && (
            <Button
              variant="secondary"
              onClick={() => {
                void navigator.share({ title: 'Earmark payee confirmation', url: replyLink })
              }}
            >
              <Share2 className="size-4" aria-hidden /> Share
            </Button>
          )}
        </div>
      </PageShell>
    )
  }

  // ── Main confirm flow ──
  async function handleSign() {
    if (!isConnected || !connectedAddress) return
    setSigning(true)
    setSignError(null)
    try {
      const message = buildConfirmMessage(req!)
      const sig = await signMessageAsync({ message })
      const replyEncoded = encodeRequest(req!)
      const link = `${window.location.origin}/#/payee-confirmed?r=${replyEncoded}&s=${encodeURIComponent(sig)}`
      setReplyLink(link)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      const lower = msg.toLowerCase()
      if (lower.includes('user rejected') || lower.includes('4001') || lower.includes('denied')) {
        setSignError('You cancelled the signing. Nothing was sent.')
      } else {
        setSignError('Signing failed — please try again.')
      }
    } finally {
      setSigning(false)
    }
  }

  return (
    <PageShell>
      <div className="mb-6 text-center">
        <p className="mb-1 text-sm text-[var(--muted)]">Wallet confirmation request</p>
        <h1 className="text-xl font-semibold text-[var(--ink)] text-balance">
          {shortAddr(req.funder)} wants to pay <span className="text-[var(--accent)]">{req.name}</span>
        </h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          from the Earmark pot{' '}
          <span className="font-medium text-[var(--ink)]">'{req.purpose}'</span>
        </p>
      </div>

      <Card padding="md" className="mb-5 space-y-3 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">
          Confirm this wallet is yours
        </p>
        <p className="text-xs text-[var(--ink-2)] text-pretty">
          It's free — no money moves. You're just proving you control this wallet.
        </p>
        <GroupedAddress address={req.payee} />
        <div className="mx-auto inline-flex items-center gap-2 rounded-full bg-[var(--surface-2)] px-4 py-1.5">
          <span className="text-xs text-[var(--muted)]">Code:</span>
          <span className="font-mono text-sm font-bold tracking-widest text-[var(--ink)]">
            {formatCode(req.code)}
          </span>
        </div>
      </Card>

      {!isConnected && (
        <div className="mb-4 text-center">
          <p className="mb-3 text-sm text-[var(--ink-2)]">
            Connect the wallet <span className="font-mono font-semibold">{shortAddr(req.payee)}</span> to continue.
          </p>
          <ConnectKitButton />
        </div>
      )}

      {wrongWallet && connectedAddress && (
        <div className="mb-4 rounded-card border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm text-[var(--ink-2)]">
          <p>
            <strong>This link is for wallet {shortAddr(req.payee)}</strong>{'; '}
            you're connected with {shortAddr(connectedAddress)}.
            Switch wallets to continue.
          </p>
        </div>
      )}

      {signError && (
        <p role="alert" className="mb-3 text-sm text-[var(--danger)]">{signError}</p>
      )}

      {isConnected && !wrongWallet && (
        <Button
          size="lg"
          className="w-full"
          loading={signing}
          loadingLabel="Waiting for signature…"
          onClick={() => void handleSign()}
        >
          Confirm with my wallet
        </Button>
      )}

      <p className="mt-4 text-center text-xs text-[var(--muted)]">
        Signing is free. Nothing is sent. Only send the reply link back to the person who contacted you directly.
      </p>
    </PageShell>
  )
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-[var(--bg)]">
      <div className="w-full max-w-[440px]">
        <p className="mb-6 text-center font-display text-base font-semibold text-[var(--ink)]">Earmark</p>
        {children}
      </div>
    </div>
  )
}
