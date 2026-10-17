import { ConnectKitButton } from 'connectkit'
import { ArrowRight, GraduationCap, CheckCircle, Receipt } from 'lucide-react'

interface Props {
  onSend: () => void
  onMyPots: () => void
  onForMe: () => void
}

const glass = {
  card: {
    background: 'var(--surface)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    border: '1px solid var(--border)',
    borderRadius: '1.5rem',
  } as React.CSSProperties,
}

export default function HomePage({ onSend, onMyPots, onForMe }: Props) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 pb-20 pt-10">
      {/* Hero */}
      <div className="mb-10 max-w-sm text-center">
        <div
          className="mx-auto mb-6 flex size-16 items-center justify-center rounded-3xl"
          style={{ background: 'rgba(18,45,69,0.08)' }}
        >
          <GraduationCap className="size-8" style={{ color: 'var(--accent)' }} />
        </div>
        <h1
          className="display mb-3 text-3xl font-bold"
          style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}
        >
          Earmark
        </h1>
        <p className="text-base" style={{ color: 'var(--muted)' }}>
          Send money home for a reason.{' '}
          <strong style={{ color: 'var(--ink)' }}>It can only be spent on that reason.</strong>
        </p>
      </div>

      {/* Steps */}
      <div className="mb-10 w-full max-w-sm space-y-3">
        {[
          {
            icon: <GraduationCap className="size-5" style={{ color: 'var(--accent)' }} />,
            title: 'Fund a pot',
            desc: 'Send USDC for a specific purpose — school fees, rent, medical bills.',
          },
          {
            icon: <CheckCircle className="size-5" style={{ color: 'var(--success)' }} />,
            title: 'Approve who can be paid',
            desc: 'Only the school, the landlord, or whoever you choose can receive the money.',
          },
          {
            icon: <Receipt className="size-5" style={{ color: '#1061a6' }} />,
            title: 'Family pays, you see every receipt',
            desc: 'Every payment is recorded on-chain. Share a link to prove it happened.',
          },
        ].map((step, i) => (
          <div key={i} className="flex gap-4 rounded-2xl p-4" style={glass.card}>
            <div
              className="flex size-9 shrink-0 items-center justify-center rounded-xl"
              style={{ background: 'var(--surface-muted)' }}
            >
              {step.icon}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
                {step.title}
              </p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                {step.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="w-full max-w-sm space-y-3">
        <div className="flex items-center justify-center">
          <ConnectKitButton />
        </div>

        <button
          onClick={onSend}
          className="flex w-full items-center justify-between rounded-2xl px-5 py-4 text-sm font-semibold text-white transition-all hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: 'var(--accent)' }}
        >
          <span>Send money home</span>
          <ArrowRight className="size-4" />
        </button>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onMyPots}
            className="rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
          >
            My pots
          </button>
          <button
            onClick={onForMe}
            className="rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all hover:scale-[1.01] active:scale-[0.99]"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink)' }}
          >
            For me
          </button>
        </div>
      </div>
    </div>
  )
}
