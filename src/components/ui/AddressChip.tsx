import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { shortAddr } from '@/utils/format'

interface AddressChipProps {
  address: string
  label?: string
  className?: string
}

export function AddressChip({ address, label, className = '' }: AddressChipProps) {
  const [copied, setCopied] = useState(false)
  const display = label ?? shortAddr(address)

  function handleCopy() {
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-xs text-[var(--ink-2)] ${className}`}
      title={address}
    >
      <span aria-label={`Address: ${address}`}>{display}</span>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? 'Copied' : `Copy address ${address}`}
        className="rounded p-0.5 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] min-w-[24px] min-h-[24px] flex items-center justify-center"
      >
        {copied
          ? <Check className="size-3 text-[var(--success)]" aria-hidden />
          : <Copy className="size-3" aria-hidden />
        }
      </button>
    </span>
  )
}
