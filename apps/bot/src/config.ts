import { z } from "zod";

const emptyToUndefined = (value: unknown) => (value === "" ? undefined : value);

const baseEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  API_URL: z.string().url().default("http://localhost:3001"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  WEBHOOK_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  WEBHOOK_SECRET: z.preprocess(emptyToUndefined, z.string().min(16).optional()),
  BOT_WEBHOOK_PORT: z.coerce.number().default(3002),
});

const envSchema = baseEnvSchema.superRefine((data, ctx) => {
  if (data.WEBHOOK_URL && !data.WEBHOOK_SECRET) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "WEBHOOK_SECRET is required when WEBHOOK_URL is set",
      path: ["WEBHOOK_SECRET"],
    });
  }
});

export type BotEnv = z.infer<typeof envSchema>;
export type WebhookBotEnv = BotEnv & { WEBHOOK_URL: string; WEBHOOK_SECRET: string };

export function loadBotEnv(): BotEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid bot environment:", parsed.error.flatten().fieldErrors);
    throw new Error("Bot environment validation failed");
  }
  return parsed.data;
}

export function isWebhookMode(env: BotEnv): env is WebhookBotEnv {
  return Boolean(env.WEBHOOK_URL && env.WEBHOOK_SECRET);
}
