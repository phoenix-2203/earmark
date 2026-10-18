import { type ReactNode, useId } from 'react'
import { clsx } from 'clsx'

interface FieldProps {
  label: string
  help?: string
  error?: string
  children: (props: { id: string; 'aria-describedby': string; 'aria-invalid': boolean }) => ReactNode
  className?: string
}

export function Field({ label, help, error, children, className }: FieldProps) {
  const id = useId()
  const helpId = `${id}-help`
  const errorId = `${id}-error`
  const describedBy = [help ? helpId : '', error ? errorId : ''].filter(Boolean).join(' ')

  return (
    <div className={clsx('flex flex-col gap-1', className)}>
      <label htmlFor={id} className="text-xs font-medium text-[var(--ink-2)]">
        {label}
      </label>
      {help && (
        <p id={helpId} className="text-xs text-[var(--muted)]">
          {help}
        </p>
      )}
      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': !!error })}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
