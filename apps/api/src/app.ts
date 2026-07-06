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

  // Shared-secret gate for bot → API traffic (sent as x-internal-key). Health/root stay
  // public; the wallet signing page uses an unguessable per-request token instead.
  if (env.API_SHARED_SECRET) {
    const secret = env.API_SHARED_SECRET;
    app.addHook("onRequest", async (request, reply) => {
      if (!request.url.startsWith("/api/")) return;
      if (request.url.startsWith("/api/wallet/verify/")) return;
      if (!safeCompare(request.headers["x-internal-key"], secret)) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });
  }

  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(statsRoutes);
  await app.register(userRoutes);
  await app.register(walletRoutes, { nimiqRpcUrl: env.NIMIQ_RPC_URL, botToken: env.BOT_TOKEN });
  await app.register(creatorRoutes);
  await app.register(questRoutes);
  await app.register(adminRoutes, { adminApiKey: env.ADMIN_API_KEY });

  app.get("/", async () => ({
    name: "NimiqEarn Quest API",
    version: "0.1.0",
    milestone: 1,
  }));

  return { app, env };
}
