import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { createQuestSchema, questCategorySchema, updateQuestSchema } from "@nimiqearn/shared";
import {
  createQuestService,
  QuestServiceError,
  toPublicQuestResponse,
  toQuestResponse,
  type PlatformFees,
} from "../services/quest.service.js";
import type { EscrowService } from "../services/escrow.service.js";
import { verifyInitData } from "../telegram-auth.js";

interface QuestRouteOptions {
  escrow?: EscrowService;
  /** Bot token used to verify worker Mini App initData on the do-a-quest routes. */
  botToken?: string;
  fees?: PlatformFees;
}

/** Verify Telegram Mini App initData on a request and return the telegram id, or null. */
function workerTelegramId(request: FastifyRequest, botToken?: string): string | null {
  if (!botToken) return null;
  const header = request.headers["x-telegram-init-data"];
  const initData = typeof header === "string" ? header : null;
  const verified = initData ? verifyInitData(initData, botToken) : null;
  return verified?.telegramId ?? null;
}

export function questErrorStatus(code: QuestServiceError["code"]) {
  switch (code) {
    case "USER_NOT_FOUND":
    case "QUEST_NOT_FOUND":
      return 404;
    case "NOT_CREATOR":
    case "SUSPENDED":
    case "NOT_VERIFIED":
    case "CREATOR_CANNOT_SUBMIT":
      return 403;
    case "INSUFFICIENT_BALANCE":
      return 402;
    case "RPC_UNAVAILABLE":
    case "PAYOUT_FAILED":
      return 503;
    case "QUEST_NOT_PUBLISHED":
    case "QUEST_FULL":
    case "QUEST_EXPIRED":
    case "QUEST_NOT_STARTED":
    case "ALREADY_SUBMITTED":
    case "ALREADY_PROMOTED":
      return 409;
    case "PROMOTION_UNAVAILABLE":
      return 503;
    default:
      return 400;
  }
}

export const questRoutes: FastifyPluginAsync<QuestRouteOptions> = async (app, opts) => {
  const quests = createQuestService(app.db, opts.escrow, opts.fees);

  const sendQuestError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof QuestServiceError) {
      return reply.code(questErrorStatus(error.code)).send({ error: error.message, code: error.code });
    }
    throw error;
  };

  // Public discovery: live, open quests for workers to browse (promoted first, paginated).
  app.get<{ Querystring: { page?: string; pageSize?: string; category?: string } }>(
    "/api/quests",
    async (request) => {
      const page = Number.parseInt(request.query.page ?? "", 10);
      const pageSize = Number.parseInt(request.query.pageSize ?? "", 10);
      const category = questCategorySchema.safeParse(request.query.category).success
        ? request.query.category
        : undefined;
      // Optional: if the Mini App sends valid initData, personalize (hide own + already-done).
      const telegramId = workerTelegramId(request, opts.botToken) ?? undefined;
      return quests.listDiscoverableQuests({
        page: Number.isNaN(page) ? undefined : page,
        pageSize: Number.isNaN(pageSize) ? undefined : pageSize,
        category,
        telegramId,
      });
    },
  );

  // Public, unauthenticated: a single published quest for shareable links (t.me + web).
  // Pass ?count=0 to read without incrementing the view count (OG images / list thumbnails).
  app.get<{ Params: { id: string }; Querystring: { count?: string } }>(
    "/api/quests/:id",
    async (request, reply) => {
      const shouldCount = request.query.count !== "0";
      const quest = await quests.getPublicQuest(request.params.id, shouldCount);
      if (!quest) {
        return reply.code(404).send({ error: "This quest isn't available." });
      }
      return { quest: toPublicQuestResponse(quest) };
    },
  );

  // Worker Mini App: the quest plus this worker's context (own it? already done? can submit?).
  // Authenticated with verified Telegram initData, so it's exempt from the shared-secret gate.
  app.get<{ Params: { id: string } }>("/api/quests/:id/worker", async (request, reply) => {
    const telegramId = workerTelegramId(request, opts.botToken);
    if (!telegramId) {
      return reply.code(401).send({ error: "Invalid or missing Telegram authentication." });
    }
    try {
      const view = await quests.getWorkerQuestView(telegramId, request.params.id);
      if (!view) return reply.code(404).send({ error: "This quest isn't available." });
      return view;
    } catch (error) {
      return sendQuestError(reply, error);
    }
  });

  // Worker Mini App: submit proof for a quest (auto-accepts and fills a slot).
  app.post<{ Params: { id: string }; Body: { proof?: string } }>(
    "/api/quests/:id/submit",
    async (request, reply) => {
      const telegramId = workerTelegramId(request, opts.botToken);
      if (!telegramId) {
        return reply.code(401).send({ error: "Invalid or missing Telegram authentication." });
      }
      const proof = request.body?.proof;
      if (typeof proof !== "string") {
        return reply.code(400).send({ error: "proof is required" });
      }
      try {
        const { txHash } = await quests.submitQuest(telegramId, request.params.id, proof);
        return { ok: true, txHash };
      } catch (error) {
        return sendQuestError(reply, error);
      }
    },
  );

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

  // A worker's submission history + total NIM earned (for the My Earnings view).
  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/submissions",
    async (request, reply) => {
      try {
        return await quests.getWorkerSubmissions(request.params.telegramId);
      } catch (error) {
        return sendQuestError(reply, error);
      }
    },
  );
};
