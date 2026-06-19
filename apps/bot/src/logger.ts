import pino from "pino";
import type { BotEnv } from "./config.js";

export function createLogger(env: BotEnv) {
  return pino({ level: env.LOG_LEVEL });
}

export type Logger = ReturnType<typeof createLogger>;
