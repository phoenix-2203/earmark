import { useState, useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import NetworkGuard from '@/components/NetworkGuard'
import UsdcBalance from '@/components/UsdcBalance'
import SignInButton from '@/components/SignInButton'
import ThemeToggle from '@/components/ui/ThemeToggle'
import HomePage from '@/pages/HomePage'
import AboutPage from '@/pages/AboutPage'
import CreatePotPage from '@/pages/CreatePotPage'
import MyPotsPage from '@/pages/MyPotsPage'
import ForMePage from '@/pages/ForMePage'
import ReceiptPage from '@/pages/ReceiptPage'
import PotPage from '@/pages/PotPage'
import HowItWorksPage from '@/pages/HowItWorksPage'
import WalletPage from '@/pages/WalletPage'
import ConfirmPayeePage from '@/pages/ConfirmPayeePage'
import PayeeConfirmedPage from '@/pages/PayeeConfirmedPage'
import { EARMARK_CHAIN, EARMARK_ADDRESS } from '@/earmarkConfig'
import { PRIVY_ENABLED } from '@/lib/privy'
import { useEffectiveTheme } from '@/lib/theme'
import { resolveSlugToPotId, resolveSlugToReceipt, isValidSlug } from '@/lib/slugLinks'
import { Send, Inbox, PiggyBank, Loader2 } from 'lucide-react'

// ── Routes ──────────────────────────────────────────────────────────────────
export type Page = 'home' | 'about' | 'send' | 'sent' | 'received' | 'receipt' | 'pot' | 'how' | 'wallet' | 'confirm-payee' | 'payee-confirmed'

interface Route {
  page: Page
  potId?: bigint
  paymentIndex?: number
  /** Pending slug resolution — we know it's a slug link but haven't scanned yet */
  slug?: string
  slugKind?: 'pot' | 'receipt'
}

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '') || window.location.pathname

  // New slug routes
  const potSlugMatch = hash.match(/^\/p\/([0-9a-fA-F]+)$/)
  if (potSlugMatch) {
    const slug = potSlugMatch[1].toLowerCase()
    return isValidSlug(slug) ? { page: 'pot', slug, slugKind: 'pot' } : { page: 'home' }
  }
  const receiptSlugMatch = hash.match(/^\/r\/([0-9a-fA-F]+)$/)
  if (receiptSlugMatch) {
    const slug = receiptSlugMatch[1].toLowerCase()
    return isValidSlug(slug) ? { page: 'receipt', slug, slugKind: 'receipt' } : { page: 'home' }
  }

  // Legacy numeric routes (keep working, don't generate)
  const receiptMatch = hash.match(/^\/receipt\/(\d+)\/(\d+)$/)
  if (receiptMatch) {
    return { page: 'receipt', potId: BigInt(receiptMatch[1]), paymentIndex: parseInt(receiptMatch[2], 10) }
  }
  const potMatch = hash.match(/^\/pot\/(\d+)$/)
  if (potMatch) {
    return { page: 'pot', potId: BigInt(potMatch[1]) }
  }

  if (hash === '/send')     return { page: 'send' }
  if (hash === '/sent')     return { page: 'sent' }
  if (hash === '/received') return { page: 'received' }
  if (hash === '/how')      return { page: 'how' }
  if (hash === '/wallet')   return { page: 'wallet' }
  if (hash === '/about' || hash.startsWith('/about')) return { page: 'about' }
  if (hash.startsWith('/confirm-payee'))  return { page: 'confirm-payee' }
  if (hash.startsWith('/payee-confirmed')) return { page: 'payee-confirmed' }
  return { page: 'home' }
}

function routeToHash(page: Page, potId?: bigint, paymentIndex?: number, slug?: string): string {
  if (page === 'receipt' && slug) return `#/r/${slug}`
  if (page === 'receipt' && potId !== undefined && paymentIndex !== undefined)
    return `#/r/` // shouldn't happen — always pass slug when known
  if (page === 'pot' && slug) return `#/p/${slug}`
  if (page === 'pot' && potId !== undefined) return `#/pot/${potId}` // legacy fallback
  if (page === 'send')     return '#/send'
  if (page === 'sent')     return '#/sent'
  if (page === 'received') return '#/received'
  if (page === 'how')      return '#/how'
  if (page === 'wallet')   return '#/wallet'
  if (page === 'about')    return '#/about'
  return '#/'
}

// ── Nav items (app shell only) ───────────────────────────────────────────────
const NAV = [
  { page: 'send'     as Page, label: 'Create a pot',  Icon: Send      },
  { page: 'sent'     as Page, label: 'Pots I fund',   Icon: PiggyBank },
  { page: 'received' as Page, label: 'Pots for me',   Icon: Inbox     },
]

// Pages that use the full app shell (header + tab bar)
const SHELL_PAGES: Page[] = ['send', 'sent', 'received']
// Pages that use the minimal public header (wordmark + wallet, no tab bar)
const PUBLIC_PAGES: Page[] = ['pot', 'receipt', 'wallet']
// Pages that are standalone (no shell, no site header)
const STANDALONE_PAGES: Page[] = ['confirm-payee', 'payee-confirmed']

/** Slug-resolution states: 'resolving' | 'not-found' | undefined (resolved) */
type SlugState = 'resolving' | 'not-found' | undefined

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  const [slugState, setSlugState] = useState<SlugState>(
    route.slug ? 'resolving' : undefined
  )
  const { isConnected } = useAccount()
  const effectiveTheme = useEffectiveTheme()
  const resolvingSlug = useRef<string | undefined>()

  function navigate(page: Page, potId?: bigint, paymentIndex?: number, slug?: string) {
    const r: Route = { page, potId, paymentIndex, slug }
    setRoute(r)
    setSlugState(undefined)
    window.history.pushState(null, '', routeToHash(page, potId, paymentIndex, slug))
  }

  // Keep slugState in sync: if the route has no slug and no pending resolution, clear it
  const hasSlugPending = !!route.slug && route.potId === undefined
  useEffect(() => {
    if (!hasSlugPending) setSlugState(undefined)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSlugPending])

  // Resolve slug → potId / receipt whenever route has a pending slug
  useEffect(() => {
    if (!route.slug || route.potId !== undefined) return
    if (resolvingSlug.current === route.slug) return
    resolvingSlug.current = route.slug
    setSlugState('resolving')

    void (async () => {
      if (route.slugKind === 'pot') {
        const potId = await resolveSlugToPotId(route.slug!)
        if (potId !== null) {
          setRoute((r) => ({ ...r, potId, slug: route.slug }))
          setSlugState(undefined)
        } else {
          setSlugState('not-found')
        }
      } else {
        const result = await resolveSlugToReceipt(route.slug!)
        if (result) {
          setRoute((r) => ({ ...r, potId: result.potId, paymentIndex: result.paymentIndex, slug: route.slug }))
          setSlugState(undefined)
        } else {
          setSlugState('not-found')
        }
      }
    })()
  }, [route.slug, route.slugKind, route.potId])

  useEffect(() => {
    const handler = () => {
      const r = parseRoute()
      setRoute(r)
      setSlugState(r.slug ? 'resolving' : undefined)
      resolvingSlug.current = undefined
    }
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const noContract = EARMARK_ADDRESS.length <= 2
  const showShell = SHELL_PAGES.includes(route.page)
  const showPublicHeader = PUBLIC_PAGES.includes(route.page)
  const isStandalone = STANDALONE_PAGES.includes(route.page)

  // Standalone pages render themselves completely — no shell, no headers
  if (isStandalone) {
    return (
      <>
        {route.page === 'confirm-payee' && <ConfirmPayeePage />}
        {route.page === 'payee-confirmed' && (
          <PayeeConfirmedPage onBack={() => window.history.back()} />
        )}
      </>
    )
  }

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>

      {/* ── App shell header (full nav) — app pages only ── */}
      {showShell && (
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate('home')}
              className="flex items-center focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              aria-label="Earmark — go to home"
            >
              <img
                src={effectiveTheme === 'dark' ? '/earmark-logo-dark.svg' : '/earmark-logo.svg'}
                alt="Earmark"
                className="h-6 w-auto"
              />
            </button>
            <nav className="hidden gap-1 md:flex" aria-label="Main navigation">
              {NAV.map(({ page, label, Icon }) => (
                <button
                  key={page}
                  onClick={() => navigate(page)}
                  aria-current={route.page === page ? 'page' : undefined}
                  className={`flex items-center gap-1.5 rounded-input px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[var(--focus)]
                    ${route.page === page
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--ink-2)] hover:bg-[var(--surface-2)]'
                    }`}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {isConnected && !PRIVY_ENABLED && <UsdcBalance />}
              <SignInButton onWallet={() => navigate('wallet')} />
            </div>
          </div>
          <div className="px-4 pb-2">
            <NetworkGuard />
          </div>
        </header>
      )}

      {/* ── Minimal public header (pot / receipt / wallet pages) ── */}
      {showPublicHeader && (
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3">
            <button
              onClick={() => navigate('home')}
              className="flex items-center focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              aria-label="Earmark — go to home"
            >
              <img
                src={effectiveTheme === 'dark' ? '/earmark-logo-dark.svg' : '/earmark-logo.svg'}
                alt="Earmark"
                className="h-6 w-auto"
              />
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('how')}
                className="hidden sm:block text-sm font-medium text-[var(--ink-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
              >
                How it works
              </button>
              <ThemeToggle />
              {isConnected && !PRIVY_ENABLED && <UsdcBalance />}
              <SignInButton onWallet={() => navigate('wallet')} />
            </div>
          </div>
        </header>
      )}

      {/* Contract not deployed notice */}
      {noContract && showShell && (
        <div className="mx-4 mt-4 rounded-card border border-[var(--danger-line)] bg-[var(--danger-soft)] p-4 text-sm text-[var(--danger)]">
          The Earmark contract is not yet deployed. Set <code className="font-mono">VITE_EARMARK_ADDRESS</code> in <code className="font-mono">.env</code> after deploying.
        </div>
      )}

      {/* ── Page content ── */}
      {route.page === 'home' && (
        <HomePage
          onSend={() => navigate('send')}
          onSent={() => navigate('sent')}
          onReceived={() => navigate('received')}
          onHow={() => navigate('how')}
          onAbout={() => navigate('about')}
        />
      )}
      {route.page === 'about' && (
        <AboutPage
          onSend={() => navigate('send')}
          onSent={() => navigate('sent')}
          onReceived={() => navigate('received')}
          onHow={() => navigate('how')}
          onBack={() => navigate('home')}
        />
      )}
      {route.page === 'how' && (
        <HowItWorksPage
          onBack={() => navigate('home')}
          onSend={() => navigate('send')}
          onAbout={() => navigate('about')}
        />
      )}
      {route.page === 'send' && (
        <CreatePotPage
          onBack={() => navigate('home')}
          onSuccess={(potId) => navigate('pot', potId)}
        />
      )}
      {route.page === 'sent' && (
        <MyPotsPage onViewPot={(potId) => navigate('pot', potId)} />
      )}
      {route.page === 'received' && (
        <ForMePage onViewPot={(potId) => navigate('pot', potId)} />
      )}
      {/* Slug resolving spinner */}
      {(route.page === 'pot' || route.page === 'receipt') && slugState === 'resolving' && (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
          <Loader2 className="size-8 animate-spin text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">Loading…</p>
        </div>
      )}
      {/* Slug not found */}
      {(route.page === 'pot' || route.page === 'receipt') && slugState === 'not-found' && (
        <div className="mx-auto max-w-content px-4 pt-16 text-center">
          <p className="text-sm font-semibold text-[var(--ink)]">This link doesn't match any pot on this network.</p>
          <p className="mt-1 text-xs text-[var(--muted)]">The link may be for a different network, or no pot was created with it.</p>
          <button
            className="mt-4 text-sm font-medium text-[var(--accent)] hover:underline focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
            onClick={() => navigate('home')}
          >
            Go home
          </button>
        </div>
      )}
      {route.page === 'receipt' && route.potId !== undefined && route.paymentIndex !== undefined && slugState === undefined && (
        <ReceiptPage
          potId={route.potId}
          paymentIndex={route.paymentIndex}
          onBack={() => window.history.back()}
        />
      )}
      {route.page === 'pot' && route.potId !== undefined && slugState === undefined && (
        <PotPage
          potId={route.potId}
          onBack={() => window.history.back()}
          onReceipt={(potId, index, slug) => navigate('receipt', potId, index, slug)}
        />
      )}
      {route.page === 'wallet' && (
        <WalletPage
          onBack={() => window.history.back()}
          onSignIn={() => {
            if (PRIVY_ENABLED) {
              // Privy login is triggered by SignInButton; navigate back to wallet after
              navigate('wallet')
            }
          }}
        />
      )}

      {/* ── Mobile bottom tab bar (app shell pages only) ── */}
      {showShell && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[var(--line)] bg-[var(--surface)] md:hidden"
          aria-label="Mobile navigation"
        >
          {NAV.map(({ page, label, Icon }) => (
            <button
              key={page}
              onClick={() => navigate(page)}
              aria-current={route.page === page ? 'page' : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium focus-visible:outline-2 focus-visible:outline-[var(--focus)]
                ${route.page === page ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
            >
              <Icon className="size-5" aria-hidden />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* ── Compact footer (app shell pages only) ── */}
      {showShell && (
        <footer className="mx-auto max-w-page px-4 pb-24 pt-8 text-center text-xs text-[var(--muted)] md:pb-8">
          <span>{EARMARK_CHAIN.name} · </span>
          <a
            href={`${EARMARK_CHAIN.explorerBase}/address/${EARMARK_ADDRESS}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono underline hover:text-[var(--ink)]"
          >
            {EARMARK_ADDRESS.length > 2 ? `${EARMARK_ADDRESS.slice(0, 10)}…` : 'contract not deployed'}
          </a>
          <span> · Experimental — not audited. Use small amounts.</span>
        </footer>
      )}
    </div>
  )
}
