# Earmark

> Built with Arc Studio — money-powered apps in minutes

**Earmark** is a purpose-locked USDC remittance app. A sender funds a "pot" for a family member; the beneficiary can only pay to sender-approved payees. Every payment is recorded on-chain with a memo.

---

## What This App Does

Send money home for a specific purpose. The contract enforces that:
- The beneficiary can only pay from the pot to addresses the sender has approved.
- Neither the sender nor the beneficiary can be a payee (no self-payment).
- Every payment has a memo and is stored on-chain as a verifiable receipt.
- Unused funds can be reclaimed by the sender after expiry, or released to the beneficiary at any time.

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS v3
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Source: `contracts/Earmark.sol`. Tests: `contracts/test/Earmark.t.sol`.
- Wallet: injected (MetaMask, Rabby, etc.)
- Default chain: Arc Testnet (Chain ID: 5042002)
- Mainnet chain: Arc Mainnet (Chain ID: 5042)
- Token: USDC (6 decimals), address `0x3600000000000000000000000000000000000000` (same on both networks)

## Key Files

- `src/App.tsx` — SPA router and shell
- `src/earmarkConfig.ts` — network/contract configuration (driven by `VITE_NETWORK`)
- `src/earmarkTypes.ts` — shared types and friendly error messages
- `src/hooks/useEarmark.ts` — wagmi read hooks
- `src/pages/HomePage.tsx` — landing page
- `src/pages/CreatePotPage.tsx` — sender: create a pot
- `src/pages/MyPotsPage.tsx` — sender: manage pots, approve/reject payee requests
- `src/pages/ForMePage.tsx` — beneficiary: pay and request new payees
- `src/pages/ReceiptPage.tsx` — public verifiable payment receipt (/receipt/:potId/:paymentIndex)
- `src/utils/format.ts` — USDC formatting helpers
- `contracts/Earmark.sol` — the smart contract
- `contracts/test/Earmark.t.sol` — 52 Foundry unit tests (all passing)
- `contracts/script/DeployEarmark.s.sol` — deploy scripts for testnet and mainnet

## Contract Deployments

| Network | Address | Explorer |
|---------|---------|---------|
| Arc Testnet | 0x14ed9bb0b0a569aa895dfe5776310f9e73f014cc | https://explorer.testnet.arc.io/address/0x14ed9bb0b0a569aa895dfe5776310f9e73f014cc |
| Arc Mainnet | (not yet deployed) | https://explorer.arc.io |

## Environment Variables

```
VITE_NETWORK=testnet          # or mainnet
VITE_EARMARK_ADDRESS=0x...    # deployed contract address for the selected network
```

## To Run

```bash
bun install
bun run dev
```

## To Build

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test (52 tests, all pass)
```
