/** Shared types that match the Solidity structs */

export const CATEGORY_NAMES = ['School', 'Rent', 'Medical', 'Business', 'Other'] as const
export type CategoryName = (typeof CATEGORY_NAMES)[number]

export const CATEGORY_ICONS: Record<number, string> = {
  0: 'GraduationCap',
  1: 'House',
  2: 'HeartPulse',
  3: 'Briefcase',
  4: 'Layers',
}

/** Category chip colours: badge background / badge text */
export const CATEGORY_COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: '#E6F0FF', text: '#1D4ED8' },   // School
  1: { bg: '#F1ECFF', text: '#5B3FD1' },   // Rent
  2: { bg: '#FDECEC', text: '#B42318' },   // Medical
  3: { bg: '#FFF4E0', text: '#9A5B07' },   // Business
  4: { bg: '#EEF1F4', text: '#3C4B5A' },   // Other
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

/**
 * Map a contract custom error NAME (the exact Solidity error identifier) to a
 * friendly message.  This is the authoritative version — switch on the name,
 * never on a substring of the whole error string.
 */
export function friendlyErrorName(name: string): string {
  switch (name) {
    case 'ZeroAddress':              return 'Address cannot be zero.'
    case 'ZeroAmount':               return 'Amount must be greater than zero.'
    case 'SelfBeneficiary':          return 'You cannot create a pot for yourself.'
    case 'TooManyPendingRequests':   return 'Too many pending payee requests — wait for the sender to resolve some first.'
    case 'InvalidExpiry':            return 'The end date must be in the future.'
    case 'PotClosed':                return 'This pot is already closed.'
    case 'PotExpired':               return 'This pot has ended — no more payments are possible.'
    case 'NotSender':                return 'Only the sender can do this.'
    case 'NotBeneficiary':           return 'Only the family member can do this.'
    case 'NotParticipant':           return 'Only the sender or family member can do this.'
    case 'AlreadyApprovedPayee':     return 'This payee is already on the approved list.'
    case 'PayeeNotApproved':         return 'This payee has not been approved by the sender.'
    case 'SenderCannotBePayee':      return 'The sender cannot be an approved payee of their own pot.'
    case 'BeneficiaryCannotBePayee': return 'The family member cannot be an approved payee.'
    case 'ContractCannotBePayee':    return 'A contract address cannot be a payee.'
    case 'MaxPayeesReached':         return 'A pot can have at most 20 approved payees.'
    case 'TitleTooLong':             return 'Title must be 64 characters or fewer.'
    case 'LabelTooLong':             return 'Label must be 48 characters or fewer.'
    case 'MemoTooLong':              return 'Memo must be 140 characters or fewer.'
    case 'ReasonTooLong':            return 'Reason must be 140 characters or fewer.'
    case 'InsufficientBalance':      return 'Amount exceeds the pot balance.'
    case 'AtLeastOnePayee':          return 'You must add at least one approved payee.'
    case 'RequestAlreadyResolved':   return 'This request has already been resolved.'
    case 'ExpiryNotLater':           return 'The new end date must be later than the current one.'
    case 'PayeeLengthMismatch':      return 'Payee and label arrays must have the same length.'
    default:                         return `Contract error: ${name}.`
  }
}

/**
 * Legacy: extract a friendly message from any thrown error value.
 * Kept for backward compat; prefer friendlyErrorName when you have the name.
 */
export function friendlyError(err: unknown): string {
  const msg = String(err).toLowerCase()
  if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('4001')) {
    return 'You cancelled in your wallet. Nothing was sent.'
  }
  if (msg.includes('insufficient funds')) return 'Insufficient USDC balance for this transaction.'
  if (msg.includes('reverted')) return 'Transaction reverted. Check your inputs and try again.'
  // Try to find a custom error name in the message
  const knownErrors = [
    'ZeroAddress','ZeroAmount','SelfBeneficiary','TooManyPendingRequests','InvalidExpiry',
    'PotClosed','PotExpired','NotSender','NotBeneficiary','NotParticipant',
    'AlreadyApprovedPayee','PayeeNotApproved','SenderCannotBePayee',
    'BeneficiaryCannotBePayee','ContractCannotBePayee','MaxPayeesReached',
    'TitleTooLong','LabelTooLong','MemoTooLong','ReasonTooLong',
    'InsufficientBalance','AtLeastOnePayee','RequestAlreadyResolved',
    'ExpiryNotLater','PayeeLengthMismatch',
  ]
  for (const name of knownErrors) {
    if (msg.includes(name.toLowerCase())) return friendlyErrorName(name)
  }
  return 'Something went wrong. Please try again.'
}
