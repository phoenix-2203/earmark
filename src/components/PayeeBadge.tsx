/**
 * PayeeBadge — shows the domain verification status of a payee.
 * Uses text + icon only (never colour alone) for accessibility.
 *
 * Props:
 *  domain   — the domain to verify (from parseLabel)
 *  address  — the payee wallet address
 *  onRetry  — optional retry callback (shown when status === 'error')
 *
 * Usage:
 *   <PayeeBadge domain={parsed.domain} address={payeeAddress} />
 */
import { ShieldCheck, ShieldAlert, ShieldQuestion, Shield, Loader2 } from 'lucide-react'
import { usePayeeVerification } from '@/lib/verifyPayee'

interface Props {
  domain:   string | undefined
  address:  string
  onRetry?: () => void
  className?: string
}

export default function PayeeBadge({ domain, address, onRetry, className = '' }: Props) {
  const { result, loading } = usePayeeVerification(domain ?? '', address)

  // No domain set on this payee
  if (!domain) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-[var(--muted)] ${className}`}>
        <Shield className="size-3.5 shrink-0" aria-hidden />
        Not verified — confirm this address with the payee directly
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
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium text-[var(--success)] ${className}`}
          title={`DNS TXT record on ${domain} matches this wallet`}
        >
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          Verified by <strong className="font-semibold">{domain}</strong>
        </span>
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
