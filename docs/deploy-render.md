# Deploying to Render

NimiqEarn Quest deploys to Render as four services + two datastores, all defined in
[`render.yaml`](../render.yaml):

| Service | Render type | Public? |
| --- | --- | --- |
| `nimiqearn-db` | PostgreSQL | no |
| `nimiqearn-redis` | Redis (Key Value) | no |
| `nimiqearn-api` | Web service | yes |
| `nimiqearn-bot` | Background worker (polling) | no |
| `nimiqearn-web` | Web service (Next.js) | yes |

## 1. Create the Blueprint

1. Push to GitHub (already done).
2. Render Dashboard → **New → Blueprint** → select this repo → **Apply**.
   Render reads `render.yaml`, creates all services, provisions Postgres + Redis, wires
   `DATABASE_URL` / `REDIS_URL` automatically, and generates a shared `API_SHARED_SECRET`.

## 2. Fill in the secrets

These are marked `sync: false` in the blueprint — set them per service in **Environment**:

| Service | Key | Value |
| --- | --- | --- |
| `nimiqearn-bot` | `BOT_TOKEN` | from @BotFather |
| `nimiqearn-web` | `NEXT_PUBLIC_BOT_URL` | `https://t.me/YourBot` |
| `nimiqearn-web` | `NEXT_PUBLIC_CONTACT_EMAIL` | optional |
| `nimiqearn-api` | `NIMIQ_RPC_URL` | optional (on-chain check) |
| `nimiqearn-api` | `ADMIN_API_KEY` | optional (admin endpoints) |

Everything else (URLs, the shared secret, DB/Redis connections) is wired by the blueprint.

## 3. Apply the database schema (one time)

Render doesn't run migrations automatically. From your machine, against the Render DB
(copy its **External Connection String** from the `nimiqearn-db` page):

```bash
DATABASE_URL="postgresql://...render.com/nimiqearn" \
  pnpm --filter @nimiqearn/database exec prisma db push
```

Re-run this whenever the Prisma schema changes.

## 4. Verify

1. Open `https://nimiqearn-web.onrender.com` — the landing page loads.
2. Open Telegram → your bot → `/start` → complete onboarding.
3. Link a wallet end-to-end (the web served over HTTPS gives the Nimiq Hub a secure context,
   and the same-origin proxy means the browser never calls the API cross-origin).

## Notes & caveats

- **URLs:** Render assigns `https://<service-name>.onrender.com`. If a name collides globally it
  appends a suffix — update `API_URL`, `WEB_PUBLIC_URL`, and `API_INTERNAL_URL` in `render.yaml`
  (or in the dashboard) to the real URLs.
- **Free tier:** free web services **spin down when idle** (cold starts). Background workers are
  **not free** — the bot uses `plan: starter`. Free Postgres **expires after 90 days**; for
  production use a paid plan or point `DATABASE_URL` at **Supabase** and remove the `nimiqearn-db`
  block.
- **Redis alternative:** you can swap Render Redis for **Upstash** — delete the `nimiqearn-redis`
  service and set each `REDIS_URL` to the Upstash `rediss://` URL.
- **Mainnet vs testnet:** keep `NIMIQ_NETWORK` (API) and `NEXT_PUBLIC_HUB_URL` (web) in sync —
  `mainnet` ↔ `https://hub.nimiq.com`, `testnet` ↔ `https://hub.nimiq-testnet.com`.
- **Bot mode:** the blueprint runs the bot in **polling** mode (no public URL, no ngrok). To use
  webhooks instead, run the bot as a `web` service and set `WEBHOOK_URL` + `WEBHOOK_SECRET`.
- **`API_SHARED_SECRET` is required in production** — the API refuses to boot without it, and the
  bot must send the same value. The blueprint's shared env group handles this for you.
```
