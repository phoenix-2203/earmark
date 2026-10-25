/**
 * src/lib/chooseRoute.ts
 *
 * Pure, side-effect-free function that decides which signer to use for a
 * transaction.  Kept in its own module so unit tests can import it without
 * pulling in any browser-only dependencies (wagmi, viem, tracing, …).
 *
 * Re-exported from txSender.ts — callers can import from either path.
 */

export type TxRoute = 'privy' | 'wagmi'

/**
 * Decide which signer to use for a transaction.
 *
 * Rules:
 *  - Privy not enabled            → 'wagmi'
 *  - No active wallet address     → 'wagmi'  (will fail later with "connect wallet")
 *  - No embedded wallet           → 'wagmi'
 *  - active === embedded (case-insensitive) → 'privy'
 *  - active !== embedded          → 'wagmi'  (external wallet connected)
 */
export function chooseRoute({
  privyEnabled,
  activeAddress,
  embeddedAddress,
}: {
  privyEnabled: boolean
  activeAddress: string | undefined
  embeddedAddress: string | undefined
}): TxRoute {
  if (!privyEnabled) return 'wagmi'
  if (!activeAddress || !embeddedAddress) return 'wagmi'
  if (activeAddress.toLowerCase() === embeddedAddress.toLowerCase()) return 'privy'
  return 'wagmi'
}
