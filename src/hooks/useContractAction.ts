/**
 * useContractAction — shared hook for every write action in Earmark.
 *
 * State machine: idle → checking → awaitingSignature → submitted → confirmed | failed
 *
 * Flow:
 *   check wallet + chain → simulateContract (pre-flight) →
 *   writeContract → submitted (show hash) →
 *   waitForTransactionReceipt →
 *     status=success  → confirmed
 *     status=reverted → re-simulate to decode error name → failed
 *     network/timeout → "Submitted — couldn't confirm, check explorer" → failed
 *
 * Error handling:
 *   - User rejection   → "You cancelled in your wallet. Nothing was sent."
 *   - Pre-flight revert → decode via BaseError.walk → ContractFunctionRevertedError
 *   - Post-submit revert → re-simulate to get error name → friendlyErrorName
 *   - Network error    → "Couldn't reach Arc. Your transaction may still go through — check the explorer link."
 *   - Receipt network err after submit → "Submitted — couldn't confirm yet, check the explorer link."
 */

import { useState, useCallback, useRef } from 'react'
import { useAccount, useSwitchChain } from 'wagmi'
import {
  simulateContract,
  writeContract,
  waitForTransactionReceipt,
} from '@wagmi/core'
import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'
import { config } from '@/config'
import { EARMARK_CHAIN_ID } from '@/earmarkConfig'
import { friendlyErrorName } from '@/earmarkTypes'

export type ActionState =
  | 'idle'
  | 'checking'
  | 'awaitingSignature'
  | 'submitted'
  | 'confirmed'
  | 'failed'

export interface ActionResult {
  state: ActionState
  txHash: `0x${string}` | undefined
  errorMessage: string | undefined
  execute: (params: ExecuteParams) => Promise<void>
  reset: () => void
  isBusy: boolean
}

export interface ContractCallParams {
  address: `0x${string}`
  abi: readonly unknown[]
  functionName: string
  args?: readonly unknown[]
  chainId?: number
}

export interface ExecuteParams {
  contractCall: ContractCallParams
  onSuccess?: (txHash: `0x${string}`) => void | Promise<void>
}

/** Decode a pre-flight or post-submit error into a user-friendly string. */
function decodeContractError(err: unknown): string {
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
  if (s.includes('user rejected') || s.includes('user denied') || s.includes('4001')) {
    return 'You cancelled in your wallet. Nothing was sent.'
  }
  return 'Something went wrong. Please try again.'
}

/**
 * After a tx is already on-chain and the receipt says "reverted", re-run
 * simulateContract with the same params to surface the decoded custom error name.
 * Falls back to a generic message if simulate also fails without an error name.
 */
async function decodeRevertedReceipt(contractCall: ContractCallParams): Promise<string> {
  try {
    // @ts-expect-error – ContractCallParams is valid at runtime
    await simulateContract(config, contractCall)
    // Simulate didn't throw — shouldn't happen after a revert, use generic message
    return 'The transaction was rejected by the contract.'
  } catch (simErr) {
    return decodeContractError(simErr)
  }
}

export function useContractAction(): ActionResult {
  const [state, setState] = useState<ActionState>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const { isConnected, chainId, address } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const runIdRef = useRef(0)

  const reset = useCallback(() => {
    runIdRef.current++
    setState('idle')
    setTxHash(undefined)
    setErrorMessage(undefined)
  }, [])

  const execute = useCallback(async ({ contractCall, onSuccess }: ExecuteParams) => {
    const runId = ++runIdRef.current
    const guard = () => runId === runIdRef.current

    setState('checking')
    setTxHash(undefined)
    setErrorMessage(undefined)

    try {
      // 1. Wallet connected?
      if (!isConnected || !address) {
        throw new Error('Connect your wallet first.')
      }

      // 2. Correct chain?
      if (chainId !== EARMARK_CHAIN_ID) {
        try {
          await switchChainAsync({ chainId: EARMARK_CHAIN_ID })
        } catch {
          if (!guard()) return
          setState('failed')
          setErrorMessage('Switch to Arc network to continue.')
          return
        }
      }

      if (!guard()) return
      setState('awaitingSignature')

      // 3. Pre-flight simulate — surfaces revert before asking the wallet to sign
      // @ts-expect-error – ContractCallParams is valid at runtime
      await simulateContract(config, contractCall)

      if (!guard()) return

      // 4. Write
      // @ts-expect-error – ContractCallParams is valid at runtime
      const hash = await writeContract(config, contractCall)

      if (!guard()) return
      setTxHash(hash)
      setState('submitted')

      // 5. Wait for receipt
      let receipt: { status: string }
      try {
        receipt = await waitForTransactionReceipt(config, { hash, chainId: EARMARK_CHAIN_ID })
      } catch (receiptErr) {
        // Receipt fetch failed. Distinguish between:
        //   a) The node told us the tx reverted (wagmi throws with status=reverted)
        //   b) A genuine network/timeout error — tx probably mined but we lost connectivity
        if (!guard()) return

        const msg = String(receiptErr).toLowerCase()
        const isReverted =
          msg.includes('reverted') ||
          msg.includes('revert') ||
          (receiptErr instanceof BaseError && msg.includes('transaction'))

        if (isReverted) {
          // Re-simulate to decode the revert reason
          const reason = await decodeRevertedReceipt(contractCall)
          if (!guard()) return
          setState('failed')
          setErrorMessage(reason)
        } else {
          // Network/timeout: tx was submitted, we just can't confirm it yet
          setState('failed')
          setErrorMessage(
            'Submitted — couldn\'t confirm yet. Check the explorer link to see if it went through.'
          )
        }
        return
      }

      if (!guard()) return

      // Receipt obtained — check status
      if (receipt.status === 'reverted') {
        const reason = await decodeRevertedReceipt(contractCall)
        if (!guard()) return
        setState('failed')
        setErrorMessage(reason)
        return
      }

      setState('confirmed')
      if (onSuccess) {
        try { await onSuccess(hash) } catch { /* ignore */ }
      }
    } catch (err) {
      if (!guard()) return
      setState('failed')
      setErrorMessage(decodeContractError(err))
    }
  }, [isConnected, chainId, address, switchChainAsync])

  return {
    state,
    txHash,
    errorMessage,
    execute,
    reset,
    isBusy: state === 'checking' || state === 'awaitingSignature' || state === 'submitted',
  }
}
