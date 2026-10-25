/**
 * SignInButton — Privy-aware authentication button.
 *
 * - PRIVY_ENABLED=false: renders ConnectKitButton unchanged.
 * - PRIVY_ENABLED=true, not signed in: "Sign in" button (opens Privy modal).
 * - PRIVY_ENABLED=true, signed in: dropdown menu with email/address, "My wallet",
 *   "Sign out".
 */

import { useState, useRef, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import { ChevronDown, Wallet, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { PRIVY_ENABLED, usePrivyReady } from '@/lib/privy'
import { shortAddr } from '@/utils/format'
// usePrivy is imported unconditionally; we only call it inside PrivySignInButton
// which is only rendered when PRIVY_ENABLED is true.
import { usePrivy } from '@privy-io/react-auth'

interface Props {
  onWallet: () => void
}

/** Always ConnectKit when Privy is not configured. When Privy is configured,
 *  delegates to PrivySignInButton which can call usePrivy unconditionally. */
export default function SignInButton({ onWallet }: Props) {
  if (!PRIVY_ENABLED) {
    return <ConnectKitButton />
  }
  return <PrivySignInButton onWallet={onWallet} />
}

/** Inner component — only rendered when PRIVY_ENABLED, so usePrivy is
 *  always called unconditionally here (no rules-of-hooks violation). */
function PrivySignInButton({ onWallet }: Props) {
  const { ready, timedOut } = usePrivyReady()
  const { authenticated, login, logout, user } = usePrivy()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  if (!ready) {
    if (timedOut) {
      return (
        <span className="text-xs text-[var(--warning)]">
          Couldn't reach the sign-in service. Refresh the page, or{' '}
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button
                onClick={show}
                className="underline text-[var(--accent)] hover:no-underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              >
                connect a wallet instead
              </button>
            )}
          </ConnectKitButton.Custom>
          .
        </span>
      )
    }
    return (
      <div className="h-9 w-20 animate-pulse rounded-input bg-[var(--surface-2)]" aria-label="Loading…" />
    )
  }

  if (!authenticated) {
    return (
      <Button size="sm" onClick={login}>
        Sign in
      </Button>
    )
  }

  const email = user?.email?.address ?? null
  const embeddedWallet = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && (
      ('walletClientType' in a && a.walletClientType === 'privy') ||
      ('connectorType' in a && (a as { connectorType?: string }).connectorType === 'embedded')
    ),
  )
  const walletAddr = embeddedWallet && 'address' in embeddedWallet ? (embeddedWallet as { address?: string }).address : undefined
  const displayName = email ?? (walletAddr ? shortAddr(walletAddr) : 'Wallet')

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 rounded-input border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
      >
        <span className="max-w-[140px] truncate">{displayName}</span>
        <ChevronDown className={`size-3.5 text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-1 w-52 rounded-card border border-[var(--line)] bg-[var(--surface)] shadow-lg py-1 z-50"
        >
          {email && (
            <div className="px-4 py-2 text-xs text-[var(--muted)] truncate border-b border-[var(--line)] mb-1">
              {email}
            </div>
          )}
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onWallet() }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
          >
            <Wallet className="size-4" aria-hidden /> My wallet
          </button>
          <button
            role="menuitem"
            onClick={() => { setOpen(false); void logout() }}
            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
