import type { FastifyPluginAsync } from "fastify";

export const statsRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/stats", async () => {
    const [users, wallets, quests] = await Promise.all([
      app.db.user.count(),
      app.db.walletProfile.count(),
      app.db.quest.count(),
    ]);

    return { users, wallets, quests };
  });
};
