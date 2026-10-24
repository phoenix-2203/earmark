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
| `PRIVY_APP_ID` | Yes | Your Privy application ID |
| `PRIVY_APP_SECRET` | Yes | Your Privy application secret |
| `PRIVY_VERIFICATION_KEY` | Yes | ES256 public key PEM for verifying Privy JWTs. Literal `\n` in the value is accepted. |
| `PORT` | No | Listen port (default `8787`) |
| `PRIVY_API_BASE` | No | Override Privy auth API base URL (default `https://auth.privy.io`). Intended for tests. |
| `PRIVY_API_V1_BASE` | No | Override Privy wallet API base URL (default `https://api.privy.io`). Intended for tests. |

### Getting the verification key

In the Privy dashboard → **Settings → API keys**, copy the public key and paste it as the value of `PRIVY_VERIFICATION_KEY`. If your deployment tool collapses newlines, use literal `\n` — the server converts them automatically.

---

## Running

### Direct

```bash
node /home/doorstep/earmark/server/earmark-api.mjs
```

The server exits immediately with an error if any required env var is missing.

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
PRIVY_VERIFICATION_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
```

### Caddy (reverse proxy)

Add to your `Caddyfile` to route `/api/*` from the public domain to the local server:

```
reverse_proxy /api/* 127.0.0.1:8787
```

---

## Security notes

- The server **never** includes Privy response bodies, status codes, or secrets in its own responses or logs.
- Only `127.0.0.1` is bound — the port is not reachable from outside the machine without going through Caddy.
- JWT verification rejects any algorithm other than `ES256` (including `"none"`).
- Each confirmation code is single-use; codes are deleted from storage on first successful verification.
