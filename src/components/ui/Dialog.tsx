import { type ReactNode, useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** While busy, backdrop clicks and Esc are ignored and the close button is disabled. */
  busy?: boolean
}

let dialogCounter = 0

export function Dialog({ open, onClose, title, children, busy = false }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
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

  // Close on backdrop click — ignored while busy
  function handleClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (busy) return
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    if (
      e.clientX < rect.left || e.clientX > rect.right ||
      e.clientY < rect.top  || e.clientY > rect.bottom
    ) {
      onClose()
    }
  }

  // Close on Esc (native dialog fires 'cancel') — ignored while busy
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    function handler(e: Event) {
      if (busy) { e.preventDefault(); return }
      onClose()
    }
    el.addEventListener('cancel', handler)
    return () => el.removeEventListener('cancel', handler)
  }, [onClose, busy])

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
          onClick={busy ? undefined : onClose}
          disabled={busy}
          aria-label="Close dialog"
          className="rounded p-1 text-[var(--muted)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] min-w-[32px] min-h-[32px] flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  )
}
