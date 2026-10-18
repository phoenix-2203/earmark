import { CheckCircle2, Clock, XCircle, AlertCircle, Circle } from 'lucide-react'
import { clsx } from 'clsx'

export type Status = 'Open' | 'Ended' | 'Closed' | 'Pending' | 'Approved' | 'Rejected'

const CONFIG: Record<Status, { icon: React.ComponentType<{ className?: string }>; cls: string; label: string }> = {
  Open:     { icon: CheckCircle2, cls: 'bg-[#E3F1EE] text-[var(--success)]',  label: 'Open' },
  Ended:    { icon: AlertCircle,  cls: 'bg-[#FFF4E0] text-[var(--warning)]',   label: 'Ended' },
  Closed:   { icon: XCircle,     cls: 'bg-[var(--surface-2)] text-[var(--muted)]', label: 'Closed' },
  Pending:  { icon: Clock,       cls: 'bg-[#E6F0FF] text-[var(--info)]',       label: 'Pending' },
  Approved: { icon: CheckCircle2,cls: 'bg-[#E3F1EE] text-[var(--success)]',   label: 'Approved' },
  Rejected: { icon: XCircle,     cls: 'bg-[#FDECEC] text-[var(--danger)]',     label: 'Rejected' },
}

// Fallback for unknown statuses
const FALLBACK = { icon: Circle, cls: 'bg-[var(--surface-2)] text-[var(--muted)]', label: 'Unknown' }

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const cfg = CONFIG[status] ?? FALLBACK
  const Icon = cfg.icon
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold', cfg.cls, className)}
    >
      <Icon className="size-3" aria-hidden />
      <span>{cfg.label}</span>
    </span>
  )
}
