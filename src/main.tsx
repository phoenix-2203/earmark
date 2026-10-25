/*
 *  ███████╗████████╗██╗   ██╗██████╗ ██╗ ██████╗
 *  ██╔════╝╚══██╔══╝██║   ██║██╔══██╗██║██╔═══██╗
 *  ███████╗   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ╚════██║   ██║   ██║   ██║██║  ██║██║██║   ██║
 *  ███████║   ██║   ╚██████╔╝██████╔╝██║╚██████╔╝
 *  ╚══════╝   ╚═╝    ╚═════╝ ╚═════╝ ╚═╝ ╚═════╝
 *
 *  Built with Arc Studio
 *  https://studio.arc.io
 */

import './tracing'
import './console-capture'

import { StrictMode, Component } from 'react'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import App from './App'
import './index.css'
import { PRIVY_ENABLED, PRIVY_APP_ID, PRIVY_VIEM_CHAIN, privyConfig } from './lib/privy'

// Studio logo SVG
const StudioLogo = () => (
  <svg width="14" height="16" viewBox="0 0 20 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M0 21.5001C0.167192 16.2366 1.02308 11.3243 2.45378 7.50459C4.26573 2.66517 6.88869 0 9.83904 0C12.7894 0 15.412 2.66517 17.2243 7.50459C18.1669 10.0216 18.8605 13.0121 19.2713 16.2655C19.3081 16.556 19.3393 16.8513 19.3714 17.146C19.3819 17.1642 19.3881 17.1811 19.386 17.1949C19.386 17.1949 19.6275 18.7674 19.6788 21.5001H19.6515C19.2934 21.1937 15.0694 17.7329 8.06739 18.735C8.17304 17.4996 8.31833 16.2974 8.50603 15.1452C8.51562 15.0863 8.52671 15.0294 8.53649 14.9709C11.2828 14.8846 13.6866 15.2171 15.5299 15.6529C15.5231 15.6073 15.5173 15.5603 15.5103 15.5149C15.1314 13.0547 14.5724 10.8024 13.8517 8.87761C12.6732 5.73037 11.1354 3.77496 9.83904 3.77496C8.54269 3.77496 7.00493 5.73037 5.82649 8.87761C5.54123 9.63889 5.28154 10.4508 5.04866 11.3071C4.72126 12.507 4.44621 13.7934 4.22654 15.1451C3.90141 17.1412 3.69827 19.2821 3.62345 21.5001H0Z" fill="currentColor"/>
  </svg>
)

// Studio watermark component - links back to Studio
// On mobile the tab bar is 56px; bump the watermark above it.
const StudioWatermark = () => (
  <a
    href="https://studio.arc.io/"
    target="_blank"
    rel="noopener noreferrer"
    className="arc-studio-watermark"
    style={{
      position: 'fixed',
      bottom: '16px',
      right: '16px',
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      fontSize: '12px',
      fontWeight: 600,
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#1B3158',
      textDecoration: 'none',
      cursor: 'pointer',
      background: 'rgba(172, 198, 233, 0.85)',
      backdropFilter: 'blur(12px) saturate(180%)',
      WebkitBackdropFilter: 'blur(12px) saturate(180%)',
      borderRadius: '20px',
      border: '1px solid rgba(255, 255, 255, 0.4)',
      zIndex: 9999,
      boxShadow: '0 4px 20px rgba(27, 49, 88, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
    }}
  >
    <StudioLogo />
    Built with Arc Studio
  </a>
)

const queryClient = new QueryClient()

function AppTree() {
  return (
    <>
      <App />
      <StudioWatermark />
      <Toaster position="top-center" />
    </>
  )
}

// ── PrivyErrorBoundary ────────────────────────────────────────────────────────
// Catches any error thrown during PrivyProvider initialisation (e.g. invalid
// app ID, network failure) and renders the ConnectKit fallback tree instead.

interface BoundaryProps {
  children: ReactNode
  fallback: ReactNode
}
interface BoundaryState { hasError: boolean }

class PrivyErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  constructor(props: BoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(): BoundaryState {
    return { hasError: true }
  }
  componentDidCatch(err: unknown) {
    // Log once — never rethrow; fallback tree takes over
    console.error('[Earmark] PrivyProvider failed to initialise:', err)
  }
  render() {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

if (PRIVY_ENABLED) {
  // Dynamic import so that the Privy bundle is excluded when not configured.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  Promise.all([
    import('@privy-io/react-auth'),
    import('@privy-io/wagmi'),
    import('wagmi'),
    import('connectkit'),
    import('./config'),
  ]).then(([{ PrivyProvider }, { WagmiProvider: PrivyWagmiProvider, createConfig }, { WagmiProvider, http }, { ConnectKitProvider }, { config: ckConfig }]) => {
    const privyWagmiConfig = createConfig({
      chains: [PRIVY_VIEM_CHAIN],
      transports: {
        [PRIVY_VIEM_CHAIN.id]: http(PRIVY_VIEM_CHAIN.rpcUrls.default.http[0]),
      },
    })

    // Fallback ConnectKit tree — rendered by PrivyErrorBoundary when PrivyProvider
    // throws (e.g. invalid app ID). Uses the standard wagmi WagmiProvider + ckConfig.
    const connectKitFallback = (
      <WagmiProvider config={ckConfig}>
        <QueryClientProvider client={queryClient}>
          <ConnectKitProvider>
            <AppTree />
          </ConnectKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    )

    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <PrivyErrorBoundary fallback={connectKitFallback}>
          <PrivyProvider appId={PRIVY_APP_ID} config={privyConfig}>
            <QueryClientProvider client={queryClient}>
              <PrivyWagmiProvider config={privyWagmiConfig}>
                <AppTree />
              </PrivyWagmiProvider>
            </QueryClientProvider>
          </PrivyProvider>
        </PrivyErrorBoundary>
      </StrictMode>,
    )
  })
} else {
  // No Privy — use the existing wagmi + ConnectKit setup unchanged.
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  Promise.all([
    import('wagmi'),
    import('connectkit'),
    import('./config'),
  ]).then(([{ WagmiProvider }, { ConnectKitProvider }, { config }]) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <ConnectKitProvider>
              <AppTree />
            </ConnectKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </StrictMode>,
    )
  })
}
