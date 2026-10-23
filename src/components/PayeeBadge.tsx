/**
 * PayeeBadge — shows the verification status of a payee.
 *
 * Priority order:
 *   1. confirmed-by-payee (stored in this browser by the funder)
 *   2. pending (a confirm request has been sent but reply not yet received)
 *   3. domain check (if a domain is stored with the payee)
 *   4. neither (prompt to confirm)
 *
 * For confirmed/pending states, pass `funder` (the connected funder address).
 * Without `funder` these states are never shown (other browsers see domain status).
 *
 * Uses text + icon (never colour alone) for accessibility.
 */
import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield, Loader2, BadgeCheck, Clock } from 'lucide-react'
import { usePayeeVerification } from '@/lib/verifyPayee'
import { getConfirmedPayee, hasPendingRequest } from '@/lib/confirmPayee'
import { formatDate } from '@/utils/format'

interface Props {
  domain?:    string | undefined
  address:    string
  /** Funder address — when provided, confirmed/pending states are shown. */
  funder?:    `0x${string}`
  onRetry?:   () => void
  className?: string
}

export default function PayeeBadge({ domain, address, funder, onRetry, className = '' }: Props) {
  // 1. Check confirmed-by-payee (synchronous localStorage read)
  const confirmed = funder ? getConfirmedPayee(funder, address as `0x${string}`) : null
  if (confirmed) {
    const dateStr = formatDate(BigInt(confirmed.at))
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs font-medium text-[var(--success)] ${className}`}
        title={`Wallet owner signed to confirm on ${dateStr}`}
      >
        <BadgeCheck className="size-3.5 shrink-0" aria-hidden />
        Confirmed by the wallet owner — you asked them directly ({dateStr})
      </span>
    )
  }

  // 2. Pending confirm request (synchronous localStorage read)
  const pending = funder ? hasPendingRequest(funder, address as `0x${string}`) : false
  if (pending) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-[var(--muted)] ${className}`}>
        <Clock className="size-3.5 shrink-0" aria-hidden />
        Waiting for the payee to confirm
      </span>
    )
  }

  // 3. Domain verification (hook — only if domain is set)
  return <DomainBadge domain={domain} address={address} funder={funder} onRetry={onRetry} className={className} />
}

// ─── Domain badge (inner) ─────────────────────────────────────────────────────

function DomainBadge({ domain, address, funder, onRetry, className = '' }: {
  domain?: string; address: string; funder?: `0x${string}`; onRetry?: () => void; className?: string
}) {
  const { result, loading } = usePayeeVerification(domain ?? '', address)

  if (!domain) {
    // No domain, no confirmation from this browser → generic prompt (only for funder)
    if (!funder) return null
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-[var(--muted)] ${className}`}>
        <Shield className="size-3.5 shrink-0" aria-hidden />
        Not verified — ask the payee to confirm before approving
      </span>
    )
  }

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-[var(--muted)] ${className}`}>
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        Checking {domain}…
      </span>
    )
  }

  if (!result) return null

  switch (result.status) {
    case 'verified':
      return (
        <>
          <span
            className={`inline-flex items-center gap-1 text-xs font-medium text-[var(--success)] ${className}`}
            title={`DNS TXT record on ${domain} matches this wallet`}
          >
            <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
            Verified by <strong className="font-semibold">{domain}</strong>
          </span>
          {funder && (
            <span className="block text-xs text-[var(--muted)] mt-0.5 ml-4">
              Make sure {domain} is the payee's official website.
            </span>
          )}
        </>
      )

    case 'verified-free-host':
      return (
        <>
          <span
            className={`inline-flex flex-wrap items-center gap-1 text-xs font-medium text-[var(--warning)] ${className}`}
            title={`${domain} confirms this wallet, but it's a free hosting service`}
          >
            <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
            <strong className="font-semibold">{domain}</strong>{' '}confirms this wallet, but{' '}
            <strong className="font-semibold">{result.host}</strong>{' '}gives free addresses to anyone — not proof of a real business.
          </span>
        </>
      )

    case 'mismatch': {
      const others = result.otherAddresses
        .map((a) => `${a.slice(0, 6)}…${a.slice(-4)}`)
        .join(', ')
      return (
        <span
          className={`inline-flex flex-wrap items-center gap-1 text-xs font-medium text-[var(--danger)] ${className}`}
          title={`${domain} lists a different wallet address`}
        >
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
          <strong className="font-semibold">{domain}</strong>{' '}
          lists a different wallet ({others}). Don't pay this address.
        </span>
      )
    }

    case 'no-record':
      return (
        <span
          className={`inline-flex items-center gap-1 text-xs text-[var(--warning)] ${className}`}
          title={`No earmark= DNS record found on ${domain}`}
        >
          <ShieldQuestion className="size-3.5 shrink-0" aria-hidden />
          <strong className="font-semibold">{domain}</strong>{' '}
          hasn't confirmed this wallet
        </span>
      )

    case 'error':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-[var(--muted)] ${className}`}>
          <Shield className="size-3.5 shrink-0" aria-hidden />
          Couldn't check {domain} right now
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 underline hover:no-underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded text-xs"
            >
              Retry
            </button>
          )}
        </span>
      )

    case 'invalid-domain':
      return (
        <span className={`inline-flex items-center gap-1 text-xs text-[var(--danger)] ${className}`}>
          <ShieldAlert className="size-3.5 shrink-0" aria-hidden />
          {result.message}
        </span>
      )
  }
}
