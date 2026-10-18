import { type ChangeEvent } from 'react'
import { parseChecksumAddress } from '@/utils/format'
import { ClipboardPaste } from 'lucide-react'

interface AddressInputProps {
  id?: string
  value: string
  onChange: (raw: string, checksummed: `0x${string}` | null) => void
  placeholder?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean
  disabled?: boolean
  className?: string
}

export function AddressInput({
  id,
  value,
  onChange,
  placeholder = '0x…',
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  disabled,
  className = '',
}: AddressInputProps) {
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    onChange(raw, parseChecksumAddress(raw))
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText()
      const trimmed = text.trim()
      onChange(trimmed, parseChecksumAddress(trimmed))
    } catch {
      // clipboard access denied — do nothing
    }
  }

  return (
    <div className="relative flex items-center">
      <input
        id={id}
        type="text"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder}
        aria-describedby={describedBy}
        aria-invalid={invalid}
        autoComplete="off"
        spellCheck={false}
        className={`font-mono w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] disabled:opacity-50 pr-10 ${className}`}
      />
      <button
        type="button"
        onClick={() => void handlePaste()}
        aria-label="Paste address from clipboard"
        className="absolute right-2 rounded p-1 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] min-w-[28px] min-h-[28px] flex items-center justify-center"
      >
        <ClipboardPaste className="size-4" aria-hidden />
      </button>
    </div>
  )
}
