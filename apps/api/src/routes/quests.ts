import type { FastifyPluginAsync } from "fastify";
import { createQuestSchema, updateQuestSchema } from "@nimiqearn/shared";
import {
  createQuestService,
  QuestServiceError,
  toPublicQuestResponse,
  toQuestResponse,
} from "../services/quest.service.js";
import type { EscrowService } from "../services/escrow.service.js";

interface QuestRouteOptions {
  escrow?: EscrowService;
}

export function questErrorStatus(code: QuestServiceError["code"]) {
  switch (code) {
    case "USER_NOT_FOUND":
    case "QUEST_NOT_FOUND":
      return 404;
    case "NOT_CREATOR":
    case "SUSPENDED":
    case "NOT_VERIFIED":
      return 403;
    case "NOT_FUNDED":
      return 402;
    default:
      return 400;
  }
}

export const questRoutes: FastifyPluginAsync<QuestRouteOptions> = async (app, opts) => {
  const quests = createQuestService(app.db, opts.escrow);

  // Public, unauthenticated: a single published quest for shareable links (t.me + web).
  app.get<{ Params: { id: string } }>("/api/quests/:id", async (request, reply) => {
    const quest = await quests.getPublicQuest(request.params.id);
    if (!quest) {
      return reply.code(404).send({ error: "This quest isn't available." });
    }
    return { quest: toPublicQuestResponse(quest) };
  });

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
          return reply
            .code(questErrorStatus(error.code))
            .send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );

  app.patch<{ Params: { telegramId: string; questId: string } }>(
    "/api/users/:telegramId/quests/:questId",
    async (request, reply) => {
      const parsed = updateQuestSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      try {
        const quest = await quests.updateDraftQuest(
          request.params.telegramId,
          request.params.questId,
          parsed.data,
        );
        return { quest: toQuestResponse(quest) };
      } catch (error) {
        if (error instanceof QuestServiceError) {
          return reply
            .code(questErrorStatus(error.code))
            .send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { telegramId: string; questId: string } }>(
    "/api/users/:telegramId/quests/:questId/publish",
    async (request, reply) => {
      try {
        const quest = await quests.publishQuest(request.params.telegramId, request.params.questId);
        return { quest: toQuestResponse(quest) };
      } catch (error) {
        if (error instanceof QuestServiceError) {
          return reply
            .code(questErrorStatus(error.code))
            .send({ error: error.message, code: error.code });
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
          return reply
            .code(questErrorStatus(error.code))
            .send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );
};
