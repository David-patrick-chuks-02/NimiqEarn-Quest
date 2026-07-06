import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { linkWalletSchema, verifyWalletSchema } from "@nimiqearn/shared";
import { fetchNimiqAccount } from "@nimiqearn/nimiq";
import { editTelegramMessage, sendTelegramMessage, type InlineKeyboardMarkup } from "../notify.js";
import {
  createWalletService,
  toWalletListItem,
  toWalletResponse,
  WalletServiceError,
  type WalletNotifyTarget,
} from "../services/wallet.service.js";

interface WalletRouteOptions {
  nimiqRpcUrl?: string;
  botToken?: string;
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
  const nimiqRpcUrl = opts.nimiqRpcUrl;
  const botToken = opts.botToken;

  // Buttons shown on the confirmation, so the user can jump straight back into the app.
  // These callback_data values mirror the bot's WALLET_CALLBACKS.open / CREATOR_CALLBACKS.backToMenu.
  const connectedKeyboard: InlineKeyboardMarkup = {
    inline_keyboard: [
      [
        { text: "My Wallets", callback_data: "wallet:open" },
        { text: "Main Menu", callback_data: "creator:back-menu" },
      ],
    ],
  };

  // Deliver wallet feedback by editing the original "Link your wallet" prompt in place
  // (chat_id == telegramId in a 1:1 chat). Falls back to a fresh message if that prompt
  // is gone or was never recorded — so the user always gets confirmation.
  const notifyWalletResult = async (token: string, target: WalletNotifyTarget, text: string) => {
    if (!botToken) return;
    if (target.messageId != null) {
      try {
        await editTelegramMessage(
          botToken,
          target.telegramId,
          target.messageId,
          text,
          connectedKeyboard,
        );
        return;
      } catch (err) {
        app.log.warn({ err, token }, "wallet notification edit failed; sending fresh message");
      }
    }
    await sendTelegramMessage(botToken, target.telegramId, text, connectedKeyboard);
  };

  // When the wallet links, turn the link prompt into a "connected" confirmation — so they
  // don't have to tap anything after signing (in Nimiq Pay or a browser).
  const onWalletLinked = botToken
    ? (target: WalletNotifyTarget, wallet: { nimiqAddress: string }) => {
        void notifyWalletResult(
          "linked",
          target,
          `✅ *Wallet connected*\n\n\`${wallet.nimiqAddress}\` is now linked and verified. You're all set.`,
        ).catch((err) => app.log.error({ err }, "wallet-linked notification failed"));
      }
    : undefined;

  // When a user re-signs a wallet they've already linked, confirm it in Telegram too
  // (mirrors the "already linked" screen on the web) instead of staying silent.
  const onWalletAlreadyLinked = botToken
    ? (target: WalletNotifyTarget, wallet: { nimiqAddress: string }) => {
        void notifyWalletResult(
          "already-linked",
          target,
          `ℹ️ *Wallet already linked*\n\n\`${wallet.nimiqAddress}\` is already linked to your account — you're all set.`,
        ).catch((err) => app.log.error({ err }, "wallet-already-linked notification failed"));
      }
    : undefined;

  const wallets = createWalletService(app.db, undefined, onWalletLinked, onWalletAlreadyLinked);

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

  // Link a wallet by pasted address (no signature). Validates format/checksum and links it.
  app.post<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet/link",
    async (request, reply) => {
      const parsed = linkWalletSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "Invalid request", code: "INVALID_ADDRESS" });
      }
      try {
        const wallet = await wallets.linkWalletByAddress(
          request.params.telegramId,
          parsed.data.nimiqAddress,
        );
        return { wallet: toWalletResponse(wallet) };
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
            message: challenge.message,
            expiresAt: challenge.expiresAt.toISOString(),
          },
        };
      } catch (error) {
        return sendWalletError(reply, error);
      }
    },
  );

  // Step 1b: record the Telegram message_id of the link prompt, so linking edits it in place.
  app.post<{ Params: { telegramId: string }; Body: { messageId?: number } }>(
    "/api/users/:telegramId/wallet/challenge/notify",
    async (request, reply) => {
      const messageId = request.body?.messageId;
      if (typeof messageId !== "number" || !Number.isInteger(messageId)) {
        return reply.code(400).send({ error: "messageId (integer) is required" });
      }
      await wallets.setChallengeNotifyMessage(request.params.telegramId, messageId);
      return { ok: true };
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
