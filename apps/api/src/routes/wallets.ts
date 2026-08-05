import type { FastifyPluginAsync, FastifyReply } from "fastify";
import {
  createCustodialWalletService,
  CustodialWalletError,
} from "../services/custodial-wallet.service.js";
import { createSecurityService } from "../services/security.service.js";

interface WalletRouteOptions {
  nimiqRpcUrl?: string;
  encryptionKey?: string;
  network?: string;
}

function custodialErrorStatus(code: CustodialWalletError["code"]) {
  switch (code) {
    case "USER_NOT_FOUND":
    case "NO_WALLET":
      return 404;
    case "SUSPENDED":
      return 403;
    case "NOT_CONFIGURED":
    case "RPC_UNAVAILABLE":
      return 503;
    default:
      return 400;
  }
}

/**
 * Wallet routes — custodial only. The platform generates and holds (encrypted) each user's
 * key; the private key is returned to the bot only at create/export time (to show once).
 */
export const walletRoutes: FastifyPluginAsync<WalletRouteOptions> = async (app, opts) => {
  const custodial = createCustodialWalletService(app.db, {
    encryptionKey: opts.encryptionKey,
    rpcUrl: opts.nimiqRpcUrl,
    network: opts.network,
  });
  const security = createSecurityService(app.db);

  const sendCustodialError = (reply: FastifyReply, error: unknown) => {
    if (error instanceof CustodialWalletError) {
      return reply
        .code(custodialErrorStatus(error.code))
        .send({ error: error.message, code: error.code });
    }
    throw error;
  };

  // Get-or-create the user's custodial wallet. Private key only when newly created.
  app.post<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet/custodial",
    async (request, reply) => {
      try {
        const w = await custodial.getOrCreate(request.params.telegramId);
        return {
          nimiqAddress: w.address,
          privateKey: w.created ? w.privateKeyHex : null,
          created: w.created,
        };
      } catch (error) {
        return sendCustodialError(reply, error);
      }
    },
  );

  // Reveal (back up) the custodial private key. Gated by the secure-action password when set.
  app.post<{ Params: { telegramId: string }; Body: { password?: string } }>(
    "/api/users/:telegramId/wallet/export",
    async (request, reply) => {
      if (!(await security.verify(request.params.telegramId, request.body?.password))) {
        return reply
          .code(403)
          .send({ error: "Incorrect security password.", code: "WRONG_PASSWORD" });
      }
      try {
        const w = await custodial.exportKey(request.params.telegramId);
        return { nimiqAddress: w.address, privateKey: w.privateKeyHex };
      } catch (error) {
        return sendCustodialError(reply, error);
      }
    },
  );

  // On-chain balance of the user's wallet.
  app.get<{ Params: { telegramId: string } }>(
    "/api/users/:telegramId/wallet/balance",
    async (request, reply) => {
      try {
        const balance = await custodial.getBalance(request.params.telegramId);
        if (!balance) return reply.code(404).send({ error: "No wallet" });
        return balance;
      } catch (error) {
        return sendCustodialError(reply, error);
      }
    },
  );

  // Withdraw NIM to an external address. amount is a NIM number, or "all".
  // Gated by the secure-action password when one is set.
  app.post<{
    Params: { telegramId: string };
    Body: { toAddress?: string; amount?: number | "all"; password?: string };
  }>("/api/users/:telegramId/wallet/withdraw", async (request, reply) => {
    const toAddress = request.body?.toAddress;
    const amount = request.body?.amount;
    if (typeof toAddress !== "string" || (amount !== "all" && typeof amount !== "number")) {
      return reply.code(400).send({ error: "toAddress and amount are required" });
    }
    if (!(await security.verify(request.params.telegramId, request.body?.password))) {
      return reply.code(403).send({ error: "Incorrect security password.", code: "WRONG_PASSWORD" });
    }
    try {
      const result = await custodial.withdraw(request.params.telegramId, toAddress, amount);
      return result;
    } catch (error) {
      return sendCustodialError(reply, error);
    }
  });
};
