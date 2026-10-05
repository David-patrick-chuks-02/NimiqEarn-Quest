import type { FastifyPluginAsync } from "fastify";
import {
  buildAdminAuthConfig,
  checkLoginRateLimit,
  clearLoginFailures,
  createAdminSessionToken,
  extractAdminToken,
  isAdminAuthConfigured,
  recordLoginFailure,
  verifyAdminCredentials,
  verifyAdminSessionToken,
  type AdminAuthConfig,
} from "../services/admin-auth.service.js";
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
  adminEmail?: string;
  adminPassword?: string;
  adminApiKey?: string;
  escrow?: EscrowService;
  fees?: PlatformFees;
  notifier?: TelegramNotifier;
  verifier?: VerifierConfig;
}

type ListQuery = { limit?: string; offset?: string; q?: string };

function parsePaging(query: ListQuery) {
  return {
    limit: clampLimit(query.limit ? Number(query.limit) : undefined),
    offset: clampOffset(query.offset ? Number(query.offset) : undefined),
    q: query.q?.trim() || undefined,
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
  const authCfg: AdminAuthConfig | null = buildAdminAuthConfig({
    email: opts.adminEmail,
    password: opts.adminPassword,
    sessionSecret: opts.adminApiKey,
  });

  app.post<{ Body: { email?: string; password?: string } }>(
    "/api/admin/login",
    async (request, reply) => {
      if (!isAdminAuthConfigured(authCfg)) {
        return reply.code(503).send({
          error: "Admin login is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.",
        });
      }

      const ip = request.ip || "unknown";
      const limited = checkLoginRateLimit(ip);
      if (!limited.ok) {
        return reply
          .code(429)
          .header("retry-after", String(limited.retryAfterSec))
          .send({ error: "Too many login attempts. Try again later." });
      }

      const email = request.body?.email;
      const password = request.body?.password;
      if (!verifyAdminCredentials(authCfg, email, password)) {
        recordLoginFailure(ip);
        return reply.code(401).send({ error: "Invalid email or password" });
      }

      clearLoginFailures(ip);
      const session = createAdminSessionToken(authCfg);
      return { ok: true, ...session };
    },
  );

  app.addHook("preHandler", async (request, reply) => {
    if (request.routeOptions.url === "/api/admin/login") return;

    if (!isAdminAuthConfigured(authCfg)) {
      return reply.code(503).send({
        error: "Admin API is not configured. Set ADMIN_EMAIL and ADMIN_PASSWORD.",
      });
    }

    const token = extractAdminToken(request.headers as Record<string, unknown>);
    const session = verifyAdminSessionToken(token, authCfg);
    if (!session) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  app.get("/api/admin/ping", async () => ({ ok: true }));

  app.get("/api/admin/me", async (request) => {
    const token = extractAdminToken(request.headers as Record<string, unknown>);
    const session = authCfg ? verifyAdminSessionToken(token, authCfg) : null;
    return { email: session?.email ?? null };
  });

  app.get("/api/admin/overview", async () => admin.getOverview(5));

  app.get<{ Querystring: ListQuery }>("/api/admin/users", async (request) => {
    const { limit, offset, q } = parsePaging(request.query);
    return admin.listUsers(limit, offset, q);
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/wallets", async (request) => {
    const { limit, offset, q } = parsePaging(request.query);
    return admin.listWallets(limit, offset, q);
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/quests", async (request) => {
    const { limit, offset, q } = parsePaging(request.query);
    return admin.listQuests(limit, offset, q);
  });

  app.get<{ Querystring: ListQuery & { outcome?: string; queue?: string } }>(
    "/api/admin/submissions",
    async (request) => {
      const { limit, offset, q } = parsePaging(request.query);
      if (request.query.queue === "PLATFORM") {
        return admin.listPlatformQueue(limit, offset, q);
      }
      return admin.listSubmissions(limit, offset, request.query.outcome, q);
    },
  );

  app.get<{ Querystring: ListQuery }>("/api/admin/moderation", async (request) => {
    const { limit, offset, q } = parsePaging(request.query);
    return admin.listModerationEvents(limit, offset, q);
  });

  app.get<{ Querystring: ListQuery }>("/api/admin/feedback", async (request) => {
    const { limit, offset, q } = parsePaging(request.query);
    return admin.listFeedback(limit, offset, q);
  });

  app.get<{ Params: { id: string } }>("/api/admin/quests/:id", async (request, reply) => {
    const quest = await admin.getQuest(request.params.id);
    if (!quest) return reply.code(404).send({ error: "Quest not found" });
    return quest;
  });

  app.get<{ Params: { id: string } }>("/api/admin/users/:id", async (request, reply) => {
    const user = await admin.getUser(request.params.id);
    if (!user) return reply.code(404).send({ error: "User not found" });
    return user;
  });

  app.get<{ Params: { id: string } }>("/api/admin/submissions/:id", async (request, reply) => {
    const submission = await admin.getSubmission(request.params.id);
    if (!submission) return reply.code(404).send({ error: "Submission not found" });
    return submission;
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
