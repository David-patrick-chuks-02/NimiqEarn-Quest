import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { createSecurityService, SecurityServiceError } from "../services/security.service.js";

function securityErrorStatus(code: SecurityServiceError["code"]) {
  switch (code) {
    case "USER_NOT_FOUND":
    case "NO_PASSWORD":
      return 404;
    case "WRONG_PASSWORD":
      return 403;
    default:
      return 400;
  }
}

export const settingsRoutes: FastifyPluginAsync = async (app) => {
  const security = createSecurityService(app.db);

  const sendError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof SecurityServiceError) {
      return reply
        .code(securityErrorStatus(error.code))
        .send({ error: error.message, code: error.code });
    }
    throw error;
  };

  // Whether a secure-action password is set.
  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/security",
    async (request, reply) => {
      try {
        return await security.status(request.params.telegramId);
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  // Set or change the password (changing requires currentPassword).
  app.post<{
    Params: { telegramId: string };
    Body: { password?: string; currentPassword?: string };
  }>("/api/users/:telegramId/security/password", async (request, reply) => {
    const { password, currentPassword } = request.body ?? {};
    if (typeof password !== "string") {
      return reply.code(400).send({ error: "password is required" });
    }
    try {
      await security.setPassword(request.params.telegramId, password, currentPassword);
      return { ok: true };
    } catch (error) {
      return sendError(reply, error);
    }
  });

  // Remove the password (requires the current one).
  app.delete<{ Params: { telegramId: string }; Body: { password?: string } }>(
    "/api/users/:telegramId/security/password",
    async (request, reply) => {
      const password = request.body?.password;
      if (typeof password !== "string") {
        return reply.code(400).send({ error: "password is required" });
      }
      try {
        await security.clearPassword(request.params.telegramId, password);
        return { ok: true };
      } catch (error) {
        return sendError(reply, error);
      }
    },
  );

  // Update the user's preferred bot language.
  app.post<{ Params: { telegramId: string }; Body: { code?: string } }>(
    "/api/users/:telegramId/language",
    async (request, reply) => {
      const code = request.body?.code;
      if (typeof code !== "string" || !/^[a-z]{2}$/.test(code)) {
        return reply.code(400).send({ error: "valid 2-letter language code required" });
      }
      const result = await app.db.user.updateMany({
        where: { telegramId: request.params.telegramId },
        data: { languageCode: code },
      });
      if (result.count === 0) return reply.code(404).send({ error: "User not found" });
      return { ok: true, code };
    },
  );
};
