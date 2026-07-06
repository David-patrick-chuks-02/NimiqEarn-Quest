import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  APP_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  BOT_TOKEN: z.string().optional(),
  ADMIN_API_KEY: z.string().optional(),
  // Shared secret for bot → API calls. When set, all /api routes require it.
  API_SHARED_SECRET: z.string().optional(),
  // Nimiq Albatross JSON-RPC node. When set, wallet verification adds an on-chain balance check
  // and per-quest escrow funding can be verified.
  NIMIQ_RPC_URL: z.string().optional(),
  // Encrypts per-quest escrow wallet private keys at rest. When set (with NIMIQ_RPC_URL),
  // creating a quest provisions a funded-escrow wallet.
  ESCROW_ENCRYPTION_KEY: z.string().optional(),
  // Sentry error monitoring. When empty, monitoring is disabled (local dev, tests, CI).
  SENTRY_DSN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
    throw new Error("Environment validation failed");
  }
  return parsed.data;
}
