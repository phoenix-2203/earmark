/**
 * Core hooks for reading Earmark contract state.
 * All reads specify chainId so they query Arc even when the wallet is on another chain.
 * refetchInterval: 30 s — live enough for UX, gentle on the public RPC.
 * staleTime: 20 s — prevents a redundant re-fetch on every re-render.
 */

import { useReadContract, useReadContracts } from 'wagmi'
import { EARMARK_ADDRESS, EARMARK_ABI, EARMARK_CHAIN_ID } from '@/earmarkConfig'
import type { Pot, Payment, PayeeRequest, PayeeEntry } from '@/earmarkTypes'

const base = { address: EARMARK_ADDRESS, abi: EARMARK_ABI, chainId: EARMARK_CHAIN_ID } as const

// Shared query options — 30 s refetch, 20 s stale window
const POLL = { refetchInterval: 30_000, staleTime: 20_000 } as const

function hasAddress() {
  return EARMARK_ADDRESS.length > 2
}

export function usePot(potId: bigint | undefined) {
  return useReadContract({
    ...base,
    functionName: 'getPot',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: hasAddress() && potId !== undefined, ...POLL },
  })
}

export function usePotsOfSender(address: `0x${string}` | undefined) {
  return useReadContract({
    ...base,
    functionName: 'potsOfSender',
    args: address ? [address] : undefined,
    query: { enabled: hasAddress() && !!address, ...POLL },
  })
}

export function usePotsOfBeneficiary(address: `0x${string}` | undefined) {
  return useReadContract({
    ...base,
    functionName: 'potsOfBeneficiary',
    args: address ? [address] : undefined,
    query: { enabled: hasAddress() && !!address, ...POLL },
  })
}

export function usePayees(potId: bigint | undefined): {
  data: PayeeEntry[] | undefined
  isLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => any
} {
  const result = useReadContract({
    ...base,
    functionName: 'getPayees',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: hasAddress() && potId !== undefined, ...POLL },
  })

  const data: PayeeEntry[] | undefined =
    result.data && Array.isArray(result.data[0])
      ? (result.data[0] as `0x${string}`[]).map((addr, i) => ({
          address: addr,
          label: (result.data as [string[], string[]])[1][i] ?? '',
        }))
      : undefined

  return { data, isLoading: result.isLoading, refetch: result.refetch }
}

export function usePayments(potId: bigint | undefined): {
  data: Payment[] | undefined
  isLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => any
} {
  const result = useReadContract({
    ...base,
    functionName: 'getPayments',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: hasAddress() && potId !== undefined, ...POLL },
  })

  return {
    data: result.data as Payment[] | undefined,
    isLoading: result.isLoading,
    refetch: result.refetch,
  }
}

export function usePayeeRequests(potId: bigint | undefined): {
  data: PayeeRequest[] | undefined
  isLoading: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refetch: () => any
} {
  const result = useReadContract({
    ...base,
    functionName: 'getPayeeRequests',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: hasAddress() && potId !== undefined, ...POLL },
  })

  return {
    data: result.data as PayeeRequest[] | undefined,
    isLoading: result.isLoading,
    refetch: result.refetch,
  }
}

/** Fetch multiple pots by ID in one multicall */
export function useMultiplePots(potIds: bigint[]): {
  pots: (Pot | undefined)[]
  isLoading: boolean
} {
  const contracts = potIds.map((id) => ({
    ...base,
    functionName: 'getPot' as const,
    args: [id] as [bigint],
  }))

  const result = useReadContracts({
    contracts,
    query: { enabled: hasAddress() && potIds.length > 0, ...POLL },
  })

  const pots = result.data?.map((r) => r.result) ?? potIds.map(() => undefined)
  return { pots, isLoading: result.isLoading }
}
