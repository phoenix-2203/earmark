/**
 * AskPayeeToConfirmButton — shows a button that creates a payee confirmation
 * request link and opens a share dialog.
 *
 * The funder clicks this next to any payee row where they decide (CreatePotPage,
 * AddPayeeForm in PotPage, PayeeRequestCard in PotPage).
 *
 * After clicking once, the row shows "Waiting for the payee to confirm" plus
 * a paste field (the reply link #/payee-confirmed?r=…&s=…).
 *
 * Props:
 *   funder   — funder's connected address (from useAccount)
 *   payee    — payee wallet address (checksummed)
 *   name     — payee label (display name)
 *   purpose  — pot title (or being-typed title)
 *   disabled — grey out when address/name not yet valid
 */

import { useState } from 'react'
import { useAccount } from 'wagmi'
import { MessageSquarePlus, Copy, Share2, X, CheckCircle2, AlertTriangle, Clock, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  createConfirmRequest, decodeRequest,
  formatCode, hasPendingRequest, getConfirmedPayee, verifyReply,
} from '@/lib/confirmPayee'

interface Props {
  payee:    `0x${string}`
  name:     string
  purpose:  string
  disabled?: boolean
  /** Called after a confirmation is successfully verified. */
  onConfirmed?: () => void
}

type DialogPhase =
  | 'share'       // just created; show the link
  | 'paste'       // waiting for reply link
  | 'verifying'   // running verifyMessage
  | 'success'     // confirmed
  | 'fail'        // verification failed

export default function AskPayeeToConfirmButton({ payee, name, purpose, disabled, onConfirmed }: Props) {
  const { address: funder } = useAccount()
  const [open, setOpen] = useState(false)
  const [link, setLink] = useState('')
  const [phase, setPhase] = useState<DialogPhase>('share')
  const [pasteValue, setPasteValue] = useState('')
  const [failReason, setFailReason] = useState('')
  const [confirmedName, setConfirmedName] = useState('')

  // Already confirmed in this browser?
  const confirmed = funder ? getConfirmedPayee(funder, payee) : null
  // Pending in this browser?
  const pending = funder ? hasPendingRequest(funder, payee) : false

  function handleOpen() {
    if (!funder) { toast.error('Connect your wallet first.'); return }
    const { link: l } = createConfirmRequest({ funder, payee, name, purpose })
    setLink(l)
    setPhase('share')
    setPasteValue('')
    setOpen(true)
  }

  function handleClose() {
    setOpen(false)
  }

  async function handleVerifyReply(raw: string) {
    const trimmed = raw.trim()
    if (!trimmed || !funder) return

    // Parse r= and s= from the reply link (accepts full URL or bare query string)
    let encoded: string | null = null
    let sig: string | null = null
    try {
      const hashPart = trimmed.includes('#') ? trimmed.split('#')[1] : trimmed
      const qPart = hashPart.split('?')[1] ?? ''
      const params = new URLSearchParams(qPart)
      encoded = params.get('r')
      sig = params.get('s')
    } catch {
      setFailReason("That doesn't look like a valid reply link.")
      setPhase('fail')
      return
    }

    if (!encoded || !sig) {
      setFailReason('The reply link is missing some information. Ask the payee to send the full link.')
      setPhase('fail')
      return
    }

    setPhase('verifying')

    // Delegate ALL validation logic to verifyReply.
    // Pass payee as expectedPayee so a reply for a different row is rejected.
    const result = await verifyReply(encoded, sig, funder, payee)

    if (!result.ok) {
      setFailReason(result.reason)
      setPhase('fail')
      return
    }

    setConfirmedName(result.stored.name)
    setPhase('success')
    toast.success('Payee confirmed!')
    onConfirmed?.()
  }

  // ── Derive code from link for display ──
  let displayCode = ''
  try {
    const qPart = (link.split('?')[1] ?? '').split('&')[0]
    const enc = new URLSearchParams(qPart).get('r') ?? qPart.replace('r=', '')
    const req = enc ? decodeRequest(enc) : null
    if (req) displayCode = formatCode(req.code)
  } catch { /* ignore */ }

  const buttonLabel = confirmed
    ? 'Confirmed'
    : pending
    ? 'Waiting…'
    : 'Ask payee to confirm'

  const ButtonIcon = confirmed ? CheckCircle2 : pending ? Clock : MessageSquarePlus

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        disabled={disabled || !!confirmed}
        onClick={handleOpen}
        title={confirmed ? 'Already confirmed by the wallet owner' : 'Create a confirmation link to send the payee'}
      >
        <ButtonIcon className="size-3.5 shrink-0" aria-hidden />
        {buttonLabel}
      </Button>

      <Dialog open={open} onClose={handleClose} title="Ask the payee to confirm">
        {phase === 'share' && (
          <div className="space-y-4">
            <div className="rounded-card border border-[var(--line)] bg-[var(--accent-soft)] p-3 text-sm text-[var(--accent)]">
              <strong>Send this using contact details you found yourself</strong> — their official phone number, email or website.
              Don't use contact details from the person who asked you to add them.
            </div>
            <div>
              <p className="mb-1 text-xs text-[var(--muted)]">Code: <span className="font-mono font-bold text-[var(--ink)]">{displayCode}</span></p>
              <div className="rounded-input bg-[var(--surface-2)] px-3 py-2.5 font-mono text-xs break-all text-[var(--ink)]">
                {link}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() => { void navigator.clipboard.writeText(link); toast.success('Link copied!') }}
              >
                <Copy className="size-3.5" aria-hidden /> Copy link
              </Button>
              {typeof navigator.share === 'function' && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void navigator.share({ title: 'Earmark payee confirmation', url: link })}
                >
                  <Share2 className="size-3.5" aria-hidden /> Share
                </Button>
              )}
            </div>
            <div className="border-t border-[var(--line)] pt-3">
              <p className="mb-2 text-xs text-[var(--muted)]">Once the payee replies, paste or open their reply link here:</p>
              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                onClick={() => setPhase('paste')}
              >
                Paste payee's reply link
              </Button>
            </div>
          </div>
        )}

        {phase === 'paste' && (
          <div className="space-y-4">
            <p className="text-sm text-[var(--ink-2)]">Paste the reply link the payee sent back to you:</p>
            <textarea
              className="w-full rounded-input border border-[var(--line)] bg-[var(--surface-2)] px-3 py-2.5 text-xs font-mono text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)] resize-none"
              rows={4}
              placeholder="https://…/#/payee-confirmed?r=…&s=…"
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                disabled={!pasteValue.trim()}
                onClick={() => void handleVerifyReply(pasteValue)}
              >
                Verify reply
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPhase('share')}>Back</Button>
            </div>
          </div>
        )}

        {phase === 'verifying' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <Loader2 className="size-8 animate-spin text-[var(--accent)]" />
            <p className="text-sm text-[var(--ink-2)]">Verifying signature…</p>
          </div>
        )}

        {phase === 'success' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2 py-2">
              <CheckCircle2 className="size-10 text-[var(--success)]" />
              <p className="text-sm font-semibold text-[var(--ink)]">Payee confirmed!</p>
              <p className="text-xs text-[var(--ink-2)] text-center">
                {confirmedName} proved they control this wallet. The badge will now show "Confirmed by the wallet owner".
              </p>
            </div>
            <Button className="w-full" onClick={handleClose}>Close</Button>
          </div>
        )}

        {phase === 'fail' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="size-5 shrink-0 text-[var(--warning)] mt-0.5" />
              <p className="text-sm text-[var(--ink-2)]">{failReason}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPhase('paste')}>Try again</Button>
              <Button variant="secondary" size="sm" onClick={handleClose}><X className="size-3.5" /> Close</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  )
}
