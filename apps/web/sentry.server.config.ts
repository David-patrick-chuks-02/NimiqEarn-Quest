// Sentry init for the Next.js server runtime (Node). Loaded from instrumentation.ts.
// No-op unless SENTRY_DSN is set, so local dev and CI builds stay clean.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,
  });
}
