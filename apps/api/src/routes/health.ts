import type { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get("/health", async () => ({
    status: "ok",
    service: "nimiqearn-api",
    timestamp: new Date().toISOString(),
  }));

  app.get("/health/db", async (request, reply) => {
    try {
      await app.db.$queryRaw`SELECT 1`;
      return { status: "ok", database: "connected" };
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ status: "error", database: "disconnected" });
    }
  });
};
