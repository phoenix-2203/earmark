/**
 * Earmark contract configuration.
 * Select the active network via VITE_NETWORK=testnet (default) | mainnet.
 *
 * The contract ABI is imported from the Foundry artifact after `forge build`.
 * Until the contract is deployed, VITE_EARMARK_ADDRESS is empty and the app
 * shows a "contract not deployed" notice.
 */

import { getUsdc, requireChain } from '@/onchain-facts'

const networkEnv = String(import.meta.env.VITE_NETWORK ?? 'testnet').toLowerCase()
const isMainnet = networkEnv === 'mainnet'

// Arc Testnet: 5042002 | Arc Mainnet: 5042
export const EARMARK_CHAIN_ID = isMainnet ? 5042 : 5042002

export const EARMARK_CHAIN = requireChain(EARMARK_CHAIN_ID)

const usdcFact = getUsdc(EARMARK_CHAIN_ID)
if (!usdcFact) throw new Error(`USDC not found for chain ${EARMARK_CHAIN_ID}`)
export const USDC_ADDRESS = usdcFact.address as `0x${string}`
export const USDC_DECIMALS_LOCAL = usdcFact.decimals

// Set via .env: VITE_EARMARK_ADDRESS=0x...
export const EARMARK_ADDRESS = (import.meta.env.VITE_EARMARK_ADDRESS ?? '') as `0x${string}`

export const EARMARK_ABI = [
  // createPot
  {
    type: 'function',
    name: 'createPot',
    inputs: [
      { name: 'beneficiary', type: 'address' },
      { name: 'title', type: 'string' },
      { name: 'category', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'expiry', type: 'uint256' },
      { name: 'payees', type: 'address[]' },
      { name: 'payeeLabels', type: 'string[]' },
    ],
    outputs: [{ name: 'potId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  // topUp
  {
    type: 'function',
    name: 'topUp',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // addPayee
  {
    type: 'function',
    name: 'addPayee',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'payee', type: 'address' },
      { name: 'label', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // removePayee
  {
    type: 'function',
    name: 'removePayee',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'payee', type: 'address' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // requestPayee
  {
    type: 'function',
    name: 'requestPayee',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'payee', type: 'address' },
      { name: 'label', type: 'string' },
      { name: 'reason', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // approvePayeeRequest
  {
    type: 'function',
    name: 'approvePayeeRequest',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'requestId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // rejectPayeeRequest
  {
    type: 'function',
    name: 'rejectPayeeRequest',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'requestId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // pay
  {
    type: 'function',
    name: 'pay',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'payee', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // reclaim
  {
    type: 'function',
    name: 'reclaim',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // releaseToBeneficiary
  {
    type: 'function',
    name: 'releaseToBeneficiary',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // extendExpiry
  {
    type: 'function',
    name: 'extendExpiry',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'newExpiry', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // getPot
  {
    type: 'function',
    name: 'getPot',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          { name: 'id', type: 'uint256' },
          { name: 'sender', type: 'address' },
          { name: 'beneficiary', type: 'address' },
          { name: 'title', type: 'string' },
          { name: 'category', type: 'uint8' },
          { name: 'balance', type: 'uint256' },
          { name: 'totalFunded', type: 'uint256' },
          { name: 'totalSpent', type: 'uint256' },
          { name: 'expiry', type: 'uint256' },
          { name: 'closed', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // potsOfSender
  {
    type: 'function',
    name: 'potsOfSender',
    inputs: [{ name: 'sender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  // potsOfBeneficiary
  {
    type: 'function',
    name: 'potsOfBeneficiary',
    inputs: [{ name: 'beneficiary', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  // getPayees
  {
    type: 'function',
    name: 'getPayees',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [
      { name: 'addrs', type: 'address[]' },
      { name: 'labels', type: 'string[]' },
    ],
    stateMutability: 'view',
  },
  // getPayments
  {
    type: 'function',
    name: 'getPayments',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'payee', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'memo', type: 'string' },
          { name: 'timestamp', type: 'uint256' },
          { name: 'payer', type: 'address' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // getPayeeRequests
  {
    type: 'function',
    name: 'getPayeeRequests',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'payee', type: 'address' },
          { name: 'label', type: 'string' },
          { name: 'reason', type: 'string' },
          { name: 'resolved', type: 'bool' },
          { name: 'approved', type: 'bool' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  // potCount
  {
    type: 'function',
    name: 'potCount',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // pendingRequestCount
  {
    type: 'function',
    name: 'pendingRequestCount',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  // events
  {
    type: 'event',
    name: 'PotCreated',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'sender', type: 'address', indexed: true },
      { name: 'beneficiary', type: 'address', indexed: true },
      { name: 'title', type: 'string', indexed: false },
      { name: 'category', type: 'uint8', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'expiry', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Paid',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'paymentIndex', type: 'uint256', indexed: true },
      { name: 'payee', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
      { name: 'payer', type: 'address', indexed: false },
    ],
  },
  // errors
  { type: 'error', name: 'ZeroAddress', inputs: [] },
  { type: 'error', name: 'ZeroAmount', inputs: [] },
  { type: 'error', name: 'SelfBeneficiary', inputs: [] },
  { type: 'error', name: 'InvalidExpiry', inputs: [] },
  { type: 'error', name: 'PotClosed', inputs: [] },
  { type: 'error', name: 'PotExpired', inputs: [] },
  { type: 'error', name: 'NotSender', inputs: [] },
  { type: 'error', name: 'NotBeneficiary', inputs: [] },
  { type: 'error', name: 'NotParticipant', inputs: [] },
  { type: 'error', name: 'AlreadyApprovedPayee', inputs: [] },
  { type: 'error', name: 'PayeeNotApproved', inputs: [{ name: 'payee', type: 'address' }] },
  { type: 'error', name: 'SenderCannotBePayee', inputs: [] },
  { type: 'error', name: 'BeneficiaryCannotBePayee', inputs: [] },
  { type: 'error', name: 'ContractCannotBePayee', inputs: [] },
  { type: 'error', name: 'MaxPayeesReached', inputs: [] },
  { type: 'error', name: 'TooManyPendingRequests', inputs: [] },
  { type: 'error', name: 'TitleTooLong', inputs: [] },
  { type: 'error', name: 'LabelTooLong', inputs: [] },
  { type: 'error', name: 'MemoTooLong', inputs: [] },
  { type: 'error', name: 'ReasonTooLong', inputs: [] },
  { type: 'error', name: 'InsufficientBalance', inputs: [] },
  { type: 'error', name: 'AtLeastOnePayee', inputs: [] },
  { type: 'error', name: 'RequestAlreadyResolved', inputs: [] },
  { type: 'error', name: 'ExpiryNotLater', inputs: [] },
  { type: 'error', name: 'PayeeLengthMismatch', inputs: [] },
] as const
