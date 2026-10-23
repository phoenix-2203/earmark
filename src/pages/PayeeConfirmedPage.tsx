/**
 * PayeeConfirmedPage — #/payee-confirmed?r=<base64url>&s=<sig>
 *
 * The funder opens the reply link the payee sent back.
 * We verify the signature via publicClient.verifyMessage (supports ERC-1271 SCAs),
 * then check: not expired, chainId matches, funder === connected wallet,
 * and code exists in this browser's earmark.confirmRequests.
 *
 * On success, store the confirmation in earmark.confirmedPayees.
 */

import { useState, useEffect, useRef } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { CheckCircle2, AlertTriangle, Loader2, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import {
  decodeRequest, formatCode, verifyReply, type ConfirmRequest,
} from '@/lib/confirmPayee'
import { shortAddr } from '@/utils/format'

// ─── Parse ?r= and ?s= from hash query ───────────────────────────────────────

function getParams(): { encoded: string | null; sig: string | null } {
  const search = window.location.hash.split('?')[1] ?? ''
  const params = new URLSearchParams(search)
  return { encoded: params.get('r'), sig: params.get('s') }
}

// ─── Verify result type ───────────────────────────────────────────────────────

type VerifyStatus =
  | { ok: true;  stored: ConfirmRequest }
  | { ok: false; reason: string }

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  onBack?: () => void
}

export default function PayeeConfirmedPage({ onBack }: Props) {
  const { encoded, sig } = getParams()
  const req = encoded ? decodeRequest(encoded) : null
  const { address: connectedAddress, isConnected } = useAccount()
  const [status, setStatus] = useState<VerifyStatus | null>(null)
  const [verifying, setVerifying] = useState(false)
  // Guard so auto-verify fires at most once per mount even in Strict Mode double-invoke.
  const hasVerifiedRef = useRef(false)

  // Auto-verify as soon as the wallet is connected and we have both params.
  // The async work is inside the effect; we keep state updates in the closure
  // to satisfy the lint rule (no sync setState in effect body).
  useEffect(() => {
    if (!isConnected || !connectedAddress || !encoded || !sig) return
    if (hasVerifiedRef.current) return
    hasVerifiedRef.current = true

    let cancelled = false
    setVerifying(true)

    verifyReply(encoded, sig, connectedAddress)
      .then((result) => {
        if (cancelled) return
        setStatus(result)
        if (result.ok) toast.success('Payee confirmed!')
      })
      .catch(() => {
        if (!cancelled) {
          setStatus({ ok: false, reason: "Couldn't verify — check your connection and try again." })
        }
      })
      .finally(() => {
        if (!cancelled) setVerifying(false)
      })

    return () => { cancelled = true }
  // Encoded + sig come from the URL and never change; connectedAddress/isConnected can.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, connectedAddress])

  /** Manual retry (shown on the connected-but-not-yet-verified fallback screen). */
  function handleVerify() {
    if (!encoded || !sig || !connectedAddress) return
    hasVerifiedRef.current = false
    setStatus(null)
    setVerifying(true)

    verifyReply(encoded, sig, connectedAddress)
      .then((result) => {
        setStatus(result)
        if (result.ok) toast.success('Payee confirmed!')
      })
      .catch(() => {
        setStatus({ ok: false, reason: "Couldn't verify — check your connection and try again." })
      })
      .finally(() => { setVerifying(false) })
  }

  // ── Bad link ──
  if (!encoded || !sig || !req) {
    return (
      <PageShell onBack={onBack}>
        <AlertTriangle className="mx-auto mb-3 size-10 text-[var(--warning)]" />
        <h1 className="mb-2 text-xl font-semibold text-[var(--ink)]">Invalid link</h1>
        <p className="text-sm text-[var(--ink-2)]">This link is not valid or is missing the signature.</p>
      </PageShell>
    )
  }

  // ── Success ──
  if (status?.ok) {
    const { stored } = status
    return (
      <PageShell onBack={onBack}>
        <CheckCircle2 className="mx-auto mb-3 size-10 text-[var(--success)]" />
        <h1 className="mb-2 text-xl font-semibold text-[var(--ink)]">Payee confirmed</h1>
        <Card padding="md" className="mb-5 space-y-2.5">
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--muted)]">Name</span>
            <span className="text-sm font-semibold text-[var(--ink)]">{stored.name}</span>
          </div>
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <span className="text-xs text-[var(--muted)]">Wallet</span>
            <span className="font-mono text-xs text-[var(--ink)] break-all">{stored.payee}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-xs text-[var(--muted)]">Code</span>
            <span className="font-mono text-sm font-bold tracking-widest text-[var(--ink)]">{formatCode(stored.code)}</span>
          </div>
        </Card>
        <p className="mb-4 text-sm text-[var(--ink-2)] text-pretty">
          The wallet owner signed to prove they control this address. You can now add them as a payee.
          The confirmation is stored in this browser.
        </p>
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
        )}
      </PageShell>
    )
  }

  // ── Failure ──
  if (status && !status.ok) {
    return (
      <PageShell onBack={onBack}>
        <AlertTriangle className="mx-auto mb-3 size-10 text-[var(--warning)]" />
        <h1 className="mb-2 text-xl font-semibold text-[var(--ink)]">Can't accept this confirmation</h1>
        <p className="mb-4 text-sm text-[var(--ink-2)]">{status.reason}</p>
        {onBack && (
          <Button variant="secondary" onClick={onBack}>
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Button>
        )}
      </PageShell>
    )
  }

  // ── Waiting for wallet ──
  if (!isConnected) {
    return (
      <PageShell onBack={onBack}>
        <h1 className="mb-4 text-xl font-semibold text-[var(--ink)] text-center">
          Verify payee confirmation
        </h1>
        <Card padding="md" className="mb-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Confirmation for</p>
          <p className="text-sm font-semibold text-[var(--ink)]">{req.name}</p>
          <p className="font-mono text-xs text-[var(--ink-2)] break-all">{req.payee}</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--muted)]">Code:</span>
            <span className="font-mono text-sm font-bold tracking-widest">{formatCode(req.code)}</span>
          </div>
        </Card>
        <p className="mb-4 text-sm text-[var(--ink-2)]">
          Connect the wallet <span className="font-mono font-semibold">{shortAddr(req.funder)}</span> (the one you used to ask for this confirmation) to verify it.
        </p>
        <ConnectKitButton />
      </PageShell>
    )
  }

  // ── Verifying ──
  if (verifying) {
    return (
      <PageShell onBack={onBack}>
        <Loader2 className="mx-auto mb-3 size-10 animate-spin text-[var(--accent)]" />
        <p className="text-sm text-[var(--ink-2)]">Verifying signature…</p>
      </PageShell>
    )
  }

  // ── Connected but not yet verified (shouldn't stay here long) ──
  return (
    <PageShell onBack={onBack}>
      <h1 className="mb-4 text-xl font-semibold text-[var(--ink)] text-center">Verify payee confirmation</h1>
      <Button size="lg" className="w-full" onClick={handleVerify}>
        Verify
      </Button>
    </PageShell>
  )
}

function PageShell({ children, onBack }: { children: React.ReactNode; onBack?: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 bg-[var(--bg)]">
      <div className="w-full max-w-[440px]">
        <div className="mb-6 flex items-center justify-between">
          <p className="font-display text-base font-semibold text-[var(--ink)]">Earmark</p>
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
            >
              <ArrowLeft className="size-4 inline" aria-hidden /> Back
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}
