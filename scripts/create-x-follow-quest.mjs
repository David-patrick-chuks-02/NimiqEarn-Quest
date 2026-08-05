#!/usr/bin/env node
/**
 * Create + publish David's "Follow on X" quest via the bot↔API internal routes.
 *
 * Usage (production — copy env from Render dashboard):
 *   TELEGRAM_ID=<david telegram id> \
 *   API_URL=https://<your-api>.onrender.com \
 *   API_SHARED_SECRET=<secret> \
 *   node scripts/create-x-follow-quest.mjs
 *
 * Optional:
 *   SAMPLE_IMAGE=./image.png   (default)
 *   DRY_RUN=1                  (print payload only, no API calls)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

const TELEGRAM_ID = process.env.TELEGRAM_ID ?? process.argv[2];
const API_URL = (process.env.API_URL ?? "").replace(/\/$/, "");
const API_SHARED_SECRET = process.env.API_SHARED_SECRET ?? "";
const SAMPLE_IMAGE = resolve(root, process.env.SAMPLE_IMAGE ?? "image.png");
const DRY_RUN = process.env.DRY_RUN === "1";

const QUEST = {
  title: "Follow @david_patrick01 on X",
  category: "SOCIAL_CAMPAIGN",
  description:
    "Follow David Patrick on X — the builder behind NimiqEarn Quest. Open his profile, tap Follow, then submit a screenshot showing you follow @david_patrick01.",
  rewardAmount: 1000,
  totalSlots: 50,
  proofType: "SCREENSHOT",
  proofInstructions:
    "1. Open https://x.com/david_patrick01\n2. Follow @david_patrick01\n3. Upload a screenshot showing you are following the account (see sample evidence).",
};

function loadSampleEvidence() {
  const buf = readFileSync(SAMPLE_IMAGE);
  const mime = SAMPLE_IMAGE.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  if (dataUrl.length > 700_000) {
    throw new Error(
      `Sample image too large after base64 (${dataUrl.length} chars). Compress it first.`,
    );
  }
  return dataUrl;
}

async function api(path, init = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(API_SHARED_SECRET ? { "x-internal-key": API_SHARED_SECRET } : {}),
    ...(init.headers ?? {}),
  };
  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return body;
}

async function main() {
  const sampleEvidence = loadSampleEvidence();
  const payload = { ...QUEST, sampleEvidence };

  console.log("Quest:");
  console.log(JSON.stringify({ ...QUEST, sampleEvidence: `[${sampleEvidence.length} chars]` }, null, 2));
  console.log(
    `\nFunding needed: ${(QUEST.rewardAmount * QUEST.totalSlots).toLocaleString()} NIM pool + platform fee`,
  );

  if (DRY_RUN) {
    console.log("\nDRY_RUN=1 — skipping API calls.");
    return;
  }

  if (!TELEGRAM_ID) {
    throw new Error("Set TELEGRAM_ID or pass it as the first argument.");
  }
  if (!API_URL) throw new Error("Set API_URL to your deployed API base URL.");

  const { quest } = await api(`/api/users/${encodeURIComponent(TELEGRAM_ID)}/quests`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  console.log(`\nDraft created: ${quest.id}`);

  const published = await api(
    `/api/users/${encodeURIComponent(TELEGRAM_ID)}/quests/${encodeURIComponent(quest.id)}/publish`,
    { method: "POST" },
  );
  console.log(`Published: ${published.quest?.id ?? quest.id}`);
  console.log(`Share link: ${process.env.WEB_PUBLIC_URL ?? "<set WEB_PUBLIC_URL>"}/q/${quest.id}`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
