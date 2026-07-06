import * as Sentry from "@sentry/node";

let enabled = false;

export interface InitSentryOptions {
  /** Sentry DSN. When empty/undefined, monitoring stays disabled (a no-op). */
  dsn?: string;
  /** Deploy environment tag, e.g. "production" | "staging" | "development". */
  environment?: string;
  /** Release identifier, e.g. a git SHA or app version. */
  release?: string;
  /** Distinguishes services in Sentry (e.g. "nimiqearn-api" vs "nimiqearn-bot"). */
  serverName?: string;
  /** Performance tracing sample rate. Defaults to 0 — error monitoring only. */
  tracesSampleRate?: number;
}

/**
 * Initialise Sentry error monitoring for a Node service.
 *
 * No DSN → returns false and does nothing, so local dev, tests, and CI run
 * without a Sentry account or network calls. When a DSN is present, Sentry's
 * default integrations also capture uncaught exceptions and unhandled
 * rejections automatically, on top of anything reported via captureException.
 *
 * @returns true if Sentry was initialised, false if monitoring is disabled.
 */
export function initSentry(options: InitSentryOptions): boolean {
  const dsn = options.dsn?.trim();
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: options.environment,
    release: options.release,
    serverName: options.serverName,
    tracesSampleRate: options.tracesSampleRate ?? 0,
  });

  enabled = true;
  return true;
}

/** Whether Sentry is currently active (a DSN was provided at init). */
export function isSentryEnabled(): boolean {
  return enabled;
}

/** Report an error to Sentry. No-op when monitoring is disabled. */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/**
 * Flush buffered events to Sentry before the process exits. Always resolves;
 * a no-op (resolves immediately) when monitoring is disabled.
 */
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  if (!enabled) return;
  try {
    await Sentry.flush(timeoutMs);
  } catch {
    // Never let a failed flush mask the original error / block shutdown.
  }
}

export { Sentry };
