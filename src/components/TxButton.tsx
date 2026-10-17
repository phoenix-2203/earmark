/**
 * Standard transaction CTA button with loading states.
 */
import { Loader2 } from 'lucide-react'

interface Props {
  onClick: () => void
  disabled?: boolean
  isPending?: boolean
  isConfirming?: boolean
  label: string
  pendingLabel?: string
  confirmingLabel?: string
  variant?: 'primary' | 'danger' | 'ghost'
  className?: string
}

const STYLES = {
  primary: { background: 'var(--accent)', color: 'white' },
  danger: { background: 'var(--danger)', color: 'white' },
  ghost: { background: 'var(--surface-muted)', color: 'var(--ink)' },
}

export default function TxButton({
  onClick,
  disabled,
  isPending,
  isConfirming,
  label,
  pendingLabel = 'Confirm in wallet…',
  confirmingLabel = 'Confirming…',
  variant = 'primary',
  className = '',
}: Props) {
  const loading = isPending || isConfirming
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      style={STYLES[variant]}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {isPending ? pendingLabel : isConfirming ? confirmingLabel : label}
    </button>
  )
}
