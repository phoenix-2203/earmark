import { useState, useEffect } from 'react'
import { ConnectKitButton } from 'connectkit'
import NetworkGuard from '@/components/NetworkGuard'
import UsdcBalance from '@/components/UsdcBalance'
import HomePage from '@/pages/HomePage'
import CreatePotPage from '@/pages/CreatePotPage'
import MyPotsPage from '@/pages/MyPotsPage'
import ForMePage from '@/pages/ForMePage'
import ReceiptPage from '@/pages/ReceiptPage'
import PotPage from '@/pages/PotPage'
import { EARMARK_CHAIN, EARMARK_ADDRESS } from '@/earmarkConfig'

type Page = 'home' | 'create' | 'my-pots' | 'for-me' | 'receipt' | 'pot'

interface Route {
  page: Page
  potId?: bigint
  paymentIndex?: number
}

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '') || window.location.pathname
  const receiptMatch = hash.match(/^\/receipt\/(\d+)\/(\d+)$/)
  if (receiptMatch) {
    return { page: 'receipt', potId: BigInt(receiptMatch[1]), paymentIndex: parseInt(receiptMatch[2], 10) }
  }
  const potMatch = hash.match(/^\/pot\/(\d+)$/)
  if (potMatch) {
    return { page: 'pot', potId: BigInt(potMatch[1]) }
  }
  return { page: 'home' }
}

export default function App() {
  const [route, setRoute] = useState<Route>(parseRoute)

  // Sync address bar when navigating
  function navigate(page: Page, potId?: bigint, paymentIndex?: number) {
    const r: Route = { page, potId, paymentIndex }
    setRoute(r)
    if (page === 'receipt' && potId !== undefined && paymentIndex !== undefined) {
      window.history.pushState(null, '', `#/receipt/${potId}/${paymentIndex}`)
    } else if (page === 'pot' && potId !== undefined) {
      window.history.pushState(null, '', `#/pot/${potId}`)
    } else {
      window.history.pushState(null, '', '/')
    }
  }

  useEffect(() => {
    const handler = () => setRoute(parseRoute())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])

  const noContract = EARMARK_ADDRESS.length <= 2

  return (
    <div className="relative min-h-dvh" style={{ background: 'var(--bg-gradient)' }}>
      {/* Top bar — shown on all pages except receipt and public pot page */}
      {route.page !== 'receipt' && route.page !== 'pot' && (
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-4 py-3"
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(20px)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <button
            onClick={() => navigate('home')}
            className="display text-sm font-bold"
            style={{ color: 'var(--ink)' }}
          >
            Earmark
          </button>
          <div className="flex items-center gap-3">
            <UsdcBalance />
            <ConnectKitButton />
          </div>
        </header>
      )}

      {/* Network banner */}
      {route.page !== 'receipt' && route.page !== 'pot' && (
        <div className="pt-2">
          <NetworkGuard />
        </div>
      )}

      {/* Contract not deployed notice */}
      {noContract && route.page !== 'receipt' && route.page !== 'pot' && route.page !== 'home' && (
        <div className="mx-4 mb-4 rounded-2xl p-4 text-sm" style={{ background: 'rgba(186,43,76,0.08)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.2)' }}>
          The Earmark contract is not yet deployed. Set <code className="mono">VITE_EARMARK_ADDRESS</code> in <code className="mono">.env</code> after deploying.
        </div>
      )}

      {/* Pages */}
      {route.page === 'home' && (
        <HomePage
          onSend={() => navigate('create')}
          onMyPots={() => navigate('my-pots')}
          onForMe={() => navigate('for-me')}
        />
      )}
      {route.page === 'create' && (
        <CreatePotPage
          onBack={() => navigate('home')}
          onSuccess={() => navigate('my-pots')}
        />
      )}
      {route.page === 'my-pots' && (
        <MyPotsPage
          onBack={() => navigate('home')}
          onViewPot={(potId) => navigate('pot', potId)}
          onReceipt={(potId, index) => navigate('receipt', potId, index)}
        />
      )}
      {route.page === 'for-me' && (
        <ForMePage
          onBack={() => navigate('home')}
          onViewPot={(potId) => navigate('pot', potId)}
          onReceipt={(potId, index) => navigate('receipt', potId, index)}
        />
      )}
      {route.page === 'receipt' && route.potId !== undefined && route.paymentIndex !== undefined && (
        <ReceiptPage potId={route.potId} paymentIndex={route.paymentIndex} />
      )}
      {route.page === 'pot' && route.potId !== undefined && (
        <PotPage
          potId={route.potId}
          onBack={() => navigate('home')}
          onReceipt={(potId, index) => navigate('receipt', potId, index)}
        />
      )}

      {/* Footer — home page only */}
      {route.page === 'home' && (
        <footer className="fixed bottom-4 left-0 right-0 text-center">
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            On {EARMARK_CHAIN.name} · Experimental. Not audited. Use small amounts.
          </p>
        </footer>
      )}
    </div>
  )
}
