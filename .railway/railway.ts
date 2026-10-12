// NimiqEarn Quest — Railway Infrastructure as Code.
//
// Apply with the Railway CLI:
//   railway config plan    # preview changes (no side effects)
//   railway config apply   # create/update services, databases, redis
//
// Before applying, make sure:
//   - the Railway GitHub app has access to GITHUB_REPO below
//   - you're linked to the Railway project you want to manage (railway link)
//
// After the first deploy, fill in the `preserve()` secrets per service in the
// Railway dashboard (same values as api.env / bot.env / web.env). `preserve()`
// keeps whatever is already set and never overwrites dashboard values.
//
// `railway/iac` is only available inside the Railway CLI at plan/apply time.
// The ambient declarations in ./railway.d.ts let the editor type-check this file.
/// <reference path="./railway.d.ts" />
import {
  defineRailway,
  github,
  group,
  preserve,
  project,
  redis,
  service,
} from "railway/iac";

// Deploy source: the repo the Railway GitHub app is authorized for.
const GITHUB_REPO = "David-patrick-chuks-02/NimiqEarn-Quest";

export default defineRailway(() => {
  // Postgres is Supabase (kept for existing data). DATABASE_URL is a preserved
  // variable set per-service in the Railway dashboard / CLI — never committed.
  const cache = redis("redis");

  // Python AI verifier — self-contained Dockerfile app (apps/verifier).
  // Listens on Railway's injected PORT; the API reaches it over the private network.
  const verifier = service("verifier", {
    source: github(GITHUB_REPO, { rootDirectory: "apps/verifier" }),
    healthcheck: "/health",
    healthcheckTimeout: 30,
    env: {
      VERIFIER_SHARED_SECRET: preserve(), // must match the API's VERIFIER_SHARED_SECRET
    },
  });

  // Fastify API — web service.
  // NOTE: no rootDirectory — Railpack must build from the repo root so it finds
  // pnpm-workspace.yaml + pnpm-lock.yaml (npm would choke on `workspace:*` deps).
  // `prisma db push` is intentionally NOT in the build: Railway build containers
  // cannot reach the IPv4-only Supabase pooler, and the schema is already pushed.
  // Push schema changes manually (`pnpm db:push`) or via a one-off job instead.
  const api = service("api", {
    source: github(GITHUB_REPO),
    build:
      "pnpm --filter @nimiqearn/database generate && pnpm --filter @nimiqearn/api... build",
    start: "pnpm --filter @nimiqearn/api start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    env: {
      RAILPACK_NODE_VERSION: "22",
      NODE_ENV: "production",
      APP_ENV: "production",
      DATABASE_URL: preserve(), // Supabase URL — set via CLI, not committed
      REDIS_URL: cache.env.REDIS_URL,
      NIMIQ_NETWORK: "mainnet",
      NIMIQ_RPC_URL: "https://rpc.nimiqwatch.com", // mainnet public Albatross node
      BOT_TOKEN: preserve(), // required to verify Mini App initData
      API_SHARED_SECRET: preserve(), // must match the bot's API_SHARED_SECRET
      ESCROW_ENCRYPTION_KEY: preserve(),
      FAUCET_ADMIN_PRIVATE_KEY: preserve(), // unused on mainnet (faucet is testnet-only)
      PLATFORM_FEE_PERCENT: "6",
      PLATFORM_FEE_ADDRESS: preserve(),
      PROMOTION_FEE_NIM: "1000",
      PAYOUT_QUEUE_ENABLED: "1",
      ADMIN_EMAIL: preserve(), // ops console login on /admin
      ADMIN_PASSWORD: preserve(), // 8+ chars; also the HMAC secret for admin session tokens
      VERIFIER_URL: "http://verifier.railway.internal:8080", // private domain + port (Railway injects PORT=8080)
      VERIFIER_SHARED_SECRET: preserve(),
      SENTRY_DSN: preserve(),
    },
  });

  // grammY bot — webhook mode: WEBHOOK_URL is the bot's public domain and the
  // target Telegram delivers to. Re-run setWebhook after that domain changes.
  // Builds from the repo root (no rootDirectory) so pnpm workspaces resolve.
  const bot = service("bot", {
    source: github(GITHUB_REPO),
    build:
      "pnpm --filter @nimiqearn/database generate && pnpm --filter @nimiqearn/bot... build",
    start: "pnpm --filter @nimiqearn/bot start",
    env: {
      RAILPACK_NODE_VERSION: "22",
      NODE_ENV: "production",
      BOT_TOKEN: preserve(),
      REDIS_URL: cache.env.REDIS_URL,
      API_URL: "http://api.railway.internal:8080", // private domain + port (Railway injects PORT=8080)
      API_SHARED_SECRET: preserve(), // must match the API's API_SHARED_SECRET
      WEB_PUBLIC_URL: "https://www.nimiqearn.com", // Vercel web app
      WEBHOOK_URL: "https://bot.nimiqearn.com", // custom domain — Telegram webhook target
      WEBHOOK_SECRET: preserve(), // must match prod-bot.env WEBHOOK_SECRET
      SENTRY_DSN: preserve(),
    },
  });

  // Next.js web app is hosted on Vercel, not Railway. Set the API's public URL
  // as API_INTERNAL_URL on Vercel: https://api.nimiqearn.com (custom domain).
  // Also add the custom domains (api./bot.nimiqearn.com) to their services:
  //   railway domain -s api  /  railway domain -s bot
  // Note: if the Vercel deployment pulls from this repo, remove the `web` service
  // here so Railway doesn't try to deploy it.

  // BullMQ payout worker — same build output as the API, different entrypoint.
  // Builds from the repo root (no rootDirectory) so pnpm workspaces resolve.
  const payoutWorker = service("payout-worker", {
    source: github(GITHUB_REPO),
    build:
      "pnpm --filter @nimiqearn/database generate && pnpm --filter @nimiqearn/api... build",
    start: "pnpm --filter @nimiqearn/api payout-worker",
    env: {
      RAILPACK_NODE_VERSION: "22",
      NODE_ENV: "production",
      APP_ENV: "production",
      PAYOUT_QUEUE_ENABLED: "1",
      DATABASE_URL: preserve(), // Supabase URL — set via CLI, not committed
      REDIS_URL: cache.env.REDIS_URL,
      NIMIQ_NETWORK: "mainnet",
      NIMIQ_RPC_URL: "https://rpc.nimiqwatch.com", // mainnet public Albatross node
      ESCROW_ENCRYPTION_KEY: preserve(),
    },
  });

  const backend = group("Backend", [cache, api, payoutWorker]);
  const telegram = group("Telegram", [bot]);
  const ai = group("AI Verifier", [verifier]);

  return project("nimiqearn-quest", {
    resources: [backend, telegram, ai],
  });
});
