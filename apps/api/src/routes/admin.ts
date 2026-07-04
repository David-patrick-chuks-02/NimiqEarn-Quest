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
};
