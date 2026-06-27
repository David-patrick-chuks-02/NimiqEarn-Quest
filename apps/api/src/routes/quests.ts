import type { FastifyPluginAsync } from "fastify";
import { createQuestSchema } from "@nimiqearn/shared";
import {
  createQuestService,
  QuestServiceError,
  toQuestResponse,
} from "../services/quest.service.js";

export const questRoutes: FastifyPluginAsync = async (app) => {
  const quests = createQuestService(app.db);

  app.post<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/quests",
    async (request, reply) => {
      const parsed = createQuestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      try {
        const quest = await quests.createDraftQuest(request.params.telegramId, parsed.data);
        return { quest: toQuestResponse(quest) };
      } catch (error) {
        if (error instanceof QuestServiceError) {
          const status =
            error.code === "USER_NOT_FOUND"
              ? 404
              : error.code === "NOT_CREATOR" || error.code === "SUSPENDED"
                ? 403
                : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { telegramId: string }; Querystring: { status?: string } }>(
    "/api/users/:telegramId/quests",
    async (request, reply) => {
      try {
        const list = await quests.listCreatorQuests(
          request.params.telegramId,
          request.query.status,
        );
        return { quests: list.map(toQuestResponse) };
      } catch (error) {
        if (error instanceof QuestServiceError) {
          const status = error.code === "USER_NOT_FOUND" ? 404 : 403;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );
};
