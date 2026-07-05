import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { webhookCallback } from "grammy";
import type { WebhookBotEnv } from "./config.js";
import type { BotContext } from "./context.js";
import type { Bot } from "grammy";
import type { Logger } from "./logger.js";

const WEBHOOK_PATH = "/webhook";

export async function startWebhookServer(bot: Bot<BotContext>, env: WebhookBotEnv, logger: Logger) {
  const publicUrl = `${env.WEBHOOK_URL.replace(/\/$/, "")}${WEBHOOK_PATH}`;

  const handler = webhookCallback(bot, "http", {
    secretToken: env.WEBHOOK_SECRET,
  });

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    if (req.method === "GET" && req.url === "/health") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok", mode: "webhook" }));
      return;
    }

    if (req.method === "POST" && req.url === WEBHOOK_PATH) {
      // Never let a handler rejection become an unhandled rejection (would crash the process).
      Promise.resolve(handler(req, res)).catch((err) => {
        logger.error({ err }, "webhook handler error");
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        }
      });
      return;
    }

    res.writeHead(404);
    res.end();
  });

  await bot.api.setWebhook(publicUrl, {
    secret_token: env.WEBHOOK_SECRET,
  });

  // Prefer the platform-injected PORT (Render/Heroku/etc.); fall back to BOT_WEBHOOK_PORT locally.
  const port = Number(process.env.PORT) || env.BOT_WEBHOOK_PORT;
  await new Promise<void>((resolve) => {
    server.listen(port, "0.0.0.0", () => resolve());
  });

  logger.info({ publicUrl, port }, "Webhook server listening");

  return { server, publicUrl };
}
