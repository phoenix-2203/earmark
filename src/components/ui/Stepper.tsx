interface Step {
  label: string
  status: 'pending' | 'active' | 'done'
}

interface StepperProps {
  steps: Step[]
  className?: string
}

export function Stepper({ steps, className = '' }: StepperProps) {
  return (
    <ol className={`flex items-center gap-1 ${className}`} aria-label="Steps">
      {steps.map((step, i) => (
        <li key={i} className="flex items-center gap-1">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold
              ${step.status === 'done'   ? 'bg-[var(--success)] text-white' : ''}
              ${step.status === 'active' ? 'bg-accent text-white' : ''}
              ${step.status === 'pending'? 'bg-[var(--surface-2)] text-[var(--muted)]' : ''}
            `}
            aria-current={step.status === 'active' ? 'step' : undefined}
          >
            {step.status === 'done' ? '✓' : i + 1}
          </span>
          <span
            className={`text-xs font-medium
              ${step.status === 'active'  ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}
            `}
          >
            {step.label}
          </span>
          {i < steps.length - 1 && (
            <span className="mx-1 text-[var(--line)]" aria-hidden>—</span>
          )}
        </li>
      ))}
    </ol>
  )
}
