import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { TokenUSDC } from '@web3icons/react'
import { USDC_ADDRESS, EARMARK_CHAIN_ID } from '@/earmarkConfig'
import { formatUsdc } from '@/utils/format'

export default function UsdcBalance() {
  const { address, isConnected } = useAccount()

  const { data: balance, isLoading } = useReadContract({
    address: USDC_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: EARMARK_CHAIN_ID,
    query: { enabled: isConnected && !!address, refetchInterval: 30_000, staleTime: 20_000 },
  })

  if (!isConnected) return null

  return (
    <div className="flex items-center gap-1.5">
      <TokenUSDC variant="branded" size={18} />
      <span className="font-mono tabular-nums text-sm font-medium text-[var(--ink)]">
        {isLoading ? '…' : `${formatUsdc(balance ?? 0n)}`}
      </span>
    </div>
  )
}
