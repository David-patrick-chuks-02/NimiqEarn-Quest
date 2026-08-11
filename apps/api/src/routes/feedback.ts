import { createHash } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { checkRateLimit } from "../rate-limit.js";

const MAX_MESSAGE = 2000;
const MAX_NAME = 80;
const MAX_HANDLE = 64;

function hashIp(ip: string | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Public anonymous feedback for the Telegram build review.
 * POST is open (rate-limited). Listing is via /api/admin/feedback with ADMIN_API_KEY.
 */
export const feedbackRoutes: FastifyPluginAsync = async (app) => {
  app.post<{
    Body: {
      message?: string;
      displayName?: string;
      telegramHandle?: string;
      rating?: number;
    };
  }>("/api/feedback", async (request, reply) => {
    const ip = request.ip || "unknown";
    const limit = checkRateLimit(`feedback:${ip}`, 8, 60 * 60 * 1000);
    if (!limit.allowed) {
      return reply
        .code(429)
        .header("retry-after", String(limit.retryAfterSec))
        .send({ error: "Too many feedback submissions. Please try again later." });
    }

    const rawMessage = typeof request.body?.message === "string" ? request.body.message.trim() : "";
    if (!rawMessage) {
      return reply.code(400).send({ error: "Please write a short message." });
    }
    if (rawMessage.length > MAX_MESSAGE) {
      return reply.code(400).send({ error: `Message must be ${MAX_MESSAGE} characters or fewer.` });
    }

    let displayName =
      typeof request.body?.displayName === "string" ? request.body.displayName.trim() : "";
    if (displayName.length > MAX_NAME) displayName = displayName.slice(0, MAX_NAME);
    if (!displayName) displayName = "";

    let telegramHandle =
      typeof request.body?.telegramHandle === "string" ? request.body.telegramHandle.trim() : "";
    if (telegramHandle.startsWith("@")) telegramHandle = telegramHandle.slice(1);
    if (telegramHandle.length > MAX_HANDLE) telegramHandle = telegramHandle.slice(0, MAX_HANDLE);
    if (telegramHandle && !/^[A-Za-z0-9_]{3,64}$/.test(telegramHandle)) {
      return reply.code(400).send({ error: "Telegram handle looks invalid." });
    }

    let rating: number | null = null;
    if (request.body?.rating !== undefined && request.body?.rating !== null) {
      const n = Number(request.body.rating);
      if (!Number.isInteger(n) || n < 1 || n > 5) {
        return reply.code(400).send({ error: "Rating must be an integer from 1 to 5." });
      }
      rating = n;
    }

    const ua = request.headers["user-agent"];
    const userAgent = typeof ua === "string" ? ua.slice(0, 256) : null;

    const row = await app.db.feedback.create({
      data: {
        message: rawMessage,
        displayName: displayName || null,
        telegramHandle: telegramHandle || null,
        rating,
        userAgent,
        ipHash: hashIp(ip),
      },
      select: { id: true, createdAt: true },
    });

    return reply.code(201).send({ ok: true, id: row.id, createdAt: row.createdAt });
  });
};
