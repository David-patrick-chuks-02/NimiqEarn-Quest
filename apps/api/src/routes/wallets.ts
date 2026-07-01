import type { FastifyPluginAsync } from "fastify";
import { linkWalletSchema, verifyWalletSchema } from "@nimiqearn/shared";
import {
  createWalletService,
  toWalletResponse,
  WalletServiceError,
} from "../services/wallet.service.js";

function walletErrorStatus(code: WalletServiceError["code"]) {
  switch (code) {
    case "USER_NOT_FOUND":
    case "CHALLENGE_NOT_FOUND":
      return 404;
    case "ADDRESS_IN_USE":
      return 409;
    case "CHALLENGE_EXPIRED":
      return 410;
    case "SUSPENDED":
      return 403;
    default:
      return 400;
  }
}

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

  // Step 1: create a signing challenge for the given address.
  app.post<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet/challenge",
    async (request, reply) => {
      const parsed = linkWalletSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
      }

      try {
        const challenge = await wallets.startVerification(
          request.params.telegramId,
          parsed.data.nimiqAddress,
        );
        return {
          challenge: {
            token: challenge.token,
            address: challenge.address,
            code: challenge.code,
            message: challenge.message,
            expiresAt: challenge.expiresAt.toISOString(),
          },
        };
      } catch (error) {
        if (error instanceof WalletServiceError) {
          return reply
            .code(walletErrorStatus(error.code))
            .send({ error: error.message, code: error.code });
        }
        throw error;
      }
    },
  );

  // Step 2 (read): challenge details for the signing page. Protected by the unguessable token.
  app.get<{ Params: { token: string } }>("/api/wallet/verify/:token", async (request, reply) => {
    const challenge = await wallets.getChallengeByToken(request.params.token);
    if (!challenge) {
      return reply.code(404).send({ error: "Challenge not found or expired" });
    }
    return { challenge };
  });

  // Step 2 (write): submit the signed proof; links + verifies the wallet on success.
  app.post<{ Params: { token: string } }>("/api/wallet/verify/:token", async (request, reply) => {
    const parsed = verifyWalletSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", details: parsed.error.flatten() });
    }

    try {
      const wallet = await wallets.confirmVerification(request.params.token, parsed.data);
      return { wallet: toWalletResponse(wallet) };
    } catch (error) {
      if (error instanceof WalletServiceError) {
        return reply
          .code(walletErrorStatus(error.code))
          .send({ error: error.message, code: error.code });
      }
      throw error;
    }
  });
};
