import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      // Studio form/payload helpers live in app/, not src/ — they carry API-contract logic
      // (what a PATCH may send), so they need coverage too.
      "apps/web/app/**/*.test.ts",
    ],
  },
});
