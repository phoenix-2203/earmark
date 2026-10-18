import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'md' | 'lg' | 'sm'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  loadingLabel?: string
}

const BASE =
  'inline-flex items-center justify-center gap-2 font-semibold rounded-input ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] ' +
  'disabled:cursor-not-allowed disabled:opacity-40 select-none'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:   'bg-accent text-white hover:bg-[var(--accent-hover)]',
  secondary: 'bg-[var(--surface-2)] text-[var(--ink)] hover:bg-[var(--line)]',
  danger:    'bg-danger text-white hover:opacity-90',
  ghost:     'bg-transparent text-[var(--ink)] hover:bg-[var(--surface-2)]',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 h-8 text-xs min-h-[32px]',
  md: 'px-4 h-10 text-sm min-h-[40px]',
  lg: 'px-5 h-12 text-sm min-h-[48px]',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, loadingLabel, children, className, disabled, ...rest }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(BASE, VARIANTS[variant], SIZES[size], className)}
      {...rest}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {loading && loadingLabel ? loadingLabel : children}
    </button>
  ),
)
Button.displayName = 'Button'
