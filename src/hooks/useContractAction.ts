/**
 * useContractAction — shared hook for every write action in Earmark.
 *
 * State machine: idle → checking → awaitingSignature → submitted → confirmed | failed
 *
 * Flow:
 *   check wallet → useTxSender.send() [simulate + sign + submit] →
 *   submitted (show hash) → waitForTransactionReceipt →
 *     status=success  → confirmed
 *     status=reverted → re-simulate to decode error name → failed
 *     network/timeout → "Submitted — couldn't confirm, check explorer" → failed
 *
 * Routing:
 *   useTxSender automatically picks Privy embedded wallet vs wagmi external wallet
 *   based on which address is active (see src/lib/txSender.ts).
 *
 * Error handling:
 *   - User rejection   → "You cancelled in your wallet. Nothing was sent."
 *   - Pre-flight revert → decoded via TxError.friendlyMessage
 *   - Post-submit revert → re-simulate to get error name → friendlyErrorName
 *   - Network error    → "Couldn't reach Arc. Your transaction may still go through."
 */

import { useState, useCallback, useRef } from 'react'
import { useAccount } from 'wagmi'
import { simulateContract } from '@wagmi/core'
import { BaseError, ContractFunctionRevertedError } from 'viem'
import { config } from '@/config'
import { friendlyErrorName } from '@/earmarkTypes'
import { useTxSender, TxError, decodeTxError } from '@/lib/txSender'

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
  /** Short technical detail (≤160 chars) to show under the friendly error message. */
  errorDetail: string | undefined
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
  description?: string
  onSuccess?: (txHash: `0x${string}`) => void | Promise<void>
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
    return 'The transaction was rejected by the contract.'
  } catch (simErr) {
    if (simErr instanceof BaseError) {
      const revert = simErr.walk((e) => e instanceof ContractFunctionRevertedError)
      if (revert instanceof ContractFunctionRevertedError) {
        const name = revert.data?.errorName
        if (name) return friendlyErrorName(name)
        return revert.shortMessage ?? 'The transaction was rejected by the contract.'
      }
    }
    return decodeTxError(simErr)
  }
}

export function useContractAction(): ActionResult {
  const [state, setState] = useState<ActionState>('idle')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [errorMessage, setErrorMessage] = useState<string | undefined>()
  const [errorDetail, setErrorDetail] = useState<string | undefined>()
  const { isConnected } = useAccount()
  const { send } = useTxSender()
  const runIdRef = useRef(0)

  const reset = useCallback(() => {
    runIdRef.current++
    setState('idle')
    setTxHash(undefined)
    setErrorMessage(undefined)
    setErrorDetail(undefined)
  }, [])

  const execute = useCallback(async ({ contractCall, description, onSuccess }: ExecuteParams) => {
    const runId = ++runIdRef.current
    const guard = () => runId === runIdRef.current

    setState('checking')
    setTxHash(undefined)
    setErrorMessage(undefined)
    setErrorDetail(undefined)

    try {
      if (!isConnected) {
        throw new Error('Connect your wallet first.')
      }

      if (!guard()) return
      setState('awaitingSignature')

      const desc = description ?? contractCall.functionName
      const result = await send(
        {
          address: contractCall.address,
          abi: contractCall.abi,
          functionName: contractCall.functionName,
          args: contractCall.args,
        },
        desc,
      )

      if (!guard()) return
      setTxHash(result.hash)
      setState('submitted')

      if (result.receipt.status === 'reverted') {
        const reason = await decodeRevertedReceipt(contractCall)
        if (!guard()) return
        setState('failed')
        setErrorMessage(reason)
        return
      }

      setState('confirmed')
      if (onSuccess) {
        try { await onSuccess(result.hash) } catch { /* ignore */ }
      }
    } catch (err) {
      if (!guard()) return
      console.error(`[useContractAction] ${contractCall.functionName}:`, err)
      setState('failed')
      if (err instanceof TxError) {
        setErrorMessage(err.friendlyMessage)
        setErrorDetail(err.detail)
      } else {
        setErrorMessage(decodeTxError(err))
        setErrorDetail(err instanceof Error ? err.message.slice(0, 160) : undefined)
      }
    }
  }, [isConnected, send])

  return {
    state,
    txHash,
    errorMessage,
    errorDetail,
    execute,
    reset,
    isBusy: state === 'checking' || state === 'awaitingSignature' || state === 'submitted',
  }
}
