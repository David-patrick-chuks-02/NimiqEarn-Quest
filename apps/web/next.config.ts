import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// L8: warn loudly if public URLs are left at their placeholders in a production build.
if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXT_PUBLIC_BOT_URL) {
    console.warn("⚠️  NEXT_PUBLIC_BOT_URL is not set — all 'Open App' links will be broken.");
  }
}

// The web server proxies the wallet-verify endpoints to the API so the browser only ever
// talks to the web origin — no cross-origin fetch, no CORS, no reliance on the client
// being able to reach the API host directly. Set API_INTERNAL_URL where the API actually is.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't let the ?token= in the signing URL leak to third parties via Referer.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@nimiqearn/shared"],
  async headers() {
    return [
      {
        // The signing page performs a sensitive action — never allow it to be framed.
        source: "/link-wallet",
        headers: [...baseSecurityHeaders, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // Creator Studio is a Telegram Mini App — Telegram Web loads it in an iframe,
        // so allow embedding by Telegram's origins (native app/webviews are unaffected).
        source: "/studio",
        headers: [
          ...baseSecurityHeaders,
          { key: "Content-Security-Policy", value: "frame-ancestors https://web.telegram.org https://*.telegram.org" },
        ],
      },
      { source: "/:path*", headers: baseSecurityHeaders },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/wallet/verify/:path*",
        destination: `${API_INTERNAL_URL}/api/wallet/verify/:path*`,
      },
      {
        // Creator Studio (Telegram Mini App) → API. Auth is the Mini App's initData,
        // verified server-side; the browser only ever talks to the web origin.
        source: "/api/studio/:path*",
        destination: `${API_INTERNAL_URL}/api/studio/:path*`,
      },
    ];
  },
};

// Sentry wraps the build to instrument the app and (when SENTRY_AUTH_TOKEN is set)
// upload source maps. Without a DSN/token at runtime the SDK is a no-op, so this is
// safe to keep on in every environment.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  // Only uploads source maps when SENTRY_AUTH_TOKEN is present; otherwise skipped.
  telemetry: false,
});
