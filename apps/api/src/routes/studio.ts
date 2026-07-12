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

interface StudioRouteOptions {
  botToken?: string;
  escrow?: EscrowService;
  fees?: PlatformFees;
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
 * Creator Studio API — the Telegram Mini App backend. Every route authenticates with
 * verified Mini App initData (not the bot↔API shared secret), so it's exempt from that
 * gate in app.ts. All actions reuse the same quest/creator services as the bot.
 */
export const studioRoutes: FastifyPluginAsync<StudioRouteOptions> = async (app, opts) => {
  const botToken = opts.botToken;
  const quests = createQuestService(app.db, opts.escrow, opts.fees);
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
      if (!opts.escrow?.canCheckFunding) {
        return { hasWallet: true, address: wallet.nimiqAddress, balanceNim: null, reachable: false };
      }
      const funding = await opts.escrow.getFunding(wallet.nimiqAddress, 0);
      return {
        hasWallet: true,
        address: wallet.nimiqAddress,
        balanceNim: funding.balanceNim,
        reachable: funding.reachable,
      };
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
};
