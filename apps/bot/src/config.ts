import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  API_URL: z.string().url().default("http://localhost:3001"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
});

export type BotEnv = z.infer<typeof envSchema>;

export function loadBotEnv(): BotEnv {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid bot environment:", parsed.error.flatten().fieldErrors);
    throw new Error("Bot environment validation failed");
  }
  return parsed.data;
}
