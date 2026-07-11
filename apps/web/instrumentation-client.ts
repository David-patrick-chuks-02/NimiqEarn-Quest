// Sentry init for the browser. Loaded lazily and only when NEXT_PUBLIC_SENTRY_DSN is set,
// so the ~130 kB browser SDK never lands in the first-load bundle. When the DSN is unset at
// build time (the marketing default) the dynamic import is dead-code-eliminated entirely;
// when it is set, Sentry loads after the page is interactive instead of blocking it.
import type * as SentryType from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

let routerTransition: typeof SentryType.captureRouterTransitionStart | undefined;

if (dsn) {
  void import("@sentry/nextjs").then((Sentry) => {
    Sentry.init({ dsn, tracesSampleRate: 0 });
    routerTransition = Sentry.captureRouterTransitionStart;
  });
}

// Next calls this on client-side navigations; forwards to Sentry once it has loaded.
export const onRouterTransitionStart: typeof SentryType.captureRouterTransitionStart = (
  ...args
) => routerTransition?.(...args);
