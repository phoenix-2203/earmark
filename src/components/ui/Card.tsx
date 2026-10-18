import { type HTMLAttributes, forwardRef } from 'react'
import { clsx } from 'clsx'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg' | 'none'
}

const PADDING = {
  none: '',
  sm:   'p-3',
  md:   'p-4',
  lg:   'p-5',
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ padding = 'md', className, children, ...rest }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'bg-surface rounded-card shadow-card border border-[var(--line)]',
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  ),
)
Card.displayName = 'Card'
