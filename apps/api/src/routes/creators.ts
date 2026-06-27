import type { FastifyPluginAsync } from "fastify";
import {
  createCreatorService,
  CreatorServiceError,
} from "../services/creator.service.js";
import { toUserResponse } from "../services/user.service.js";

export const creatorRoutes: FastifyPluginAsync = async (app) => {
  const creators = createCreatorService(app.db);

  app.post<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/creator/register",
    async (request, reply) => {
      try {
        const user = await creators.registerCreator(request.params.telegramId);
        return { user: toUserResponse(user) };
      } catch (error) {
        if (error instanceof CreatorServiceError) {
          const status =
            error.code === "USER_NOT_FOUND"
              ? 404
              : error.code === "SUSPENDED" || error.code === "NOT_VERIFIED"
                ? 403
                : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/creator/dashboard",
    async (request, reply) => {
      try {
        const dashboard = await creators.getDashboard(request.params.telegramId);
        return { dashboard };
      } catch (error) {
        if (error instanceof CreatorServiceError) {
          const status =
            error.code === "USER_NOT_FOUND"
              ? 404
              : error.code === "NOT_CREATOR"
                ? 403
                : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );
};
