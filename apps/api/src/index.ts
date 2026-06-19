import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { loadEnv } from "./config.js";
import prismaPlugin from "./plugins/prisma.js";
import { healthRoutes } from "./routes/health.js";
import { statsRoutes } from "./routes/stats.js";

async function buildServer() {
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

  app.get("/", async () => ({
    name: "NimiqEarn Quest API",
    version: "0.1.0",
    milestone: 1,
  }));

  return { app, env };
}

async function start() {
  const { app, env } = await buildServer();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`API listening on http://localhost:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

start();

export { buildServer };
