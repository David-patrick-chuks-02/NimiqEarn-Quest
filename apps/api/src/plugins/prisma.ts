import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@nimiqearn/database";

declare module "fastify" {
  interface FastifyInstance {
    db: typeof prisma;
  }
}

const prismaPlugin: FastifyPluginAsync = async (app) => {
  app.decorate("db", prisma);

  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
};

export default fp(prismaPlugin, { name: "prisma" });
