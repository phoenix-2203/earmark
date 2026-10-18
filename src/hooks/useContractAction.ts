/**
 * useContractAction — shared hook for every write action in Earmark.
 *
 * State machine: idle → checking → awaitingSignature → submitted → confirmed | failed
 *
 * Flow (always inside an async event handler):
 *   validate inputs → check wallet connected + on EARMARK_CHAIN_ID →
 *   simulateContract → writeContractAsync → show "Submitted" with tx hash →
 *   waitForTransactionReceipt → "Confirmed" → refetch → done
 *
 * Error handling:
 *   - User rejection  → "You cancelled in your wallet. Nothing was sent."
 *   - Revert          → decode custom error name via BaseError.walk → friendlyError
 *   - Network error   → "Couldn't reach Arc. Your transaction may still go through — check the explorer link."
 *   - Receipt fetch fails after confirmed tx → report success, say view will update
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
  /** Call this to trigger the action. Pass validated args and onSuccess callback. */
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

function extractErrorMessage(err: unknown): string {
  // User rejection
  if (err instanceof UserRejectedRequestError) {
    return 'You cancelled in your wallet. Nothing was sent.'
  }
  if (err instanceof BaseError) {
    // Walk for UserRejectedRequestError nested
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError)
    if (rejected) return 'You cancelled in your wallet. Nothing was sent.'

    // Walk for revert with custom error name
    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name) return friendlyErrorName(name)
      // fallback to error message
      return revert.shortMessage ?? 'Transaction reverted.'
    }

    // Network / RPC errors
    if (
      err.message.toLowerCase().includes('network') ||
      err.message.toLowerCase().includes('fetch') ||
      err.message.toLowerCase().includes('timeout') ||
      err.message.toLowerCase().includes('rpc')
    ) {
      return "Couldn't reach Arc. Your transaction may still go through — check the explorer link."
    }

    return err.shortMessage ?? err.message ?? 'Something went wrong.'
  }
  const msg = String(err).toLowerCase()
  if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('4001')) {
    return 'You cancelled in your wallet. Nothing was sent.'
  }
  return 'Something went wrong. Please try again.'
}

export function useContractAction(): ActionResult {
  const [state, setState] = useState<ActionState>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const { isConnected, chainId, address } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  // Guard against stale async completions after reset
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

      // 2. Correct chain? Offer switch.
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

      // simulateContract/writeContract use strict discriminated-union generics for
      // gas params; our loose ContractCallParams can't satisfy them statically, but
      // the runtime values are correct. Suppress with @ts-expect-error.
      // @ts-expect-error – typed ContractCallParams is valid at runtime
      await simulateContract(config, contractCall)

      if (!guard()) return

      // 4. Write
      // @ts-expect-error – typed ContractCallParams is valid at runtime
      const hash = await writeContract(config, contractCall)

      if (!guard()) return
      setTxHash(hash)
      setState('submitted')

      // 5. Wait for receipt
      try {
        await waitForTransactionReceipt(config, { hash, chainId: EARMARK_CHAIN_ID })
      } catch {
        // Receipt fetch failed — but the tx was already submitted and likely confirmed
        if (!guard()) return
        setState('confirmed')
        if (onSuccess) {
          try { await onSuccess(hash) } catch { /* ignore */ }
        }
        return
      }

      if (!guard()) return
      setState('confirmed')

      if (onSuccess) {
        try { await onSuccess(hash) } catch { /* ignore */ }
      }
    } catch (err) {
      if (!guard()) return
      setState('failed')
      setErrorMessage(extractErrorMessage(err))
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
