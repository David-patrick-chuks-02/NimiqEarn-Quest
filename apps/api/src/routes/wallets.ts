import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { verifyWalletSchema } from "@nimiqearn/shared";
import { fetchNimiqAccount } from "@nimiqearn/nimiq";
import {
  createWalletService,
  toWalletListItem,
  toWalletResponse,
  WalletServiceError,
} from "../services/wallet.service.js";

interface WalletRouteOptions {
  nimiqRpcUrl?: string;
}

function walletErrorStatus(code: WalletServiceError["code"]) {
  switch (code) {
    case "USER_NOT_FOUND":
    case "CHALLENGE_NOT_FOUND":
    case "WALLET_NOT_FOUND":
      return 404;
    case "ADDRESS_IN_USE":
    case "ALREADY_LINKED":
      return 409;
    case "CHALLENGE_EXPIRED":
      return 410;
    case "SUSPENDED":
      return 403;
    default:
      return 400;
  }
}

function sendWalletError(reply: FastifyReply, error: unknown) {
  if (error instanceof WalletServiceError) {
    return reply
      .code(walletErrorStatus(error.code))
      .send({ error: error.message, code: error.code });
  }
  throw error;
}

export const walletRoutes: FastifyPluginAsync<WalletRouteOptions> = async (app, opts) => {
  const wallets = createWalletService(app.db);
  const nimiqRpcUrl = opts.nimiqRpcUrl;

  // List all wallets for a user (primary first).
  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallets",
    async (request, reply) => {
      const list = await wallets.getWalletsByTelegramId(request.params.telegramId);
      if (list === null) {
        return reply.code(404).send({ error: "User not found" });
      }
      return { wallets: list.map(toWalletListItem) };
    },
  );

  // Set a wallet as the primary payout wallet.
  app.post<{ Params: { telegramId: string; walletId: string } }>(
    "/api/users/:telegramId/wallets/:walletId/primary",
    async (request, reply) => {
      try {
        const list = await wallets.setPrimaryWallet(
          request.params.telegramId,
          request.params.walletId,
        );
        return { wallets: list.map(toWalletListItem) };
      } catch (error) {
        return sendWalletError(reply, error);
      }
    },
  );

  // Unlink a wallet.
  app.delete<{ Params: { telegramId: string; walletId: string } }>(
    "/api/users/:telegramId/wallets/:walletId",
    async (request, reply) => {
      try {
        const list = await wallets.unlinkWallet(request.params.telegramId, request.params.walletId);
        return { wallets: list.map(toWalletListItem) };
      } catch (error) {
        return sendWalletError(reply, error);
      }
    },
  );

  // Step 1: create a signing challenge (no address needed — it comes from the signature).
  app.post<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet/challenge",
    async (request, reply) => {
      try {
        const challenge = await wallets.startVerification(request.params.telegramId);
        return {
          challenge: {
            token: challenge.token,
            code: challenge.code,
            message: challenge.message,
            expiresAt: challenge.expiresAt.toISOString(),
          },
        };
      } catch (error) {
        return sendWalletError(reply, error);
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

      // Non-blocking on-chain enrichment: ownership is already proven by the signature.
      let onChain: { reachable: boolean; balanceNim: number | null } | undefined;
      if (nimiqRpcUrl) {
        const account = await fetchNimiqAccount(nimiqRpcUrl, wallet.nimiqAddress);
        onChain = { reachable: account.reachable, balanceNim: account.balanceNim };
        request.log.info(
          { address: wallet.nimiqAddress, onChain },
          "wallet on-chain check",
        );
      }

      return { wallet: toWalletResponse(wallet), onChain };
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
