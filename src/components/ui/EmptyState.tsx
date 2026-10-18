import { type ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-[var(--surface-2)] text-[var(--muted)]">
          {icon}
        </div>
      )}
      <p className="text-sm font-semibold text-[var(--ink)]">{title}</p>
      {description && (
        <p className="max-w-xs text-xs text-[var(--muted)] text-pretty">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}
