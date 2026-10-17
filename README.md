# Earmark

> Send money home for a reason. It can only be spent on that reason.

Earmark is a purpose-locked USDC remittance app built on Arc. A sender abroad funds a "pot" for a family member (the beneficiary) with a specific purpose like "School fees — Term 1". The beneficiary can only pay from the pot to wallet addresses the sender has approved (e.g. the school, the landlord, the clinic). Every payment is stored on-chain with a memo, so anyone can verify exactly where the money went.

**Problem it solves:** money sent home for school fees, rent or medical bills is often diverted or requested by scammers. Earmark enforces the purpose at the smart contract level, not with trust.

---

## Features

- **Purpose-locked pots** — each pot has a title, category, beneficiary, end date, and approved payees
- **Sender-controlled payees** — only the sender can approve payees; beneficiary can request new ones
- **Core guarantee** — neither the sender nor the beneficiary can be a payee (no self-payment ever)
- **On-chain receipts** — every payment stores the payee, amount, memo, timestamp, and payer; shareable at `/receipt/:potId/:paymentIndex`
- **Full lifecycle** — top up, extend expiry, release early to beneficiary, or reclaim after expiry
- **Testnet + mainnet** — Arc Testnet for testing, Arc Mainnet for production

---

## Prerequisites

- [Bun](https://bun.sh) — package manager and runtime
- [Foundry](https://book.getfoundry.sh/getting-started/installation) — `forge`, `cast`
- MetaMask, Rabby, or any injected EVM wallet

---

## Run locally

```bash
bun install
bun run dev
```

Open http://localhost:5173. The app targets Arc Testnet by default.

---

## Run tests

```bash
# Build the contract
bun run contracts:build   # or: cd contracts && forge build

# Run all 52 unit tests
bun run contracts:test    # or: forge test --match-path "contracts/test/*"
```

All 52 tests pass. Coverage includes: createPot, pay, reclaim, releaseToBeneficiary, topUp, extendExpiry, addPayee, removePayee, requestPayee, approvePayeeRequest, rejectPayeeRequest, balance invariants, and fuzz tests.

---

## Deploy to Arc Testnet

```bash
# Set your deployer private key (never commit this)
export DEPLOYER_PRIVATE_KEY=0x...

forge script contracts/script/DeployEarmark.s.sol:DeployEarmarkTestnet \
  --rpc-url https://rpc.testnet.arc.io \
  --broadcast \
  --legacy
```

The script prints the deployed contract address. Then set it in your `.env`:

```
VITE_NETWORK=testnet
VITE_EARMARK_ADDRESS=0x<deployed-address>
```

Restart the dev server (`bun run dev`) — Vite only reads `.env` at startup.

---

## Deploy to Arc Mainnet

> **Warning: Transactions on mainnet involve real funds and are irreversible.** Test thoroughly on testnet first. You are solely responsible for any losses.

```bash
export DEPLOYER_PRIVATE_KEY=0x...

forge script contracts/script/DeployEarmark.s.sol:DeployEarmarkMainnet \
  --rpc-url https://rpc.mainnet.arc.io \
  --broadcast \
  --legacy
```

Then update `.env`:

```
VITE_NETWORK=mainnet
VITE_EARMARK_ADDRESS=0x<deployed-address>
```

---

## Switch the frontend between networks

The entire network selection lives in `VITE_NETWORK`:

| `.env` setting | Chain | Chain ID | RPC |
|---|---|---|---|
| `VITE_NETWORK=testnet` (default) | Arc Testnet | 5042002 | https://rpc.testnet.arc.io |
| `VITE_NETWORK=mainnet` | Arc Mainnet | 5042 | https://rpc.mainnet.arc.io |

The USDC address (`0x3600000000000000000000000000000000000000`) is identical on both networks.

After changing `.env`, restart the dev server. For a production build:

```bash
VITE_NETWORK=mainnet VITE_EARMARK_ADDRESS=0x... bun run build
```

---

## Networks

| | Arc Testnet | Arc Mainnet |
|---|---|---|
| Chain ID | 5042002 | 5042 |
| RPC | https://rpc.testnet.arc.io | https://rpc.mainnet.arc.io |
| Explorer | https://explorer.testnet.arc.io | https://explorer.arc.io |
| USDC | `0x3600000000000000000000000000000000000000` | `0x3600000000000000000000000000000000000000` |

---

## Security notes

- No owner, no admin, no fees, no upgrade proxy. The contract is immutable.
- Uses OpenZeppelin ReentrancyGuard and SafeERC20 (OZ 5.1.0).
- Checks-effects-interactions pattern throughout.
- Passed a balanced security review (0 findings) before deployment.
- **Experimental. Not professionally audited. Use small amounts.**

---

## Receipt links

Every payment gets a public receipt at:

```
https://your-app.example.com/receipt/:potId/:paymentIndex
```

No wallet needed. Shows purpose, payee, amount, memo, date, and links to the transaction on the explorer. Share with a school or landlord to prove payment.

---

## Architecture

```
contracts/
  Earmark.sol              — single contract holding many pots
  test/Earmark.t.sol       — 52 Foundry unit tests
  script/DeployEarmark.s.sol — testnet + mainnet deploy scripts

src/
  earmarkConfig.ts         — network config (VITE_NETWORK)
  earmarkTypes.ts          — Solidity-matched types, friendly errors
  hooks/useEarmark.ts      — wagmi read hooks
  utils/format.ts          — USDC/date formatters
  pages/
    HomePage.tsx           — landing / how it works
    CreatePotPage.tsx       — create a pot (sender)
    MyPotsPage.tsx         — manage pots (sender)
    ForMePage.tsx          — pay and request payees (beneficiary)
    ReceiptPage.tsx        — public verifiable receipt
  components/
    NetworkGuard.tsx       — wrong-chain banner + switch button
    UsdcBalance.tsx        — live USDC balance in header
    CategoryBadge.tsx      — category label with icon
    PotProgress.tsx        — spent/remaining progress bar
    PaymentReceipt.tsx     — single payment card with receipt link
    TxButton.tsx           — standard CTA with wallet/confirming states
```
