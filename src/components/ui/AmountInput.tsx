import { type ChangeEvent } from 'react'
import { formatUsdc } from '@/utils/format'

interface AmountInputProps {
  id?: string
  value: string
  onChange: (value: string) => void
  balance?: bigint
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  disabled?: boolean
}

export function AmountInput({
  id,
  value,
  onChange,
  balance,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  disabled,
}: AmountInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9.]/g, '')
    // Prevent multiple dots
    const parts = v.split('.')
    if (parts.length > 2) return
    // Limit to 6 decimal places
    if (parts[1] && parts[1].length > 6) return
    onChange(v)
  }

  function handleMax() {
    if (balance !== undefined) {
      // Format with full precision (6 dp)
      const raw = balance
      const divisor = 10n ** 6n
      const whole = raw / divisor
      const frac = raw % divisor
      onChange(`${whole}.${frac.toString().padStart(6, '0')}`)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2 rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 focus-within:ring-2 focus-within:ring-[var(--focus)]">
        <input
          id={id}
          inputMode="decimal"
          type="text"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder="0.00"
          aria-describedby={describedBy}
          aria-invalid={invalid}
          autoComplete="off"
          className="font-mono min-w-0 flex-1 bg-transparent text-2xl font-semibold tabular-nums text-[var(--ink)] outline-none placeholder:text-[var(--muted)] disabled:opacity-50"
        />
        <span className="shrink-0 text-sm font-medium text-[var(--muted)]">USDC</span>
      </div>
      {balance !== undefined && (
        <div className="flex items-center justify-between text-xs text-[var(--muted)]">
          <span>Balance: <span className="font-mono tabular-nums text-[var(--ink-2)]">{formatUsdc(balance)}</span> USDC</span>
          <button
            type="button"
            onClick={handleMax}
            className="font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded px-1"
          >
            Max
          </button>
        </div>
      )}
    </div>
  )
}
