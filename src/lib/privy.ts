/**
 * src/lib/privy.ts
 *
 * Privy configuration for Earmark.
 *
 * If VITE_PRIVY_APP_ID is not set this module exports { PRIVY_ENABLED: false }
 * and every Privy-aware component falls back gracefully to ConnectKit.
 *
 * When PRIVY_ENABLED is true it also exports:
 *  - PRIVY_APP_ID         — the app id string
 *  - PRIVY_VIEM_CHAIN     — a viem-compatible chain definition for PrivyProvider
 *  - privyConfig          — PrivyClientConfig to pass to <PrivyProvider>
 *  - usePrivyReady        — hook: returns { ready, timedOut } (10 s timeout)
 */

import { useState, useEffect } from 'react'
import { defineChain } from 'viem'
import { usePrivy } from '@privy-io/react-auth'
import type { PrivyClientConfig } from '@privy-io/react-auth'
import { EARMARK_CHAIN } from '@/earmarkConfig'

export const PRIVY_ENABLED = !!import.meta.env.VITE_PRIVY_APP_ID

// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
export const PRIVY_APP_ID: string = (import.meta.env.VITE_PRIVY_APP_ID ?? '') as string

/**
 * A viem defineChain for the active Arc network.
 * USDC is the native token on Arc — 18 decimals (native gas view).
 */
export const PRIVY_VIEM_CHAIN = defineChain({
  id: EARMARK_CHAIN.chainId,
  name: EARMARK_CHAIN.name,
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 18,  // Arc native gas view decimals
  },
  rpcUrls: {
    default: { http: EARMARK_CHAIN.rpcUrls as [string, ...string[]] },
  },
  blockExplorers: {
    default: { name: 'Explorer', url: EARMARK_CHAIN.explorerBase },
  },
})

export const privyConfig: PrivyClientConfig = {
  loginMethods: ['google', 'email', 'wallet'],
  embeddedWallets: {
    ethereum: {
      createOnLogin: 'users-without-wallets',
    },
  },
  defaultChain: PRIVY_VIEM_CHAIN,
  supportedChains: [PRIVY_VIEM_CHAIN],
  appearance: {
    theme: 'light',
    accentColor: '#0F6B5C',
    // no logo — keeps Privy modal clean
  },
}

/**
 * usePrivyReady — wraps usePrivy and adds a 10 s timeout.
 *
 * Returns:
 *  - ready     true when Privy finished initialising
 *  - timedOut  true when 10 s passed and Privy still isn't ready
 *
 * Only call from components rendered inside PrivyProvider.
 * Components should check timedOut before ready and offer the wallet-connect
 * fallback: "Couldn't reach the sign-in service. Refresh the page, or connect a wallet instead."
 */
export function usePrivyReady(): { ready: boolean; timedOut: boolean } {
  const { ready } = usePrivy()
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (ready) return
    const id = setTimeout(() => setTimedOut(true), 10_000)
    return () => clearTimeout(id)
  }, [ready])

  return { ready, timedOut }
}
