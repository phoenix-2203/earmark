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
import { erc20Abi } from 'viem'
import { usePrivy, useWallets } from '@privy-io/react-auth'
import { useSetActiveWallet } from '@privy-io/wagmi'
import { useAccount, useReadContract } from 'wagmi'
import type { PrivyClientConfig } from '@privy-io/react-auth'
import { EARMARK_CHAIN, USDC_ADDRESS, EARMARK_CHAIN_ID } from '@/earmarkConfig'
import { formatUsdc } from '@/utils/format'

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

/**
 * usePayingWith — returns info about the currently active wallet for display in forms.
 *
 * Only call from components rendered inside PrivyProvider (PRIVY_ENABLED guard in the
 * outer shell; PrivyProvider wraps the inner component).
 *
 * Returns:
 *  - label          'Earmark wallet' | 'MetaMask' | short address
 *  - address        checksummed active address or undefined
 *  - balanceLabel   formatted USDC balance or '—'
 *  - hasEmbedded    true if the user has a Privy embedded wallet
 *  - hasExternal    true if there is at least one non-embedded wallet connected
 *  - setEmbedded    () => void — make the embedded wallet active
 *  - setExternal    () => void — make the first external wallet active
 */
export function usePayingWith() {
  const { wallets } = useWallets()
  const { setActiveWallet } = useSetActiveWallet()
  const { address: activeAddress } = useAccount()

  const embedded = wallets.find((w) => w.walletClientType === 'privy')
  const external = wallets.find((w) => w.walletClientType !== 'privy')

  const isEmbeddedActive = !!(embedded && activeAddress &&
    embedded.address.toLowerCase() === activeAddress.toLowerCase())

  const label = isEmbeddedActive
    ? 'Earmark wallet'
    : external?.meta.name ?? (activeAddress ? activeAddress.slice(0, 6) + '…' + activeAddress.slice(-4) : 'Wallet')

  const { data: balance } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: activeAddress ? [activeAddress] : undefined,
    chainId: EARMARK_CHAIN_ID,
    query: { enabled: !!activeAddress, refetchInterval: 30_000 },
  })

  const balanceLabel = balance !== undefined ? formatUsdc(balance) : '—'

  const shortAddress = activeAddress
    ? activeAddress.slice(0, 6) + '…' + activeAddress.slice(-4)
    : undefined

  return {
    label,
    address: activeAddress,
    shortAddress,
    balanceLabel,
    hasEmbedded: !!embedded,
    hasExternal: !!external,
    setEmbedded: () => { if (embedded) void setActiveWallet(embedded) },
    setExternal: () => { if (external) void setActiveWallet(external) },
    isEmbeddedActive,
  }
}
