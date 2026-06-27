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

export async function buildServer() {
  const env = loadEnv();

  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL,
    },
  });

  await app.register(cors, { origin: true });
  await app.register(prismaPlugin);
  await app.register(healthRoutes);
  await app.register(statsRoutes);
  await app.register(userRoutes);
  await app.register(walletRoutes);
  await app.register(creatorRoutes);
  await app.register(questRoutes);

  app.get("/", async () => ({
    name: "NimiqEarn Quest API",
    version: "0.1.0",
    milestone: 1,
  }));

  return { app, env };
}
