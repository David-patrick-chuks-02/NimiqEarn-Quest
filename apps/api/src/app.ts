import cors from "@fastify/cors";
import Fastify from "fastify";
import { captureException, initSentry } from "@nimiqearn/observability";
import { loadEnv } from "./config.js";
import { safeCompare } from "./security.js";
import prismaPlugin from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { statsRoutes } from "./routes/stats.js";
import { userRoutes } from "./routes/users.js";
import { questRoutes } from "./routes/quests.js";
import { creatorRoutes } from "./routes/creators.js";
import { walletRoutes } from "./routes/wallets.js";
import { adminRoutes } from "./routes/admin.js";
import { studioRoutes } from "./routes/studio.js";
import { settingsRoutes } from "./routes/settings.js";
import { createEscrowService } from "./services/escrow.service.js";
import { createTelegramNotifier } from "./services/telegram-notify.js";
import { checkRateLimit } from "./rate-limit.js";

export async function buildServer() {
  const env = loadEnv();

  // Error monitoring — no-op unless SENTRY_DSN is set (dev, tests, and CI stay clean).
  initSentry({
    dsn: env.SENTRY_DSN,
    environment: env.APP_ENV,
    serverName: "nimiqearn-api",
  });

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  // Fail closed: the shared secret is REQUIRED in production/staging so the API
  // can never boot fully open. Local dev and tests may run without it.
  const isProduction = env.NODE_ENV === "production" || env.APP_ENV !== "development";
  if (isProduction && !env.API_SHARED_SECRET) {
    throw new Error(
      "API_SHARED_SECRET is required in production/staging (set it on both the API and the bot).",
    );
  }

  // Don't leak internal error details to clients; log them and return a generic message.
  app.setErrorHandler((error: unknown, request, reply) => {
    const raw = (error as { statusCode?: number }).statusCode;
    const statusCode = typeof raw === "number" && raw >= 400 && raw < 600 ? raw : 500;
    if (statusCode >= 500) {
      request.log.error({ err: error }, "unhandled request error");
      captureException(error, { url: request.url, method: request.method });
      return reply.code(500).send({ error: "Internal Server Error" });
    }
    return reply.code(statusCode).send({ error: (error as Error).message });
  });

  await app.register(cors, { origin: true });

  // Rate-limit money-moving API paths (fail closed — deny when over limit).
  app.addHook("onRequest", async (request, reply) => {
    const url = request.url.split("?")[0] ?? request.url;
    const money =
      /\/wallet\/(withdraw|export|custodial)$/.test(url) ||
      /\/quests\/[^/]+\/(publish|promote|submit)$/.test(url) ||
      /\/studio\/quests\/[^/]+\/(publish|promote)$/.test(url) ||
      /\/studio\/submissions\/[^/]+\/(accept|reject)$/.test(url) ||
      url === "/api/studio/faucet";
    if (!money || request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
      return;
    }
    const ip = request.ip || "unknown";
    const result = checkRateLimit(`money:${ip}:${url}`, 20, 60_000);
    if (!result.allowed) {
      return reply
        .code(429)
        .header("retry-after", String(result.retryAfterSec))
        .send({ error: "Too many requests. Please try again shortly." });
    }
  });

  // Shared-secret gate for bot → API traffic (sent as x-internal-key). Health/root stay
  // public; the wallet signing page uses an unguessable per-request token instead.
  if (env.API_SHARED_SECRET) {
    const secret = env.API_SHARED_SECRET;
    app.addHook("onRequest", async (request, reply) => {
      if (!request.url.startsWith("/api/")) return;
      // Creator Studio authenticates with verified Telegram Mini App initData instead.
      if (request.url.startsWith("/api/studio/")) return;
      // Public quest reads (discovery list GET /api/quests, share pages GET /api/quests/:id)
      // and initData-authed worker routes — no shared secret needed.
      if (request.url.startsWith("/api/quests")) return;
      if (!safeCompare(request.headers["x-internal-key"], secret)) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });
  }

  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(statsRoutes);
  await app.register(userRoutes);
  await app.register(walletRoutes, {
    nimiqRpcUrl: env.NIMIQ_RPC_URL,
    encryptionKey: env.ESCROW_ENCRYPTION_KEY,
    network: env.NIMIQ_NETWORK,
  });
  const escrow = createEscrowService({
    encryptionKey: env.ESCROW_ENCRYPTION_KEY,
    rpcUrl: env.NIMIQ_RPC_URL,
    network: env.NIMIQ_NETWORK,
  });

  const fees = {
    percent: env.PLATFORM_FEE_PERCENT,
    address: env.PLATFORM_FEE_ADDRESS,
    promotionNim: env.PROMOTION_FEE_NIM,
  };
  const notifier = createTelegramNotifier(env.BOT_TOKEN);

  await app.register(creatorRoutes);
  await app.register(questRoutes, {
    escrow,
    botToken: env.BOT_TOKEN,
    fees,
    notifier,
    apiSharedSecret: env.API_SHARED_SECRET,
    verifier: {
      url: env.VERIFIER_URL,
      sharedSecret: env.VERIFIER_SHARED_SECRET,
    },
  });
  await app.register(studioRoutes, { 
    botToken: env.BOT_TOKEN, 
    escrow, 
    fees, 
    notifier,
    network: env.NIMIQ_NETWORK,
    verifier: {
      url: env.VERIFIER_URL,
      sharedSecret: env.VERIFIER_SHARED_SECRET,
    },
  });
  await app.register(settingsRoutes);
  await app.register(adminRoutes, { adminApiKey: env.ADMIN_API_KEY });

  app.get("/", async () => ({
    name: "NimiqEarn Quest API",
    version: "0.1.0",
    milestone: 1,
  }));

  return { app, env };
}
