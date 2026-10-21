# Earmark

Money with a purpose. Earmark lets a **funder** lock USDC into a pot for one expense. The **recipient** can only pay the **approved payees** the funder authorises — and every payment leaves a public receipt on Arc.

## Use cases

- **Money sent home** — school fees, rent, medical bills, recurring household expenses.
- **Staff allowances and per diems** — travel budgets, field expense accounts, project petty cash.
- **Grants and scholarships** — tuition paid directly to institutions, research budgets with approved suppliers.
- **Supplier and project budgets** — contractor payments tied to a project, milestone-gated disbursements.

## How it works

| Role | Who they are | What they can do |
|---|---|---|
| **Funder** | Creates and funds the pot | Approve payees, top up, extend end date, release or reclaim |
| **Recipient** | The person the pot is for | Pay approved payees, request new payees |
| **Approved payee** | A school, supplier, clinic, landlord | Receive payments from the pot |

1. **Funder creates a pot.** Sets title, category, amount, end date, and at least one approved payee.
2. **Funder approves payees.** Only approved addresses can receive money. Recipient can request additions; funder decides.
3. **Recipient pays.** Picks a payee, enters amount and optional memo. Payment goes on-chain with a public receipt.

After the end date the funder can take back unspent money. At any time the funder can release the remaining balance to the recipient.

## Contract

- **Network:** Arc Testnet (chain ID 5042002) / Arc Mainnet (chain ID 5042)
- **USDC:** `0x3600000000000000000000000000000000000000`
- **Earmark contract:** see `VITE_EARMARK_ADDRESS` in `.env`
- **Tests:** 61 Foundry tests (run `cd contracts && forge test`)
- **Status:** Experimental. Not professionally audited. Use small amounts.

## Quick start

```bash
bun install
bun run dev       # Vite dev server on :5173
```

Set `VITE_EARMARK_ADDRESS` in `.env` to the deployed contract address.
Set `VITE_EARMARK_FROM_BLOCK` to the deploy block (reduces log scan range).

```bash
bun run build     # Production build → dist/
cd contracts && forge test   # 61 tests
```

## URL scheme (hash routing)

| Hash | Page |
|---|---|
| `#/` | Home |
| `#/send` | Create a pot |
| `#/sent` | Pots I fund |
| `#/received` | Pots for me |
| `#/pot/:id` | Pot detail (public, no wallet required) |
| `#/receipt/:potId/:index` | Payment receipt (public) |
| `#/how` | How it works |

## Roadmap

These features are **planned, not built**:

- **Sign in with Google (embedded wallets)** — recipients and payees can use a familiar login flow instead of needing a crypto wallet.
- **Gas sponsorship** — new users can receive payments and make actions with zero USDC, removing the gas barrier on Arc.
- **Shareable recipient ID** — a human-readable link (QR or short URL) a recipient can send to funders instead of a raw wallet address.
- **Local-currency cash-out partners** — integration with remittance providers so recipients can convert USDC payouts to local currency at the last mile.
