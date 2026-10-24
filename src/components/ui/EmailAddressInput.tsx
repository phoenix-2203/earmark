/**
 * EmailAddressInput — enhanced address field that also accepts email.
 *
 * If the user types something containing "@":
 *  - Not signed in (Privy mode): shows "Sign in to pay by email"
 *  - Signed in: debounces 600ms, calls /api/payee-wallet, fills the resolved address
 *
 * Always submits a 0x address to onChange — the contract never sees an email.
 *
 * For 0x addresses: behaves identically to AddressInput (parseChecksumAddress).
 */

import { useState, useRef, useEffect } from 'react'
import { ClipboardPaste, Loader2 } from 'lucide-react'
import { usePrivy } from '@privy-io/react-auth'
import { parseChecksumAddress, shortAddr } from '@/utils/format'
import { PRIVY_ENABLED } from '@/lib/privy'
import { isEmail, lookupPayeeWallet, storeEmailPayee } from '@/lib/emailPayee'
import type { PayeeWalletResponse } from '@/lib/emailPayee'

export interface EmailAddressResult {
  raw: string
  checksummed: `0x${string}` | null
  /** Set when the address was resolved from an email lookup */
  emailData?: PayeeWalletResponse
}

interface Props {
  id?: string
  value: string
  onChange: (result: EmailAddressResult) => void
  placeholder?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  disabled?: boolean
  className?: string
  /** Connected funder address — for caching resolved email→address */
  funder?: `0x${string}`
  label?: string
}

// Intentional: usePrivy is always called (rules-of-hooks safe).
// When there is no PrivyProvider the hook returns ready:false / authenticated:false.

// ─── Hook ────────────────────────────────────────────────────────────────────
function useEmailLookup(
  value: string,
  getAccessToken: (() => Promise<string | null>) | null,
  onResolved: (data: PayeeWalletResponse) => void,
  onError: (msg: string) => void,
  funder?: `0x${string}`,
) {
  const [lookingUp, setLookingUp] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEmailRef = useRef<string>('')

  useEffect(() => {
    if (!isEmail(value)) {
      setLookingUp(false)
      lastEmailRef.current = ''
      return
    }
    const email = value.trim().toLowerCase()
    if (email === lastEmailRef.current) return

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (!getAccessToken) return  // not signed in
      void (async () => {
        lastEmailRef.current = email
        setLookingUp(true)
        try {
          const result = await lookupPayeeWallet(email, getAccessToken)
          if (result.ok) {
            if (funder) storeEmailPayee(funder, result.data.address, email)
            onResolved(result.data)
          } else {
            onError(result.error)
          }
        } finally {
          setLookingUp(false)
        }
      })()
    }, 600)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, getAccessToken])

  return { lookingUp }
}

// ─── Component ───────────────────────────────────────────────────────────────
export function EmailAddressInput({
  id,
  value,
  onChange,
  placeholder = 'Wallet address or email',
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  disabled,
  className = '',
  funder,
}: Props) {
  // usePrivy must be called unconditionally (rules-of-hooks).
  // Outside a PrivyProvider it returns authenticated:false, so getAccessToken is unused.
  const { getAccessToken, authenticated } = usePrivy()
  const effectiveGetToken: (() => Promise<string | null>) | null =
    PRIVY_ENABLED && authenticated ? getAccessToken : null

  const [emailError, setEmailError] = useState<string | null>(null)
  const [resolvedData, setResolvedData] = useState<PayeeWalletResponse | null>(null)

  // Reset resolved/error state when value is cleared or changed to a non-email.
  // Intentional: syncs derived display state to an external controlled prop.
  // eslint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    if (!value || !isEmail(value)) {
      setResolvedData(null) // eslint-disable-line react/set-state-in-effect
      setEmailError(null) // eslint-disable-line react/set-state-in-effect
    }
  }, [value])

  const { lookingUp } = useEmailLookup(
    value,
    effectiveGetToken,
    (data) => {
      setResolvedData(data)
      setEmailError(null)
      onChange({ raw: value, checksummed: data.address, emailData: data })
    },
    (msg) => {
      setEmailError(msg)
      setResolvedData(null)
    },
    funder,
  )

  function handleChange(raw: string) {
    setResolvedData(null)
    setEmailError(null)
    if (isEmail(raw)) {
      onChange({ raw, checksummed: null, emailData: undefined })
    } else {
      onChange({ raw, checksummed: parseChecksumAddress(raw) })
    }
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      handleChange(trimmed)
    } catch { /* clipboard access denied */ }
  }

  const showEmailPath = isEmail(value)
  const notSignedIn = showEmailPath && PRIVY_ENABLED && !effectiveGetToken

  return (
    <div className="space-y-1.5">
      <div className="relative flex items-center">
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="off"
          spellCheck={false}
          inputMode={showEmailPath ? 'email' : 'text'}
          className={`w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-50 pr-10 ${!showEmailPath ? 'font-mono' : ''} ${className}`}
        />
        {lookingUp ? (
          <Loader2 className="absolute right-2.5 size-4 animate-spin text-[var(--muted)]" aria-label="Looking up email…" />
        ) : (
          <button
            type="button"
            onClick={() => void handlePaste()}
            aria-label="Paste from clipboard"
            className="absolute right-2 rounded p-1 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] min-w-[28px] min-h-[28px] flex items-center justify-center"
          >
            <ClipboardPaste className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Sign-in prompt */}
      {notSignedIn && (
        <SignInToLookup />
      )}

      {/* Resolved address */}
      {resolvedData && (
        <div className="flex items-center gap-2 rounded-input bg-[var(--accent-soft)] px-3 py-2">
          <span className="text-xs text-[var(--muted)]">Resolved to</span>
          <span className="font-mono text-xs text-[var(--ink)] font-medium">{shortAddr(resolvedData.address)}</span>
          <button
            type="button"
            onClick={() => { void navigator.clipboard.writeText(resolvedData.address) }}
            className="text-xs text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
          >
            Copy
          </button>
        </div>
      )}

      {/* Error */}
      {emailError && !notSignedIn && (
        <p className="text-xs text-danger">{emailError}</p>
      )}

      {/* New wallet invite */}
      {resolvedData?.created && (
        <div className="rounded-input bg-[var(--surface-2)] px-3 py-2 space-y-1.5">
          <p className="text-xs text-[var(--muted)]">
            New wallet created for this email. Tell them to sign in at{' '}
            <strong className="font-medium">{window.location.origin}/#/wallet</strong>{' '}
            with this email to see it.
          </p>
          <button
            type="button"
            onClick={() => {
              const msg = `I've set up a payment to you on Earmark. Sign in at ${window.location.origin}/#/wallet with ${resolvedData.email} — use 'Continue with email' or Google with this same address.`
              void navigator.clipboard.writeText(msg)
              // toast imported lazily to avoid circular dep
              import('sonner').then(({ toast }) => toast.success('Invite text copied!')).catch(() => {/* ignore */})
            }}
            className="text-xs font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
          >
            Copy invite
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Sign-in prompt ───────────────────────────────────────────────────────────
function SignInToLookup() {
  // Navigate to the wallet page where Sign In is available.
  // We can't call usePrivy().login here because this component may be rendered
  // outside a Privy-aware context; the wallet page always has the Sign In button.
  function handleSignIn() {
    window.location.hash = '/wallet'
  }

  return (
    <p className="text-xs text-[var(--muted)]">
      <button
        type="button"
        onClick={handleSignIn}
        className="text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded font-medium"
      >
        Sign in
      </button>
      {' '}to pay by email
    </p>
  )
}
