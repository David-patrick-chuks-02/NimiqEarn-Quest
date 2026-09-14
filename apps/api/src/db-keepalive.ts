import type { PrismaClient } from "@nimiqearn/database";

/** Once per day — enough to reset Supabase free-tier inactivity pause (~7 days). */
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Periodically run `SELECT 1` against Postgres so a free Supabase project does not
 * auto-pause from inactivity. Starts one ping shortly after boot, then every 24h.
 * Returns a stop handle for clean shutdown / tests.
 */
export function startDbKeepalive(
  db: PrismaClient,
  log: { info: (msg: string) => void; warn: (obj: unknown, msg?: string) => void },
): { stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const ping = async () => {
    if (stopped) return;
    try {
      await db.$queryRaw`SELECT 1`;
      log.info("DB keepalive ping ok");
    } catch (error) {
      log.warn(error, "DB keepalive ping failed");
    }
  };

  // Fire once soon after boot (don't block startup), then every 24h.
  const boot = setTimeout(() => {
    void ping();
    if (!stopped) {
      timer = setInterval(() => void ping(), DAY_MS);
      // Don't keep the process alive solely for the keepalive timer.
      if (typeof timer.unref === "function") timer.unref();
    }
  }, 5_000);
  if (typeof boot.unref === "function") boot.unref();

  return {
    stop() {
      stopped = true;
      clearTimeout(boot);
      if (timer) clearInterval(timer);
      timer = null;
    },
  };
}
