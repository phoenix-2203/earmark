# Earmark payee-wallet API

A small Node.js HTTP server that returns the permanent Privy embedded wallet address for an email, creating it on first use. This lets a funder pay an email recipient before that person has signed up to Earmark.

Listens on `127.0.0.1:PORT` only — intended to sit behind Caddy (which handles TLS and same-origin routing at `/api/*`).

Zero npm dependencies — uses `node:http`, `node:crypto`, and global `fetch` (Node 18+).

---

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Returns `{"ok":true}` — use for uptime checks |
| POST | `/api/payee-wallet` | Look up or create a wallet for an email |

### POST /api/payee-wallet

**Request headers**
- `Authorization: Bearer <Privy access token>` — the caller's Privy JWT
- `Content-Type: application/json`

**Request body** (max 2 KB)
```json
{ "email": "supplier@example.com" }
```

**Response 200**
```json
{
  "email":     "supplier@example.com",
  "address":   "0xabc…",
  "created":   false,
  "emailKind": "business"
}
```
`emailKind` is `"personal"` for well-known consumer domains (Gmail, iCloud, etc.) and `"business"` otherwise.

**Error responses**

| Status | Meaning |
|--------|---------|
| 400 | Invalid JSON, body too large, or invalid email |
| 401 | Missing or invalid Privy JWT |
| 404 | Unknown path |
| 405 | Wrong HTTP method |
| 429 | Rate limited (see below) |
| 502 | Privy upstream error |

---

## Rate limits

Limits are per authenticated user (`sub` claim of the Privy JWT), held in memory:

- **60 requests per hour** — applies to every call (lookups and creates).
- **20 wallet creates per day** — checked only when a new wallet would be created. Looking up an existing wallet is still allowed after this limit.

Old entries are cleaned up hourly.

---

## Environment variables

**Never commit secrets to git.** On the production server, put these in `/etc/earmark-api.env` (readable only by root and the service user).

| Variable | Required | Description |
|----------|----------|-------------|
| `PRIVY_APP_ID` | **Yes** | Your Privy application ID |
| `PRIVY_APP_SECRET` | **Yes** | Your Privy application secret |
| `PRIVY_VERIFICATION_KEY` | No | Extra ES256 public key PEM (used as a fallback key with kid `"env"`). No longer required: keys are fetched automatically from Privy's JWKS endpoint at startup and refreshed hourly. Literal `\n` in the value is accepted. |
| `PORT` | No | Listen port (default `8787`) |
| `PRIVY_API_BASE` | No | Override Privy auth API base URL (default `https://auth.privy.io`). Intended for tests. |
| `PRIVY_API_V1_BASE` | No | Override Privy wallet API base URL (default `https://api.privy.io`). Intended for tests. |

### JWT verification — JWKS

At startup the server fetches Privy's published signing keys from:

```
https://auth.privy.io/api/v1/apps/<PRIVY_APP_ID>/jwks.json
```

This is a public, unauthenticated endpoint. All EC / P-256 (ES256) keys are imported and stored in memory by `kid`. The key set is refreshed every hour in the background. If a token arrives with an unknown `kid`, the server triggers one additional refresh (at most once every 5 minutes) before returning 401.

Tokens with no `kid` are verified against every known key (brute-force). `PRIVY_VERIFICATION_KEY`, if set, is added as an extra key (`kid "env"`) alongside the JWKS keys — useful as a fallback if JWKS cannot be reached or for local testing.

If the initial JWKS fetch fails at startup (network unavailable, etc.), the server logs a warning and continues. Authentication will fall back to `PRIVY_VERIFICATION_KEY` if set, or fail with 401 until the next successful refresh.

### Getting a verification key (optional)

If you want the `PRIVY_VERIFICATION_KEY` fallback: in the Privy dashboard → **Settings → API keys**, copy the public key and paste it as the value. If your deployment tool collapses newlines, use literal `\n` — the server converts them automatically.

---

## Running

### Direct

```bash
node /home/doorstep/earmark/server/earmark-api.mjs
```

The server exits immediately with an error if `PRIVY_APP_ID` or `PRIVY_APP_SECRET` are missing.

### systemd

```bash
# Install the unit
sudo cp server/earmark-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now earmark-api

# Logs
sudo journalctl -u earmark-api -f
```

The `EnvironmentFile` directive expects secrets in `/etc/earmark-api.env`:

```
PRIVY_APP_ID=your-app-id
PRIVY_APP_SECRET=your-app-secret
# PRIVY_VERIFICATION_KEY is now optional — JWKS keys are loaded automatically.
# You may keep it as a fallback:
# PRIVY_VERIFICATION_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
```

### Caddy (reverse proxy)

Add to your `Caddyfile` to route `/api/*` from the public domain to the local server:

```
reverse_proxy /api/* 127.0.0.1:8787
```

---

## Security notes

- The server **never** includes Privy response bodies, status codes, or secrets in its own responses or logs.
- Key material is never logged or returned in any response.
- Only `127.0.0.1` is bound — the port is not reachable from outside the machine without going through Caddy.
- JWT verification rejects any algorithm other than `ES256` (including `"none"`).
- Each confirmation code is single-use; codes are deleted from storage on first successful verification.
