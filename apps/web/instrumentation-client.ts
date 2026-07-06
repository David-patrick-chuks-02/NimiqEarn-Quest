// Sentry init for the browser. No-op unless NEXT_PUBLIC_SENTRY_DSN is set.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
  });
}

// Lets Sentry tie client-side navigation to errors on the App Router.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
