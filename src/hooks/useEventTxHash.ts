/**
 * useEventTxHash — look up the transaction hash for a specific Earmark event
 * by scanning getLogs in chunks of 9,000 blocks, newest first.
 * Results are cached in module-level memory so navigating back doesn't re-scan.
 */

import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { arcTestnet } from 'viem/chains'
import { EARMARK_ADDRESS, EARMARK_ABI, EARMARK_FROM_BLOCK } from '@/earmarkConfig'

// Use the viem chain object so createPublicClient gets a proper Chain type
const VIEM_CHAIN = arcTestnet // Arc Testnet (chainId 5042002); mainnet would be a custom chain object

const cache = new Map<string, `0x${string}` | null>()

const CHUNK = 9_000n

function getClient() {
  return createPublicClient({
    chain: VIEM_CHAIN,
    transport: http(),
  })
}

/**
 * Find the tx hash for a specific Paid event (potId, paymentIndex).
 */
export function usePaidEventTxHash(potId: bigint | undefined, paymentIndex: number | undefined) {
  const key = potId !== undefined && paymentIndex !== undefined
    ? `paid:${potId}:${paymentIndex}`
    : null
  const [txHash, setTxHash] = useState<`0x${string}` | null>(() => key ? (cache.get(key) ?? null) : null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!key || potId === undefined || paymentIndex === undefined) return
    if (cache.has(key)) {
      // Already cached — no state update needed; initial state was set from cache
      return
    }
    if (!EARMARK_ADDRESS || EARMARK_ADDRESS.length <= 2) return

    let cancelled = false

    void (async () => {
      if (cancelled) return
      setLoading(true)
      try {
        const client = getClient()
        const head = await client.getBlockNumber()
        const from = EARMARK_FROM_BLOCK > 0n ? EARMARK_FROM_BLOCK : 0n
        // Scan from newest to oldest
        let hi = head
        let found: `0x${string}` | null = null

        while (hi >= from) {
          if (cancelled) return
          const lo = hi >= CHUNK ? hi - CHUNK + 1n : from
          const actualLo = lo < from ? from : lo

          const logs = await client.getContractEvents({
            address: EARMARK_ADDRESS,
            abi: EARMARK_ABI,
            eventName: 'Paid',
            args: {
              potId: potId,
              paymentIndex: BigInt(paymentIndex),
            },
            fromBlock: actualLo,
            toBlock: hi,
          })

          if (logs.length > 0 && logs[0].transactionHash) {
            found = logs[0].transactionHash
            break
          }

          if (hi < CHUNK || lo <= from) break
          hi = lo - 1n
        }

        if (cancelled) return
        cache.set(key, found)
        setTxHash(found)
      } catch {
        if (!cancelled) cache.set(key, null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [key, potId, paymentIndex])

  return { txHash, loading }
}

/**
 * Find the tx hash for the PotCreated event for a given potId.
 */
export function usePotCreatedTxHash(potId: bigint | undefined) {
  const key = potId !== undefined ? `created:${potId}` : null
  const [txHash, setTxHash] = useState<`0x${string}` | null>(() => key ? (cache.get(key) ?? null) : null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!key || potId === undefined) return
    if (cache.has(key)) {
      // Already cached — no state update needed; initial state was set from cache
      return
    }
    if (!EARMARK_ADDRESS || EARMARK_ADDRESS.length <= 2) return

    let cancelled = false

    void (async () => {
      if (cancelled) return
      setLoading(true)
      try {
        const client = getClient()
        const head = await client.getBlockNumber()
        const from = EARMARK_FROM_BLOCK > 0n ? EARMARK_FROM_BLOCK : 0n
        let hi = head
        let found: `0x${string}` | null = null

        while (hi >= from) {
          if (cancelled) return
          const lo = hi >= CHUNK ? hi - CHUNK + 1n : from
          const actualLo = lo < from ? from : lo

          const logs = await client.getContractEvents({
            address: EARMARK_ADDRESS,
            abi: EARMARK_ABI,
            eventName: 'PotCreated',
            args: { potId },
            fromBlock: actualLo,
            toBlock: hi,
          })

          if (logs.length > 0 && logs[0].transactionHash) {
            found = logs[0].transactionHash
            break
          }

          if (hi < CHUNK || lo <= from) break
          hi = lo - 1n
        }

        if (cancelled) return
        cache.set(key, found)
        setTxHash(found)
      } catch {
        if (!cancelled) cache.set(key, null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [key, potId])

  return { txHash, loading }
}
