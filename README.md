<p><img src="public/earmark-logo.svg" alt="Earmark" height="44"></p>

**Money with a purpose.** Give someone money that can only be spent on what it was meant for.

**Live app:** https://arcearmark.duckdns.org · **Network:** Arc mainnet · **Built with [Arc Studio](https://studio.arc.io)**

## At a glance

| | |
|---|---|
| **What it is** | Purpose-bound USDC pots: the funder decides who can be paid, the recipient decides when and how much, the contract enforces it |
| **Network** | Arc mainnet (chain 5042), USDC as money and as gas |
| **Contract** | `Earmark.sol`: no owner, no admin key, no upgrades, no fees ([`0x0dD4…Ea5B`](https://explorer.arc.io/address/0x0dD4101D457679AE8C942f56f91F7B1eEC1aEa5B)) |
| **Sign-in** | Google or email (a wallet is created for you), or your own wallet |
| **Pay by email** | Type an email: Earmark finds or creates that person's wallet, even before they join |
| **Real payees** | Verified by the payee's own website, or confirmed by the payee signing a link you sent them |
| **Receipts** | A public page and a downloadable image with a QR code for every payment |
| **Tests** | 61 contract tests (Foundry) and 145 app tests |
| **Review** | Internal only, not a professional audit. Use small amounts |

![How Earmark works](how-earmark-works.svg)

---

## Earmark in 30 seconds

Your company hires a contractor to fit out a new office and gives them a **5,000 USDC materials budget**. With a normal transfer, the money is theirs: it can be spent on anything, and you only find out later where it went.

With Earmark, you put the 5,000 USDC into a **pot** labelled "Office fit-out · Phase 1" and approve **Halden Building Supplies** and **Brightline Electrical** as the only places it can go. The contractor still decides **when** to pay and **how much**, but the smart contract will **only** send money to those two. If anyone tries to pay the contractor's own wallet or anyone else, the payment is blocked.

Every payment comes with a **public receipt** (amount, memo such as "PO-1042 · materials", who was paid) that anyone can check from a link or a QR code. If money is left over after the end date, **it comes back to you**.

> Think of it as a company card that only works with the suppliers you approved, with every transaction visible to both sides.

The same pattern works for a grant that must reach a university, an NGO's relief budget, an employee's travel allowance, or money sent home for rent and school fees.

---

## Who it's for

| Situation | Funder (puts the money in) | Recipient (spends it) | Approved payees (can be paid) |
|---|---|---|---|
| **Project budgets** | A company or client | A contractor or project lead | The suppliers the job needs: building supplies, electrical, hosting |
| **Staff allowances** | A company | An employee travelling for work | Approved hotels, airlines, transport companies |
| **Grants and scholarships** | A foundation or sponsor | A researcher or student | The university, the lab supplier |
| **Aid and relief** | An NGO | A household receiving support | A pharmacy, a clinic, a food supplier |
| **Event budgets** | A company or organiser | The event planner | The caterer, the venue, the AV company |
| **Household bills** | Whoever covers the bills | Whoever handles them | Electricity company, internet provider, water board |
| **Money sent home** | Someone working abroad | A relative | The landlord, the school, the hospital |

In every case, the person spending the money can't send it to themselves or anyone the funder hasn't approved.

---

## How it's different

| | Normal transfer | Escrow | **Earmark** |
|---|---|---|---|
| Who controls the money after sending | The recipient, fully | Nobody, until a condition is met | The **recipient spends it**, but **only to approved payees** |
| Can it be spent on something else? | Yes | Not applicable | **No: blocked by the contract** |
| Proof of where it went | No | Partly | **A public receipt for every payment** |
| Unspent money | Stays with the recipient | Returned or released | **Back to the funder after the end date** |

---

## How it works, step by step

1. **Create a pot.** The funder sets a purpose ("Office fit-out · Phase 1"), an amount in USDC, an end date, and at least one approved payee (a wallet address plus a name such as "Halden Building Supplies").
2. **Approve who can be paid.** Only those addresses can receive money from the pot. The recipient can **ask** for a new payee (for example a new supplier); the funder approves or rejects it.
3. **The recipient pays** (the funder can pay too). They pick an approved payee, an amount and a memo ("PO-1042 · materials"). The contract checks the rules and sends the USDC straight to the payee.
4. **Anyone can verify.** Each payment has a public receipt page with a QR code, plus a downloadable receipt image, linked to the transaction on the Arc explorer.
5. **Leftovers.** After the end date the funder can take back what's unspent. At any time, the funder can choose to release the rest to the recipient with no restrictions.

### Sign in with Google, pay by email

You don't need a crypto wallet to use Earmark.

- **Sign in with Google or your email.** Earmark creates a wallet for you (an embedded wallet run by [Privy](https://privy.io)). It's permanent and tied to your email. You can send USDC out to any wallet or exchange, or export the key.
- **Pay someone by email.** Type `accounts@haldensupplies.com` in any payee or recipient field. Earmark finds that email's wallet, or creates it on the spot. When they later sign in with that email (Google or a one-time code), the money is already there. Only whoever controls that inbox can ever use it.
- **Bring your own wallet.** MetaMask and other wallets still work. A "Paying with" switch shows which wallet signs.
- **Fees:** on Arc, fees are paid in USDC. Payees never need fees to receive. When the recipient is new, the funder can send 0.05 USDC for their fees in the same flow.

### Is this payee real?

A wallet address and a name prove nothing on their own, so Earmark gives you three ways to check before you approve a payee:

| Check | How it works | Badge |
|---|---|---|
| **Website** | The business adds one line to its domain settings: `earmark=0xTheirWallet`. Earmark reads it and shows "Verified by theirdomain.com". Free addresses (`*.duckdns.org`, `*.github.io`, …) never count | Green, or amber for free addresses |
| **Payee confirms** | You tap "Ask payee to confirm" and send the link using contact details you found yourself. The payee signs a free message in their wallet and sends the link back. Only confirmations your own browser asked for are accepted | Green: "Confirmed by the wallet owner" |
| **Email** | The wallet belongs to an email address. A company email (`name@theircompany.com`) is strong; a personal one (Gmail etc.) gets a warning, because anyone can create those | Green for company email, amber for personal |

Payees without any of these show "Not verified", and you can still pay them. Banks give the same advice: confirm new payment details through a channel you already trust.

### Roles

| Role | Can | Can't |
|---|---|---|
| **Funder** | Create and fund pots, pay approved payees too, add or remove payees, approve or reject payee requests, top up, extend the end date, release the rest, take back unspent money after the end date | Be a payee of their own pot |
| **Recipient** | Pay approved payees, ask for new payees | Pay themselves, pay anyone not approved, withdraw the money |
| **Approved payee** | Receive payments; optionally confirm their wallet or verify it with their website | Nothing else; no account needed, just a wallet address or an email |

### What the contract guarantees, and what it doesn't

**Guaranteed by the contract on Arc:**
- Money only goes to approved payees, and no payments can be made after the end date.
- The funder and the recipient can never be payees of their own pot.
- No owner, no admin key, no upgrades, no platform fees.
- Unspent money returns to the funder after the end date.

**Not guaranteed:**
- The contract itself can't know **who owns** an address. The app's checks (website, payee confirmation, email) are evidence, not proof: you still have to be sure the website, contact or email is really the payee's.
- Payments can't be reversed.
- Only USDC on Arc is supported.

> ⚠️ Experimental, and not independently audited. Use small amounts.

---

## Live on Arc mainnet

| | |
|---|---|
| App | https://arcearmark.duckdns.org |
| Earmark contract | [`0x0dD4101D457679AE8C942f56f91F7B1eEC1aEa5B`](https://explorer.arc.io/address/0x0dD4101D457679AE8C942f56f91F7B1eEC1aEa5B) |
| Deploy transaction | [`0xb3e1b81e…2a9e`](https://explorer.arc.io/tx/0xb3e1b81e355e2070a7d9708ea1028652f2663059ad812239e21052459a3f2a9e) (block 27249934) |
| USDC (Arc) | `0x3600000000000000000000000000000000000000` |
| Testnet contract | [`0x7d5b050e1c3fd772cacc1e59d3381b5c30b9d566`](https://explorer.testnet.arc.io/address/0x7d5b050e1c3fd772cacc1e59d3381b5c30b9d566) |

---

## How it's built

```
Browser (React app)  ── reads/writes ──▶  Earmark contract on Arc (holds the pots, enforces the rules)
   │  sign-in, embedded wallets ─────────▶  Privy
   │  "pay by email" lookups ────────────▶  Earmark API (server/earmark-api.mjs) ──▶ Privy
   │  website verification ──────────────▶  public DNS (Cloudflare / Google DNS-over-HTTPS)
```

- **The money never touches a server.** Pots live in the contract; every transfer is signed by the user's own wallet.
- **Earmark API** (`server/`): one endpoint that finds or creates the wallet for an email. Zero dependencies, checks the caller's Privy sign-in (ES256, key rotation supported), and limits use to 60 lookups an hour and 20 new wallets a day per user. It never logs secrets or email addresses.
- **No database.** Payee confirmations are signed messages kept in the funder's own browser; website checks read public DNS.

---

## Built with Arc Studio

Earmark was designed and built in **Arc Studio**: the Solidity contract and its 61 Foundry tests, the security review, the React app (sign-in, pay by email, payee verification, receipts, dark mode), the Earmark API and the app tests were all written and iterated there, then pushed to this repository commit by commit. The mainnet contract is the same `contracts/Earmark.sol`, deployed with Foundry.

---

## For developers

```bash
bun install
bun run dev                     # app on http://localhost:5173
forge test                      # 61 contract tests (run from the repo root)
```

Configure the network with environment variables:

```bash
VITE_NETWORK=mainnet                                              # or testnet
VITE_EARMARK_ADDRESS=0x0dD4101D457679AE8C942f56f91F7B1eEC1aEa5B
VITE_EARMARK_FROM_BLOCK=27249934                                  # deploy block, limits log scans
VITE_PRIVY_APP_ID=your_privy_app_id                               # optional: enables Google/email sign-in and pay by email
```

Without `VITE_PRIVY_APP_ID` the app works with browser wallets only.

The Earmark API runs next to the site (see [`server/README.md`](server/README.md)): `node server/earmark-api.mjs` with `PRIVY_APP_ID` and `PRIVY_APP_SECRET` in its environment, served at `/api/*` on the same domain.

```bash
bun run build                   # production build → dist/
```

### Pages (hash routing)

| URL | Page |
|---|---|
| `#/` | Home |
| `#/send` | Create a pot |
| `#/sent` | Pots I fund |
| `#/received` | Pots for me |
| `#/pot/:id` | Pot page (public, no wallet needed) |
| `#/receipt/:potId/:index` | Payment receipt (public, downloadable image with QR code) |
| `#/how` | How it works |
| `#/about` | About |
| `#/wallet` | My Earmark wallet (balance, send out, export key) |
| `#/confirm-payee` | Payee confirms their wallet (from a link) |
| `#/payee-confirmed` | Funder opens the payee's reply |

---

## Not yet proven

- **Independent users.** So far the pots and payments on mainnet come from wallets controlled by the builder.
- **Scale.** The Earmark API runs on one small server with in-memory limits.
- **A professional audit** of the contract.

## Roadmap

Planned, not built yet:

- **Pay by X (Twitter) handle**, for people who signed in with X.
- **Fee sponsorship**, so new users can act with 0 USDC in their wallet.
- **Top-ups straight from an exchange.**
- **Cash-out to local currency** for suppliers, landlords and institutions.

## License

The contract source is MIT-licensed (see the SPDX header in `contracts/Earmark.sol`).
