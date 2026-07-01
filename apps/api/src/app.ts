import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./config.js";
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

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  await app.register(cors, { origin: true });

  // Optional shared-secret gate for bot → API traffic. Enforced only when configured,
  // so local dev and tests (which don't set it) are unaffected. Health/root stay public.
  if (env.API_SHARED_SECRET) {
    app.addHook("onRequest", async (request, reply) => {
      if (!request.url.startsWith("/api/")) return;
      // The wallet signing page is a public browser flow, guarded by an unguessable token.
      if (request.url.startsWith("/api/wallet/verify/")) return;
      if (request.headers["x-internal-key"] !== env.API_SHARED_SECRET) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    });
  }

  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(statsRoutes);
  await app.register(userRoutes);
  await app.register(walletRoutes);
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
