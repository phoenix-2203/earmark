# Earmark

> Built with Arc Studio — money-powered apps in minutes

**Earmark** is a purpose-locked USDC remittance app. A sender funds a "pot" (money set aside for one purpose) for a family member; the family member can only pay to sender-approved payees (schools, landlords, clinics). Every payment is recorded on-chain with a public receipt.

**The contract only lets a pot pay addresses the sender approved. Earmark can't verify who owns an address — get the school's or landlord's wallet directly from them before adding it as a payee.**

---

## What Earmark does and doesn't do

**Does:**
- Only lets the pot pay addresses you approved
- Records every payment on Arc with a memo and a public receipt
- Returns unspent money to you after the end date

**Doesn't:**
- Verify who owns an address (the sender must confirm this)
- Reverse a confirmed payment
- Work with tokens other than USDC

---

## Tech stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS v3, IBM Plex Sans/Mono
- Web3: wagmi v2, viem, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry
- Wallet: injected (MetaMask, Rabby, etc.)
- Default chain: Arc Testnet (Chain ID 5042002)
- Mainnet chain: Arc Mainnet (Chain ID 5042)
- Token: USDC (6 decimals), address `0x3600000000000000000000000000000000000000` (same on both networks)

---

## Key files

| File | Description |
|---|---|
| `src/App.tsx` | SPA hash router and app shell |
| `src/earmarkConfig.ts` | Network/contract config (driven by `VITE_NETWORK`) |
| `src/earmarkTypes.ts` | Shared types and friendly error messages (switch on error name) |
| `src/hooks/useEarmark.ts` | wagmi read hooks (30 s refetch interval) |
| `src/hooks/useContractAction.ts` | Shared write hook: idle → checking → awaitingSignature → submitted → confirmed/failed |
| `src/hooks/useEventTxHash.ts` | Chunked event log scan for Paid and PotCreated tx hashes |
| `src/pages/HomePage.tsx` | Landing page |
| `src/pages/CreatePotPage.tsx` | Create pot (with allowance check, 2-step indicator, local-tz expiry) |
| `src/pages/MyPotsPage.tsx` | Compact list of pots I sent |
| `src/pages/ForMePage.tsx` | Compact list of pots for me |
| `src/pages/PotPage.tsx` | Role-aware pot detail page (public + sender + beneficiary panels) |
| `src/pages/ReceiptPage.tsx` | Public payment receipt |
| `src/pages/HowItWorksPage.tsx` | Glossary, 3-step walkthrough, FAQs |
| `src/components/ui/` | Design system components: Button, Field, Card, StatusBadge, AddressChip, AddressInput, AmountInput, Dialog, Stepper, EmptyState, TxStatus |
| `src/utils/format.ts` | USDC formatting, address checksum, date/tz helpers |
| `contracts/Earmark.sol` | Smart contract |
| `contracts/test/Earmark.t.sol` | 61 Foundry tests (all passing) |

---

## Routes (hash-based)

| Hash | Page |
|---|---|
| `#/` | Home |
| `#/send` | Create a pot |
| `#/sent` | Pots I sent |
| `#/received` | Pots for me |
| `#/pot/:id` | Pot detail (public, no wallet needed) |
| `#/receipt/:potId/:index` | Payment receipt (public, no wallet needed) |
| `#/how` | How it works |

Old path-style URLs (`/pot/:id`, `/receipt/:a/:b`) still resolve (the server falls back to `index.html`).

---

## Contract deployments

| Network | Address | Explorer |
|---|---|---|
| Arc Testnet | `0x7d5b050e1c3fd772cacc1e59d3381b5c30b9d566` | https://explorer.testnet.arc.io/address/0x7d5b050e1c3fd772cacc1e59d3381b5c30b9d566 |
| Arc Mainnet | (not yet deployed) | https://explorer.arc.io |

---

## Environment variables

```
VITE_NETWORK=testnet                      # or mainnet
VITE_EARMARK_ADDRESS=0x...               # deployed contract address
VITE_EARMARK_FROM_BLOCK=0                # deployment block for event log scans
```

---

## Running locally

```bash
bun install
bun run dev
```

## Building

```bash
bun run build              # vite production build → dist/
bun run contracts:build    # forge build
bun run contracts:test     # forge test (61 tests, all pass)
bun run check              # lint + typecheck
```

---

## Disclaimer

Experimental — not professionally audited. Use small amounts.
