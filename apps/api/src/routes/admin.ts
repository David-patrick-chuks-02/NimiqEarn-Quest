import type { FastifyPluginAsync } from "fastify";
import { safeCompare } from "../security.js";
import {
  clampLimit,
  clampOffset,
  createAdminService,
} from "../services/admin.service.js";
import { createQuestService, QuestServiceError } from "../services/quest.service.js";
import type { EscrowService } from "../services/escrow.service.js";
import type { TelegramNotifier } from "../services/telegram-notify.js";
import type { VerifierConfig } from "../services/verification.service.js";
import type { PlatformFees } from "../services/quest.service.js";

interface AdminRouteOptions {
  adminApiKey?: string;
  escrow?: EscrowService;
  fees?: PlatformFees;
  notifier?: TelegramNotifier;
  verifier?: VerifierConfig;
}

type ListQuery = { limit?: string; offset?: string };

function parsePaging(query: ListQuery) {
  return {
    limit: clampLimit(query.limit ? Number(query.limit) : undefined),
    offset: clampOffset(query.offset ? Number(query.offset) : undefined),
  };
}

export const adminRoutes: FastifyPluginAsync<AdminRouteOptions> = async (app, opts) => {
  const admin = createAdminService(app.db);
  const quests = createQuestService(
    app.db,
    opts.escrow,
    opts.fees,
    opts.notifier,
    opts.verifier,
  );
  const adminApiKey = opts.adminApiKey;

  app.addHook("preHandler", async (request, reply) => {
    if (!adminApiKey) {
      return reply
        .code(503)
        .send({ error: "Admin API is not configured. Set ADMIN_API_KEY to enable it." });
    }
    if (!safeCompare(request.headers["x-admin-key"], adminApiKey)) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/users", async (request) => {
    const { limit, offset } = parsePaging(request.query);
    return admin.listUsers(limit, offset);
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/wallets", async (request) => {
    const { limit, offset } = parsePaging(request.query);
    return admin.listWallets(limit, offset);
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/quests", async (request) => {
    const { limit, offset } = parsePaging(request.query);
    return admin.listQuests(limit, offset);
  });

  app.get<{ Querystring: ListQuery & { outcome?: string; queue?: string } }>(
    "/api/admin/submissions",
    async (request) => {
      const { limit, offset } = parsePaging(request.query);
      if (request.query.queue === "PLATFORM") {
        return admin.listPlatformQueue(limit, offset);
      }
      return admin.listSubmissions(limit, offset, request.query.outcome);
    },
  );

  app.get<{ Querystring: ListQuery }>("/api/admin/moderation", async (request) => {
    const { limit, offset } = parsePaging(request.query);
    return admin.listModerationEvents(limit, offset);
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/feedback", async (request) => {
    const { limit, offset } = parsePaging(request.query);
    const [items, total] = await Promise.all([
      app.db.feedback.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        select: {
          id: true,
          displayName: true,
          telegramHandle: true,
          message: true,
          rating: true,
          createdAt: true,
        },
      }),
      app.db.feedback.count(),
    ]);
    return { total, limit, offset, items };
  });

  app.post<{
    Params: { userId: string };
    Body: { status?: string };
  }>("/api/admin/users/:userId/status", async (request, reply) => {
    const status = request.body?.status;
    if (status !== "ACTIVE" && status !== "SUSPENDED" && status !== "PENDING") {
      return reply.code(400).send({ error: "status must be ACTIVE, SUSPENDED, or PENDING" });
    }
    try {
      return await admin.setUserStatus(request.params.userId, status);
    } catch {
      return reply.code(404).send({ error: "User not found" });
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/admin/submissions/:id/accept",
    async (request, reply) => {
      try {
        const result = await quests.platformAcceptSubmission(request.params.id);
        return { ok: true, ...result };
      } catch (error) {
        if (error instanceof QuestServiceError) {
          return reply.code(400).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/admin/submissions/:id/reject",
    async (request, reply) => {
      try {
        await quests.platformRejectSubmission(request.params.id);
        return { ok: true };
      } catch (error) {
        if (error instanceof QuestServiceError) {
          return reply.code(400).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );
};
