import type { FastifyPluginAsync } from "fastify";
import { safeCompare } from "../security.js";
import {
  clampLimit,
  clampOffset,
  createAdminService,
} from "../services/admin.service.js";

interface AdminRouteOptions {
  adminApiKey?: string;
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
  const adminApiKey = opts.adminApiKey;

  // Admin endpoints are read-only but expose platform-wide data, so they require a key.
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

  app.get<{ Querystring: ListQuery & { outcome?: string } }>(
    "/api/admin/submissions",
    async (request) => {
      const { limit, offset } = parsePaging(request.query);
      return admin.listSubmissions(limit, offset, request.query.outcome);
    },
  );

  app.get<{ Querystring: ListQuery }>("/api/admin/moderation", async (request) => {
    const { limit, offset } = parsePaging(request.query);
    return admin.listModerationEvents(limit, offset);
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
};
