/**
 * SiteFooter — used on landing + About + How it works pages.
 */
import { Github } from 'lucide-react'
import { EARMARK_CHAIN, EARMARK_ADDRESS } from '@/earmarkConfig'

interface Props {
  onSend: () => void
  onSent: () => void
  onReceived: () => void
  onHow: () => void
  onAbout: () => void
}

export default function SiteFooter({ onSend, onSent, onReceived, onHow, onAbout }: Props) {
  const explorerUrl = `${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`
  const shortAddr = EARMARK_ADDRESS.length > 2
    ? `${EARMARK_ADDRESS.slice(0, 6)}…${EARMARK_ADDRESS.slice(-4)}`
    : 'not deployed'

  return (
    <footer className="border-t border-[var(--line)] bg-[var(--surface)]">
      <div className="mx-auto max-w-[1040px] px-4 py-10 grid gap-8 sm:grid-cols-3">

        {/* Column 1: Product */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Product</p>
          <ul className="space-y-2">
            <li><FooterLink onClick={onSend}>Create a pot</FooterLink></li>
            <li><FooterLink onClick={onSent}>Pots I fund</FooterLink></li>
            <li><FooterLink onClick={onReceived}>Pots for me</FooterLink></li>
            <li><FooterLink onClick={onHow}>How it works</FooterLink></li>
          </ul>
        </div>

        {/* Column 2: Proof */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">Proof</p>
          <ul className="space-y-2">
            <li>
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--ink-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded underline-offset-2 hover:underline"
              >
                Contract ({shortAddr})
              </a>
            </li>
            <li>
              <a
                href="https://github.com/phoenix-2203/earmark"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-[var(--ink-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              >
                <Github className="size-3.5" aria-hidden />
                Source on GitHub
              </a>
            </li>
            <li>
              <a
                href="https://studio.arc.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--ink-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              >
                Built with Arc Studio
              </a>
            </li>
          </ul>
        </div>

        {/* Column 3: About */}
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">About</p>
          <ul className="space-y-2">
            <li><FooterLink onClick={onAbout}>About Earmark</FooterLink></li>
            <li>
              <button
                onClick={() => {
                  onAbout()
                  setTimeout(() => {
                    const el = document.getElementById('roadmap')
                    if (el) el.scrollIntoView({ behavior: 'smooth' })
                  }, 100)
                }}
                className="text-sm text-[var(--ink-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded text-left"
              >
                Roadmap
              </button>
            </li>
          </ul>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--line)] px-4 py-4">
        <div className="mx-auto max-w-[1040px] flex flex-col sm:flex-row items-center justify-between gap-2">
          <img src="/earmark-logo.svg" alt="Earmark" className="h-5 w-auto opacity-60" />
          <p className="text-center text-xs text-[var(--muted)]">
            {EARMARK_CHAIN.name} · Experimental — not independently audited. Use small amounts.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-sm text-[var(--ink-2)] hover:text-[var(--accent)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded text-left"
    >
      {children}
    </button>
  )
}
