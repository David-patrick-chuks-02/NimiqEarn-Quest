import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// L8: warn loudly if public URLs are left at their placeholders in a production build.
if (process.env.NODE_ENV === "production") {
  if (!process.env.NEXT_PUBLIC_BOT_URL) {
    console.warn("⚠️  NEXT_PUBLIC_BOT_URL is not set — all 'Open App' links will be broken.");
  }
}

// The web server proxies the Creator Studio API to the API host so the browser only ever
// talks to the web origin. Set API_INTERNAL_URL where the API actually is.
const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const baseSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@nimiqearn/shared"],
  // Trim response weight and speed up image delivery.
  poweredByHeader: false,
  compress: true,
  images: {
    // Serve modern formats — much smaller than PNG/JPEG for the same quality.
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        // Creator Studio is a Telegram Mini App — Telegram Web loads it in an iframe,
        // so allow embedding by Telegram's origins (native app/webviews are unaffected).
        source: "/studio",
        headers: [
          ...baseSecurityHeaders,
          { key: "Content-Security-Policy", value: "frame-ancestors https://web.telegram.org https://*.telegram.org" },
        ],
      },
      // Long-cache the static brand images (unhashed public assets) so repeat visits and
      // OG/social scrapers don't re-download them.
      {
        source: "/:file(logo|icon).png",
        headers: [
          ...baseSecurityHeaders,
          { key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" },
        ],
      },
      { source: "/:path*", headers: baseSecurityHeaders },
    ];
  },
  async rewrites() {
    return [
      {
        // Creator Studio (Telegram Mini App) → API. Auth is the Mini App's initData,
        // verified server-side; the browser only ever talks to the web origin.
        source: "/api/studio/:path*",
        destination: `${API_INTERNAL_URL}/api/studio/:path*`,
      },
      {
        // Worker "do a quest" Mini App → API (GET /api/quests/:id/worker, POST .../submit).
        // Same-origin proxy so the browser only talks to the web origin; initData is
        // forwarded and verified server-side.
        source: "/api/quests/:path*",
        destination: `${API_INTERNAL_URL}/api/quests/:path*`,
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
