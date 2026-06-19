import { RedisAdapter } from "@grammyjs/storage-redis";
import { Redis } from "ioredis";
import type { BotEnv } from "./config.js";
import type { Logger } from "./logger.js";

export function createRedisSessionStorage(env: BotEnv, logger: Logger) {
  const redis = new Redis(env.REDIS_URL);

  redis.on("error", (error) => {
    logger.error({ err: error }, "Redis connection error");
  });

  redis.on("connect", () => {
    logger.info("Redis connected for bot sessions");
  });

  return {
    redis,
    storage: new RedisAdapter({ instance: redis }),
  };
}
