import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { createQuestSchema } from "@nimiqearn/shared";

/** Human-readable form-field labels for the quest create/edit validation errors. */
const QUEST_FIELD_LABELS: Record<string, string> = {
  title: "Title",
  category: "Category",
  description: "Description",
  rewardAmount: "Reward",
  totalSlots: "Slots",
  startAt: "Start time",
  proofType: "Proof type",
  proofInstructions: "Proof instructions",
  sampleEvidence: "Sample evidence",
};

/** Turn a Zod validation error into a single actionable message naming the offending field. */
function firstQuestValidationMessage(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Please check the quest details and try again.";
  const key = issue.path[0];
  const label = typeof key === "string" ? (QUEST_FIELD_LABELS[key] ?? key) : "Form";
  return `${label}: ${issue.message}`;
}
import { verifyInitData, type TelegramInitDataUser } from "../telegram-auth.js";
import {
  createQuestService,
  QuestServiceError,
  toQuestResponse,
  type PlatformFees,
} from "../services/quest.service.js";
import { questErrorStatus } from "./quests.js";
import { createCreatorService, CreatorServiceError } from "../services/creator.service.js";
import type { EscrowService } from "../services/escrow.service.js";
import type { TelegramNotifier } from "../services/telegram-notify.js";

interface StudioRouteOptions {
  botToken?: string;
  escrow?: EscrowService;
  fees?: PlatformFees;
  notifier?: TelegramNotifier;
  network?: string;
}

function sendStudioError(reply: FastifyReply, error: unknown) {
  if (error instanceof QuestServiceError) {
    return reply.code(questErrorStatus(error.code)).send({ error: error.message, code: error.code });
  }
  if (error instanceof CreatorServiceError) {
    const status =
      error.code === "USER_NOT_FOUND"
        ? 404
        : error.code === "NOT_CREATOR" || error.code === "SUSPENDED" || error.code === "NOT_VERIFIED"
          ? 403
          : 400;
    return reply.code(status).send({ error: error.message, code: error.code });
  }
  throw error;
}

/** The verified Telegram user is attached to the request by the auth hook below. */
type AuthedRequest = FastifyRequest & { tgUser?: TelegramInitDataUser };

function readInitData(request: FastifyRequest): string | null {
  const header = request.headers["x-telegram-init-data"];
  if (typeof header === "string" && header.length > 0) return header;
  const auth = request.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("tma ")) return auth.slice(4);
  return null;
}

/**
 * Resolve the faucet funding key. Prefer FAUCET_ADMIN_PRIVATE_KEY; otherwise walk up
 * from cwd and this module looking for repo-root `admin-wallet.json` (pnpm runs the API
 * with cwd=apps/api, so a plain relative read misses the file).
 */
async function loadFaucetPrivateKey(): Promise<string | null> {
  const fromEnv = process.env.FAUCET_ADMIN_PRIVATE_KEY?.trim();
  if (fromEnv) return fromEnv;

  const { existsSync } = await import("node:fs");
  const { readFile } = await import("node:fs/promises");
  const { dirname, resolve } = await import("node:path");
  const { fileURLToPath } = await import("node:url");

  const candidates = new Set<string>();
  for (const start of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    let dir = start;
    while (true) {
      candidates.add(resolve(dir, "admin-wallet.json"));
      const parent = dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      const parsed = JSON.parse(await readFile(path, "utf-8")) as { privateKeyHex?: unknown };
      if (typeof parsed.privateKeyHex === "string" && parsed.privateKeyHex.length > 0) {
        return parsed.privateKeyHex;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Suggested one-tap amounts in the faucet modal (testnet). */
const FAUCET_PRESETS = [100, 500, 1000, 5000, 10_000] as const;
/** Default selection when opening the faucet sheet. */
const FAUCET_DEFAULT_NIM = 500;
/** Per-wallet ceiling in NIM (balance-based; no USD / price feed). */
const FAUCET_MAX_NIM = 1_000_000;
const LUNA_PER_NIM = 100_000;

function parseRequestedFaucetNim(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return Math.floor(n);
}

/**
 * Build a faucet quote for the modal + POST enforcement: how much we'll send, current
 * balance, and remaining headroom under the 1M NIM / wallet cap.
 */
async function buildFaucetQuote(address: string, rpcUrl: string, requestedNim?: number) {
  const nimiqCore = await import("@nimiqearn/nimiq");
  const account = await nimiqCore.fetchNimiqAccount(rpcUrl, address);

  const balanceNim = account.balanceNim;
  const remainingNim =
    balanceNim !== null ? Math.max(0, Math.floor(FAUCET_MAX_NIM - balanceNim)) : null;

  const want = requestedNim ?? FAUCET_DEFAULT_NIM;
  let amountNim = 0;
  if (remainingNim !== null && remainingNim > 0) {
    amountNim = Math.min(Math.max(1, Math.floor(want)), remainingNim);
  }

  return {
    address,
    presets: [...FAUCET_PRESETS],
    defaultNim: FAUCET_DEFAULT_NIM,
    maxNim: FAUCET_MAX_NIM,
    balanceNim,
    remainingNim,
    requestedNim: want,
    amountNim,
    reachable: account.reachable,
    canRequest: account.reachable && amountNim > 0,
    capped: remainingNim !== null && remainingNim <= 0,
  };
}

/**
 * Creator Studio API — the Telegram Mini App backend. Every route authenticates with
 * verified Mini App initData (not the bot↔API shared secret), so it's exempt from that
 * gate in app.ts. All actions reuse the same quest/creator services as the bot.
 */
export const studioRoutes: FastifyPluginAsync<StudioRouteOptions> = async (app, opts) => {
  const botToken = opts.botToken;
  const quests = createQuestService(app.db, opts.escrow, opts.fees, opts.notifier);
  const creators = createCreatorService(app.db);

  app.addHook("onRequest", async (request, reply) => {
    if (!botToken) {
      return reply.code(503).send({ error: "Creator Studio is not configured." });
    }
    const initData = readInitData(request);
    const verified = initData ? verifyInitData(initData, botToken) : null;
    if (!verified) {
      return reply.code(401).send({ error: "Invalid or missing Telegram authentication." });
    }
    (request as AuthedRequest).tgUser = verified;
  });

  const telegramId = (request: FastifyRequest) => (request as AuthedRequest).tgUser!.telegramId;

  // Who am I? Returns the creator dashboard, or creator:false with a reason the UI can act on.
  app.get("/api/studio/me", async (request, reply) => {
    try {
      const dashboard = await creators.getDashboard(telegramId(request));
      return { creator: true, dashboard };
    } catch (error) {
      if (
        error instanceof CreatorServiceError &&
        (error.code === "NOT_CREATOR" || error.code === "USER_NOT_FOUND")
      ) {
        return { creator: false, reason: error.code };
      }
      return sendStudioError(reply, error);
    }
  });

  // Upgrade the current user to a creator (requires a verified profile / linked wallet).
  app.post("/api/studio/register", async (request, reply) => {
    try {
      await creators.registerCreator(telegramId(request));
      const dashboard = await creators.getDashboard(telegramId(request));
      return { creator: true, dashboard };
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });

  app.get("/api/studio/quests", async (request, reply) => {
    try {
      const list = await quests.listCreatorQuests(telegramId(request));
      return { quests: list.map(toQuestResponse) };
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });

  // Creator's custodial wallet balance — used by the studio to pre-check funding before a
  // publish. reachable:false means we couldn't read the chain (the server still enforces
  // funding at publish time, so this is advisory only).
  app.get("/api/studio/balance", async (request, reply) => {
    try {
      const user = await app.db.user.findUnique({
        where: { telegramId: telegramId(request) },
        include: { walletProfiles: true },
      });
      const wallet = user?.walletProfiles.find((w) => w.keyCiphertext) ?? null;
      if (!wallet) {
        return { hasWallet: false, address: null, balanceNim: null, reachable: false };
      }

      // Prefer escrow helper when it can talk to RPC; otherwise hit RPC directly so Studio
      // still shows a balance even if escrow encryption isn't configured.
      if (opts.escrow?.canCheckFunding) {
        const funding = await opts.escrow.getFunding(wallet.nimiqAddress, 0);
        return {
          hasWallet: true,
          address: wallet.nimiqAddress,
          balanceNim: funding.balanceNim,
          reachable: funding.reachable,
        };
      }

      const rpcUrl = process.env.NIMIQ_RPC_URL ?? "https://rpc.testnet.nimiqwatch.com/";
      const nimiqCore = await import("@nimiqearn/nimiq");
      const account = await nimiqCore.fetchNimiqAccount(rpcUrl, wallet.nimiqAddress);
      return {
        hasWallet: true,
        address: wallet.nimiqAddress,
        balanceNim: account.balanceNim,
        reachable: account.reachable,
      };
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });

  // On-chain transaction history for the creator's custodial wallet (transparency), with a
  // NimiqWatch explorer link per transaction. `supported:false` when there's no wallet/node.
  app.get("/api/studio/transactions", async (request, reply) => {
    try {
      const user = await app.db.user.findUnique({
        where: { telegramId: telegramId(request) },
        include: { walletProfiles: true },
      });
      const wallet = user?.walletProfiles.find((w) => w.keyCiphertext) ?? null;
      if (!wallet || !opts.escrow) {
        return { supported: false, transactions: [] };
      }
      const txs = await opts.escrow.getTransactions(wallet.nimiqAddress);
      if (txs === null) {
        return { supported: false, transactions: [] };
      }
      const self = wallet.nimiqAddress.replace(/\s/g, "").toUpperCase();
      const transactions = txs.map((t) => ({
        hash: t.hash,
        direction: t.to.replace(/\s/g, "").toUpperCase() === self ? "in" : "out",
        amountNim: t.valueNim,
        timestamp: t.timestamp,
        explorerUrl: opts.escrow!.explorerTxUrl(t.hash),
      }));
      return { supported: true, address: wallet.nimiqAddress, transactions };
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });

  app.post("/api/studio/quests", async (request, reply) => {
    const parsed = createQuestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: firstQuestValidationMessage(parsed.error), details: parsed.error.flatten() });
    }
    try {
      const quest = await quests.createDraftQuest(telegramId(request), parsed.data);
      return { quest: toQuestResponse(quest) };
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });

  app.post<{ Params: { questId: string } }>(
    "/api/studio/quests/:questId/publish",
    async (request, reply) => {
      try {
        const quest = await quests.publishQuest(telegramId(request), request.params.questId);
        return { quest: toQuestResponse(quest) };
      } catch (error) {
        return sendStudioError(reply, error);
      }
    },
  );

  // Live escrow funding status for a quest — the studio polls this to show the deposit
  // address, amount due, current balance, and whether it's funded enough to publish.
  app.get<{ Params: { questId: string } }>(
    "/api/studio/quests/:questId/funding",
    async (request, reply) => {
      try {
        const funding = await quests.getQuestFunding(telegramId(request), request.params.questId);
        if (!funding) return { supported: false };
        return {
          supported: true,
          escrowAddress: funding.address,
          requiredNim: funding.requiredNim,
          balanceNim: funding.balanceNim,
          reachable: funding.reachable,
          funded: funding.funded,
        };
      } catch (error) {
        return sendStudioError(reply, error);
      }
    },
  );

  // Per-quest analytics for the "Manage Quests" view — snapshot metrics + a daily
  // views/fills time-series. Only the owning creator can read it.
  app.get<{ Params: { questId: string } }>(
    "/api/studio/quests/:questId/analytics",
    async (request, reply) => {
      try {
        const analytics = await quests.getQuestAnalytics(telegramId(request), request.params.questId);
        return { analytics };
      } catch (error) {
        return sendStudioError(reply, error);
      }
    },
  );

  // Fee/promotion config so the studio can show the platform fee on the reward pool and the
  // promotion cost, and enable the Promote button only when promotion is configured.
  app.get("/api/studio/config", async () => {
    const promotionAvailable = Boolean(
      opts.escrow?.enabled && opts.fees?.address && (opts.fees?.promotionNim ?? 0) > 0,
    );
    return {
      feePercent: opts.fees?.percent ?? 0,
      promotionAvailable,
      promotionFeeNim: opts.fees?.promotionNim ?? 0,
    };
  });

  // Promote a published quest ("premium ad") — charges the flat promotion fee.
  app.post<{ Params: { questId: string } }>(
    "/api/studio/quests/:questId/promote",
    async (request, reply) => {
      try {
        await quests.promoteQuest(telegramId(request), request.params.questId);
        return { ok: true };
      } catch (error) {
        return sendStudioError(reply, error);
      }
    },
  );

  // DevTool Faucet quote — powers the confirm modal (amount + remaining 1M NIM cap).
  app.get<{ Querystring: { amountNim?: string } }>("/api/studio/faucet", async (request, reply) => {
    try {
      if (opts.network !== "testnet") {
        return reply.code(400).send({ error: "Faucet is only available on testnet." });
      }

      const user = await app.db.user.findUnique({
        where: { telegramId: telegramId(request) },
        include: { walletProfiles: true },
      });
      const wallet = user?.walletProfiles.find((w) => w.keyCiphertext) ?? null;
      if (!wallet?.nimiqAddress) {
        return reply.code(400).send({ error: "No custodial wallet found to fund." });
      }

      const rpcUrl = process.env.NIMIQ_RPC_URL ?? "https://rpc.testnet.nimiqwatch.com/";
      const requested = parseRequestedFaucetNim(request.query.amountNim);
      return await buildFaucetQuote(wallet.nimiqAddress, rpcUrl, requested);
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });

  // DevTool Faucet for testing: Funds the creator's custodial wallet with NIM on testnet.
  // Caps wallet balance at 1,000,000 NIM. Body: { amountNim?: number }.
  app.post<{ Body: { amountNim?: number } }>("/api/studio/faucet", async (request, reply) => {
    try {
      if (opts.network !== "testnet") {
        return reply.code(400).send({ error: "Faucet is only available on testnet." });
      }

      const user = await app.db.user.findUnique({
        where: { telegramId: telegramId(request) },
        include: { walletProfiles: true },
      });
      const wallet = user?.walletProfiles.find((w) => w.keyCiphertext) ?? null;
      if (!wallet || !wallet.nimiqAddress) {
        return reply.code(400).send({ error: "No custodial wallet found to fund." });
      }

      const privateKeyHex = await loadFaucetPrivateKey();
      if (!privateKeyHex) {
        return reply.code(500).send({
          error: "Admin test wallet not configured. Please set FAUCET_ADMIN_PRIVATE_KEY.",
        });
      }

      const nimiqCore = await import("@nimiqearn/nimiq");
      const rpcUrl = process.env.NIMIQ_RPC_URL ?? "https://rpc.testnet.nimiqwatch.com/";
      const requested = parseRequestedFaucetNim(request.body?.amountNim);
      const quote = await buildFaucetQuote(wallet.nimiqAddress, rpcUrl, requested);

      if (!quote.reachable) {
        return reply
          .code(503)
          .send({ error: "Couldn't check wallet balance. Please try again shortly." });
      }
      if (quote.capped || quote.amountNim <= 0) {
        return reply.code(400).send({
          error: `This wallet has reached the faucet cap of ${FAUCET_MAX_NIM.toLocaleString()} NIM.`,
          quote,
        });
      }

      const blockNumber = await nimiqCore.getRpcBlockNumber(rpcUrl);
      if (!blockNumber) {
        return reply.code(500).send({ error: "Failed to get block number from RPC." });
      }

      const tx = nimiqCore.buildBasicTransaction({
        privateKeyHex,
        recipient: wallet.nimiqAddress,
        valueLuna: BigInt(quote.amountNim) * BigInt(LUNA_PER_NIM),
        validityStartHeight: blockNumber,
        networkId: nimiqCore.networkIdFor("testnet"),
      });

      const result = await nimiqCore.sendRawTransaction(rpcUrl, tx.hex);
      if (result.error) {
        return reply.code(500).send({ error: result.error });
      }

      return {
        ok: true,
        hash: result.hash,
        amountNim: quote.amountNim,
        balanceBeforeNim: quote.balanceNim,
        balanceAfterNim:
          quote.balanceNim !== null ? quote.balanceNim + quote.amountNim : null,
        quote,
      };
    } catch (error) {
      return sendStudioError(reply, error);
    }
  });
};
