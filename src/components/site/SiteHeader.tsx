/**
 * SiteHeader — sticky marketing header used on landing + About + How it works pages.
 * App pages use their own shell in App.tsx.
 */
import { useState, useRef, useEffect } from 'react'
import { Github, Menu, X, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import SignInButton from '@/components/SignInButton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import { PRIVY_ENABLED } from '@/lib/privy'
import { useEffectiveTheme } from '@/lib/theme'

interface Props {
  onOpenApp: () => void
  onHow: () => void
  onAbout: () => void
  /** Navigate to the wallet page. Defaults to onOpenApp when not provided. */
  onWallet?: () => void
}

const NAV_LINKS = [
  { label: 'In 30 seconds', href: '#in-30-seconds' },
  { label: 'Use cases',     href: '#use-cases'      },
  { label: 'Live on Arc',   href: '#live'           },
  { label: 'Safety',        href: '#safety'         },
  { label: 'FAQ',           href: '#faq'            },
]

function scrollTo(id: string) {
  const el = document.getElementById(id)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  else window.location.hash = id
}

export default function SiteHeader({ onOpenApp, onHow, onAbout, onWallet = onOpenApp }: Props) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const effectiveTheme = useEffectiveTheme()

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  // Close on Esc
  useEffect(() => {
    if (!open) return
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open])

  function handleNavClick(href: string) {
    setOpen(false)
    const id = href.replace('#', '')
    scrollTo(id)
  }

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1040px] items-center justify-between px-4 py-3 gap-4">

        {/* ── Logo ── */}
        <button
          onClick={onOpenApp}
          className="flex items-center rounded focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
          aria-label="Earmark — go to home"
        >
          <img
            src={effectiveTheme === 'dark' ? '/earmark-logo-dark.svg' : '/earmark-logo.svg'}
            alt="Earmark"
            className="h-6 sm:h-[26px] w-auto"
          />
        </button>

        {/* ── Desktop centre nav ── */}
        <nav className="hidden lg:flex items-center gap-1" aria-label="Site navigation">
          {NAV_LINKS.map(({ label, href }) => (
            <button
              key={href}
              onClick={() => handleNavClick(href)}
              className="rounded px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
            >
              {label}
            </button>
          ))}
          <button
            onClick={onHow}
            className="rounded px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
          >
            How it works
          </button>
          <button
            onClick={onAbout}
            className="rounded px-3 py-1.5 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
          >
            About
          </button>
        </nav>

        {/* ── Right side ── */}
        <div className="flex items-center gap-2">
          <ThemeToggle className="hidden sm:flex" />
          <a
            href="https://github.com/phoenix-2203/earmark"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Earmark source code on GitHub"
            className="hidden sm:flex items-center justify-center rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
          >
            <Github className="size-5" aria-hidden />
          </a>
          {PRIVY_ENABLED ? (
            <SignInButton onWallet={onWallet} />
          ) : (
            <>
              <Button size="sm" onClick={onOpenApp} className="hidden sm:flex items-center gap-1.5">
                Open the app
                <ExternalLink className="size-3.5" aria-hidden />
              </Button>
              <Button size="sm" onClick={onOpenApp} className="sm:hidden">Open the app</Button>
            </>
          )}

          {/* Mobile: hamburger (shown when no inline CTA visible) */}
          {!PRIVY_ENABLED && <Button size="sm" onClick={onOpenApp} className="sm:hidden hidden">Open the app</Button>}
          <div className="relative lg:hidden" ref={menuRef}>
            <button
              aria-label={open ? 'Close menu' : 'Open menu'}
              aria-expanded={open}
              aria-controls="site-mobile-menu"
              onClick={() => setOpen(v => !v)}
              className="rounded p-1.5 text-[var(--ink-2)] hover:bg-[var(--surface-2)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
            >
              {open ? <X className="size-5" aria-hidden /> : <Menu className="size-5" aria-hidden />}
            </button>

            {/* Dropdown */}
            {open && (
              <div
                id="site-mobile-menu"
                role="menu"
                className="absolute right-0 top-full mt-1 w-52 rounded-card border border-[var(--line)] bg-[var(--surface)] shadow-lg py-1"
              >
                {NAV_LINKS.map(({ label, href }) => (
                  <button
                    key={href}
                    role="menuitem"
                    onClick={() => handleNavClick(href)}
                    className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
                  >
                    {label}
                  </button>
                ))}
                <div className="my-1 border-t border-[var(--line)]" />
                <button
                  role="menuitem"
                  onClick={() => { setOpen(false); onHow() }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
                >
                  How it works
                </button>
                <button
                  role="menuitem"
                  onClick={() => { setOpen(false); onAbout() }}
                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
                >
                  About
                </button>
                <a
                  role="menuitem"
                  href="https://github.com/phoenix-2203/earmark"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors"
                >
                  <Github className="size-4" aria-hidden />
                  GitHub
                </a>
                <div className="my-1 border-t border-[var(--line)]" />
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-sm text-[var(--ink-2)]">Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}


