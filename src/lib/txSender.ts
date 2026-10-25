/**
 * src/lib/txSender.ts
 *
 * useTxSender — unified write-transaction hook for Earmark.
 *
 * Automatically routes each write through the correct signer:
 *   'privy'  — when Privy is enabled and the active wagmi address is the
 *              Privy embedded wallet; uses useSendTransaction from
 *              @privy-io/react-auth (embedded key, no extension interference).
 *   'wagmi'  — external wallet (MetaMask, WalletConnect, etc.) or when Privy
 *              is not enabled; uses writeContract from @wagmi/core with a
 *              chain switch pre-check.
 *
 * Both routes:
 *   1. simulateContract first to surface decoded contract errors pre-flight.
 *   2. Return the tx hash.
 *   3. Callers wait with publicClient.waitForTransactionReceipt.
 *
 * chooseRoute — pure function, exported for unit tests.
 */

import { useAccount, useSwitchChain } from 'wagmi'
import { simulateContract, writeContract, waitForTransactionReceipt } from '@wagmi/core'
import {
  encodeFunctionData,
  getAddress,
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
} from 'viem'
import { useSendTransaction } from '@privy-io/react-auth'
import { config } from '@/config'
import { EARMARK_CHAIN_ID, publicClient } from '@/earmarkConfig'
import { PRIVY_ENABLED, useEmbeddedAddress } from '@/lib/privy'
import { friendlyErrorName } from '@/earmarkTypes'
import { chooseRoute } from '@/lib/chooseRoute'

export { chooseRoute } from '@/lib/chooseRoute'
export type { TxRoute } from '@/lib/chooseRoute'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ContractCall {
  address: `0x${string}`
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
}

export interface SendResult {
  hash: `0x${string}`
  receipt: { status: 'success' | 'reverted' }
}

// ── Error decoding (shared) ───────────────────────────────────────────────────

/** Returns a user-friendly string from any transaction error. */
export function decodeTxError(err: unknown): string {
  if (err instanceof UserRejectedRequestError) {
    return 'You cancelled in your wallet. Nothing was sent.'
  }
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError)
    if (rejected) return 'You cancelled in your wallet. Nothing was sent.'

    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name) return friendlyErrorName(name)
      return revert.shortMessage ?? 'The transaction was rejected by the contract.'
    }

    const msg = err.message.toLowerCase()
    if (
      msg.includes('network') ||
      msg.includes('fetch') ||
      msg.includes('timeout') ||
      msg.includes('rpc')
    ) {
      return "Couldn't reach Arc. Your transaction may still go through — check the explorer link."
    }

    return err.shortMessage ?? err.message ?? 'Something went wrong.'
  }
  const s = String(err).toLowerCase()
  if (s.includes('user rejected') || s.includes('user denied') || s.includes('4001') ||
      s.includes('cancel') || s.includes('closed')) {
    return 'You cancelled in your wallet. Nothing was sent.'
  }
  return 'Something went wrong. Please try again.'
}

/** Short technical detail (≤160 chars) to display under the friendly message. */
export function getTxErrorDetail(err: unknown): string | undefined {
  if (err instanceof BaseError) {
    const detail = err.shortMessage ?? err.message
    if (detail) return detail.slice(0, 160)
  }
  if (err instanceof Error) return err.message.slice(0, 160)
  return undefined
}

// ── useTxSender ───────────────────────────────────────────────────────────────

export interface TxSender {
  /**
   * Send a contract write, choosing the correct signer automatically.
   * Simulates first, then signs and waits for receipt.
   * Throws a decorated Error with `.friendlyMessage` and `.detail` on failure.
   */
  send: (call: ContractCall, description: string) => Promise<SendResult>
}

/** Error thrown by send(); carries a user-friendly message and an optional detail string. */
export class TxError extends Error {
  friendlyMessage: string
  detail: string | undefined
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  declare cause: any
  constructor(friendlyMessage: string, detail: string | undefined, cause?: unknown) {
    super(friendlyMessage)
    this.name = 'TxError'
    this.friendlyMessage = friendlyMessage
    this.detail = detail
    this.cause = cause
  }
}

export function useTxSender(): TxSender {
  const { address: activeAddress, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const embeddedAddress = useEmbeddedAddress()

  // useSendTransaction is always called (hooks must not be conditional).
  // When PRIVY_ENABLED is false the component tree has no PrivyProvider so
  // this hook must not be called. We guard by always having it called — it's safe
  // because when PRIVY_ENABLED is false the chooseRoute always returns 'wagmi'
  // and the privy branch is never reached. However, calling it outside PrivyProvider
  // would throw a context error. So we only call it when PRIVY_ENABLED is true.
  // The hook count is constant because PRIVY_ENABLED is a build-time constant.
  const privySend = PRIVY_ENABLED
    // eslint-disable-next-line react-hooks/rules-of-hooks
    ? useSendTransaction()
    : null

  const send = async (call: ContractCall, description: string): Promise<SendResult> => {
    if (!isConnected || !activeAddress) {
      throw new TxError('Connect your wallet first.', undefined)
    }

    const route = chooseRoute({
      privyEnabled: PRIVY_ENABLED,
      activeAddress,
      embeddedAddress,
    })

    try {
      // Pre-flight simulate on both routes — surfaces contract errors before signing.
      await simulateContract(config, {
        ...(call as Parameters<typeof simulateContract>[1]),
        account: activeAddress,
        chainId: EARMARK_CHAIN_ID,
      })

      if (route === 'privy') {
        // Privy embedded wallet: encode calldata and send via Privy's own signer.
        // This bypasses wagmi / MetaMask entirely.
        const data = encodeFunctionData({
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        })

        const { sendTransaction } = privySend!
        const { hash } = await sendTransaction(
          { to: call.address, data, chainId: EARMARK_CHAIN_ID },
          {
            address: getAddress(embeddedAddress!),
            uiOptions: { description },
          }
        )

        const r = await publicClient.waitForTransactionReceipt({ hash: hash })
        return { hash: hash, receipt: { status: r.status } }

      } else {
        // External wallet: ensure correct chain, then writeContract.
        try {
          await switchChainAsync({ chainId: EARMARK_CHAIN_ID })
        } catch {
          // switchChain may throw if already on correct chain — ignore
        }

        const hash = await writeContract(
          config,
          // Cast: ContractCall is structurally compatible with WriteContractParameters at runtime
          { ...call },
        )
        const receipt = await waitForTransactionReceipt(config, { hash, chainId: EARMARK_CHAIN_ID })
        return { hash, receipt }
      }
    } catch (err) {
      console.error(`[txSender] ${call.functionName}:`, err)
      const friendly = decodeTxError(err)
      const detail = getTxErrorDetail(err)
      throw new TxError(friendly, detail, err)
    }
  }

  return { send }
}
