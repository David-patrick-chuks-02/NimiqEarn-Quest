import type { FastifyPluginAsync } from "fastify";
import { linkWalletSchema } from "@nimiqearn/shared";
import {
  createWalletService,
  toWalletResponse,
  WalletServiceError,
} from "../services/wallet.service.js";

export const walletRoutes: FastifyPluginAsync = async (app) => {
  const wallets = createWalletService(app.db);

  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet",
    async (request, reply) => {
      const wallet = await wallets.getWalletByTelegramId(request.params.telegramId);
      if (!wallet) {
        return reply.code(404).send({ error: "Wallet not found" });
      }
      return { wallet: toWalletResponse(wallet) };
    },
  );

  app.put<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet",
    async (request, reply) => {
      const parsed = linkWalletSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Invalid request",
          details: parsed.error.flatten(),
        });
      }

      try {
        const wallet = await wallets.linkWallet(
          request.params.telegramId,
          parsed.data.nimiqAddress,
        );
        return { wallet: toWalletResponse(wallet) };
      } catch (error) {
        if (error instanceof WalletServiceError) {
          const status =
            error.code === "USER_NOT_FOUND"
              ? 404
              : error.code === "ADDRESS_IN_USE"
                ? 409
                : 400;
          return reply.code(status).send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );
};
