import type { FastifyPluginAsync } from "fastify";
import { createUserSchema } from "@nimiqearn/shared";
import { createUserService, toUserResponse } from "../services/user.service.js";

export const userRoutes: FastifyPluginAsync = async (app) => {
  const users = createUserService(app.db);

  app.post("/api/users/upsert", async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }

    const user = await users.upsertUser(parsed.data);
    return { user: toUserResponse(user) };
  });

  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId",
    async (request, reply) => {
      const user = await users.findByTelegramId(request.params.telegramId);
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      return { user: toUserResponse(user) };
    },
  );

  // Bot records the live Creator Hub message id so Studio can edit it in place (e.g. after faucet).
  app.put<{ Params: { telegramId: string }; Body: { messageId?: unknown } }>(
    "/api/users/:telegramId/hub-message",
    async (request, reply) => {
      const messageId = request.body?.messageId;
      if (!Number.isInteger(messageId) || (messageId as number) <= 0) {
        return reply.code(400).send({ error: "messageId must be a positive integer." });
      }
      const user = await users.findByTelegramId(request.params.telegramId);
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }
      await app.db.user.update({
        where: { id: user.id },
        data: { telegramHubMessageId: messageId as number },
      });
      return { ok: true };
    },
  );
};
