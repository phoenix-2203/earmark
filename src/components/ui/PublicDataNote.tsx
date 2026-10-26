import { Eye } from 'lucide-react'

/** One-liner shown under public-chain fields (title, payee names, memo). */
export function PublicDataNote() {
  return (
    <p className="flex items-center gap-1 text-xs text-[var(--muted)] mt-1">
      <Eye className="size-3 shrink-0" aria-hidden />
      Visible to anyone on Arc — don't include private details.
    </p>
  )
}
