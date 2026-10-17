/** Shared types that match the Solidity structs */

export const CATEGORY_NAMES = ['School', 'Rent', 'Medical', 'Business', 'Other'] as const
export type CategoryName = (typeof CATEGORY_NAMES)[number]

export const CATEGORY_ICONS: Record<number, string> = {
  0: 'GraduationCap',
  1: 'Home',
  2: 'HeartPulse',
  3: 'Briefcase',
  4: 'Layers',
}

export interface Pot {
  id: bigint
  sender: `0x${string}`
  beneficiary: `0x${string}`
  title: string
  category: number
  balance: bigint
  totalFunded: bigint
  totalSpent: bigint
  expiry: bigint
  closed: boolean
}

export interface Payment {
  payee: `0x${string}`
  amount: bigint
  memo: string
  timestamp: bigint
  payer: `0x${string}`
}

export interface PayeeRequest {
  payee: `0x${string}`
  label: string
  reason: string
  resolved: boolean
  approved: boolean
}

export interface PayeeEntry {
  address: `0x${string}`
  label: string
}

/** Friendly error messages for each custom error */
export function friendlyError(err: unknown): string {
  const msg = String(err).toLowerCase()

  if (msg.includes('zeroadd')) return 'Address cannot be zero.'
  if (msg.includes('invalidexpiry')) return 'The end date must be in the future.'
  if (msg.includes('potclosed')) return 'This pot is already closed.'
  if (msg.includes('potexpired')) return 'This pot has expired — no more payments are possible.'
  if (msg.includes('notsender')) return 'Only the sender can do this.'
  if (msg.includes('notbeneficiary')) return 'Only the beneficiary can do this.'
  if (msg.includes('notparticipant')) return 'Only the sender or beneficiary can do this.'
  if (msg.includes('alreadyapprovedpayee')) return 'This payee is already on the approved list.'
  if (msg.includes('payeenotapproved')) return 'This payee has not been approved by the sender.'
  if (msg.includes('sendercannotbepayee')) return 'The sender cannot be a payee of their own pot.'
  if (msg.includes('beneficiarycannotbepayee')) return 'The beneficiary cannot be a payee of their own pot.'
  if (msg.includes('contractcannotbepayee')) return 'A contract address cannot be a payee.'
  if (msg.includes('maxpayeesreached')) return 'A pot can have at most 20 approved payees.'
  if (msg.includes('titletoolong')) return 'Title must be 64 characters or fewer.'
  if (msg.includes('labeltoolong')) return 'Label must be 48 characters or fewer.'
  if (msg.includes('memotoolong')) return 'Memo must be 140 characters or fewer.'
  if (msg.includes('reasontoolong')) return 'Reason must be 140 characters or fewer.'
  if (msg.includes('insufficientbalance')) return 'Amount exceeds the pot balance.'
  if (msg.includes('atleastonepayee')) return 'You must add at least one approved payee.'
  if (msg.includes('requestalreadyresolved')) return 'This request has already been resolved.'
  if (msg.includes('expirynot')) return 'The new end date must be later than the current one.'
  if (msg.includes('payeelength')) return 'Payee and label arrays must have the same length.'
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Transaction cancelled.'
  if (msg.includes('insufficient funds')) return 'Insufficient USDC balance for this transaction.'
  if (msg.includes('reverted')) return 'Transaction failed. Check your inputs and try again.'
  return 'Something went wrong. Please try again.'
}
