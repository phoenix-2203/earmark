import { type ReactNode, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

let dialogCounter = 0

export function Dialog({ open, onClose, title, children }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  // useState with a lazy initialiser runs only once and never re-runs,
  // giving a stable ID without touching a ref during render.
  const [titleId] = useState(() => `dialog-title-${++dialogCounter}`)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
    }
  }, [open])

  // Close on backdrop click
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top || e.clientY > rect.bottom
    ) {
      onClose()
    }
  }

  // Close on Esc (native dialog handles this, but we sync state)
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    const handler = () => onClose()
    el.addEventListener('cancel', handler)
    return () => el.removeEventListener('cancel', handler)
  }, [onClose])

  if (!open) return null

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClick={handleClick}
      className="w-full max-w-sm rounded-card border border-[var(--line)] bg-[var(--surface)] p-0 shadow-card backdrop:bg-[var(--ink)]/40"
      style={{ margin: 'auto' }}
    >
      <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4">
        <h2 id={titleId} className="text-base font-semibold text-[var(--ink)]">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="rounded p-1 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] min-w-[32px] min-h-[32px] flex items-center justify-center"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  )
}
