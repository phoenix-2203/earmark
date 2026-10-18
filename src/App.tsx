import { useState, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import NetworkGuard from '@/components/NetworkGuard'
import UsdcBalance from '@/components/UsdcBalance'
import HomePage from '@/pages/HomePage'
import CreatePotPage from '@/pages/CreatePotPage'
import MyPotsPage from '@/pages/MyPotsPage'
import ForMePage from '@/pages/ForMePage'
import ReceiptPage from '@/pages/ReceiptPage'
import PotPage from '@/pages/PotPage'
import HowItWorksPage from '@/pages/HowItWorksPage'
import { EARMARK_CHAIN, EARMARK_ADDRESS } from '@/earmarkConfig'
import { Send, Inbox, PiggyBank } from 'lucide-react'

// ── Routes ──────────────────────────────────────────────────────────────────
export type Page = 'home' | 'send' | 'sent' | 'received' | 'receipt' | 'pot' | 'how'

interface Route {
  page: Page
  potId?: bigint
  paymentIndex?: number
}

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '') || window.location.pathname
  // /receipt/:potId/:index (hash and path form)
  const receiptMatch = hash.match(/^\/receipt\/(\d+)\/(\d+)$/)
  if (receiptMatch) {
    return { page: 'receipt', potId: BigInt(receiptMatch[1]), paymentIndex: parseInt(receiptMatch[2], 10) }
  }
  // /pot/:id (hash and path form)
  const potMatch = hash.match(/^\/pot\/(\d+)$/)
  if (potMatch) {
    return { page: 'pot', potId: BigInt(potMatch[1]) }
  }
  if (hash === '/send')     return { page: 'send' }
  if (hash === '/sent')     return { page: 'sent' }
  if (hash === '/received') return { page: 'received' }
  if (hash === '/how')      return { page: 'how' }
  return { page: 'home' }
}

function routeToHash(page: Page, potId?: bigint, paymentIndex?: number): string {
  if (page === 'receipt' && potId !== undefined && paymentIndex !== undefined)
    return `#/receipt/${potId}/${paymentIndex}`
  if (page === 'pot' && potId !== undefined)
    return `#/pot/${potId}`
  if (page === 'send')     return '#/send'
  if (page === 'sent')     return '#/sent'
  if (page === 'received') return '#/received'
  if (page === 'how')      return '#/how'
  return '#/'
}

// ── Nav items ────────────────────────────────────────────────────────────────
const NAV = [
  { page: 'send'     as Page, label: 'Send money',    Icon: Send     },
  { page: 'sent'     as Page, label: 'Pots I sent',   Icon: PiggyBank},
  { page: 'received' as Page, label: 'Pots for me',   Icon: Inbox    },
]

// Pages that show the full shell (header + nav)
const SHELL_PAGES: Page[] = ['home', 'send', 'sent', 'received', 'how']

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)
  const { isConnected } = useAccount()

  function navigate(page: Page, potId?: bigint, paymentIndex?: number) {
    const r: Route = { page, potId, paymentIndex }
    setRoute(r)
    window.history.pushState(null, '', routeToHash(page, potId, paymentIndex))
  }

  useEffect(() => {
    const handler = () => setRoute(parseRoute())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const noContract = EARMARK_ADDRESS.length <= 2
  const showShell = SHELL_PAGES.includes(route.page)

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg)' }}>
      {/* ── App shell header ── */}
      {showShell && (
        <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[var(--surface)]">
          <div className="mx-auto flex max-w-page items-center justify-between px-4 py-3">
            {/* Wordmark */}
            <button
              onClick={() => navigate('home')}
              className="font-display text-base font-semibold text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] rounded"
            >
              Earmark
            </button>

            {/* Desktop nav */}
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

            {/* Right side: balance + wallet */}
            <div className="flex items-center gap-3">
              {isConnected && <UsdcBalance />}
              <ConnectKitButton />
            </div>
          </div>

          {/* Network banner */}
          <div className="px-4 pb-2">
            <NetworkGuard />
          </div>
        </header>
      )}

      {/* Contract not deployed notice */}
      {noContract && showShell && route.page !== 'home' && route.page !== 'how' && (
        <div className="mx-4 mt-4 rounded-card border border-[#F5C6C3] bg-[#FDECEC] p-4 text-sm text-danger">
          The Earmark contract is not yet deployed. Set <code className="font-mono">VITE_EARMARK_ADDRESS</code> in <code className="font-mono">.env</code> after deploying.
        </div>
      )}

      {/* ── Page content ── */}
      {route.page === 'home' && (
        <HomePage
          onSend={() => navigate('send')}
          onMyPots={() => navigate('sent')}
          onForMe={() => navigate('received')}
          onHow={() => navigate('how')}
        />
      )}
      {route.page === 'send' && (
        <CreatePotPage
          onBack={() => navigate('home')}
          onSuccess={(potId) => navigate('pot', potId)}
        />
      )}
      {route.page === 'sent' && (
        <MyPotsPage
          onViewPot={(potId) => navigate('pot', potId)}
        />
      )}
      {route.page === 'received' && (
        <ForMePage
          onViewPot={(potId) => navigate('pot', potId)}
        />
      )}
      {route.page === 'receipt' && route.potId !== undefined && route.paymentIndex !== undefined && (
        <ReceiptPage
          potId={route.potId}
          paymentIndex={route.paymentIndex}
          onBack={() => window.history.back()}
        />
      )}
      {route.page === 'pot' && route.potId !== undefined && (
        <PotPage
          potId={route.potId}
          onBack={() => window.history.back()}
          onReceipt={(potId, index) => navigate('receipt', potId, index)}
        />
      )}
      {route.page === 'how' && (
        <HowItWorksPage onBack={() => navigate('home')} />
      )}

      {/* ── Mobile bottom tab bar ── */}
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

      {/* ── Global footer (shell pages only) ── */}
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
