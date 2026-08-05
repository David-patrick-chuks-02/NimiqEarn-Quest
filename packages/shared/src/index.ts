import { z } from "zod";

export const userRoleSchema = z.enum(["WORKER", "CREATOR", "ADMIN"]);
export const userStatusSchema = z.enum(["PENDING", "ACTIVE", "SUSPENDED"]);
export const walletStatusSchema = z.enum(["PENDING", "VERIFIED", "INVALID"]);
export const questCategorySchema = z.enum([
  "PRODUCT_TESTING",
  "SOCIAL_CAMPAIGN",
  "COMMUNITY_ENGAGEMENT",
  "REFERRAL",
  "CONTENT",
  "FEEDBACK",
  "BUG_BOUNTY",
  "OTHER",
]);
export const questProofTypeSchema = z.enum([
  "TEXT",
  "LINK",
  "SCREENSHOT",
  "TRANSACTION_HASH",
  "REFERRAL_EVENT",
  "WALLET_INTERACTION",
  "UPLOADED_MEDIA",
]);
export const questStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);

/** Architecture decision outcomes from the hybrid verification pipeline. */
export const verificationOutcomeSchema = z.enum([
  "AUTO_APPROVE",
  "LIGHT_REVIEW",
  "MANUAL_REVIEW",
  "REJECT",
]);

export const aiVerifyRequestSchema = z.object({
  submissionId: z.string().min(1),
  proofType: questProofTypeSchema,
  proof: z.string().min(1),
  proofInstructions: z.string().default(""),
  title: z.string().optional(),
  /** Recent perceptual hashes from similar quests (for duplicate detection). */
  recentImageHashes: z.array(z.string()).max(200).optional(),
  /** Recent text proofs for cross-submission clone detection. */
  recentTextProofs: z.array(z.string().max(2000)).max(50).optional(),
  /** Sybil / farming risk hint from the API (0–1). */
  behavioralRisk: z.number().min(0).max(1).optional(),
  /** Creator sample evidence data URL for UI template matching. */
  sampleEvidence: z.string().max(700_000).optional(),
  /** Live social post text (from platform API / fetch) for screenshot↔post match. */
  livePostText: z.string().max(10_000).optional(),
});

export const aiVerifyResponseSchema = z.object({
  confidence: z.number().min(0).max(1),
  signals: z.record(z.unknown()).default({}),
  recommendation: z.enum(["approve", "review", "reject"]),
  imageHash: z.string().optional(),
});

export type VerificationOutcome = z.infer<typeof verificationOutcomeSchema>;
export type AiVerifyRequest = z.infer<typeof aiVerifyRequestSchema>;
export type AiVerifyResponse = z.infer<typeof aiVerifyResponseSchema>;

const ALLOWED_SAMPLE_MIME = /^data:image\/(jpeg|jpg|png|webp);base64,/i;

// NOTE: `role` is intentionally NOT accepted from clients — it is assigned
// server-side only (new users default to WORKER; creator/admin via dedicated flows).
export const createUserSchema = z.object({
  telegramId: z.string().min(1),
  telegramUsername: z.string().optional(),
  displayName: z.string().optional(),
});


// reward_amount is stored as Decimal(18, 8): max 10 integer digits, 8 fractional.
// Cap so reward × slots × 1e5 luna stays well inside bigint-safe product math.
const MAX_REWARD_AMOUNT = 1_000_000; // 1e6 NIM per completion
const MAX_TOTAL_SLOTS = 10_000;
const rewardAmountSchema = z
  .number()
  .positive()
  .max(MAX_REWARD_AMOUNT)
  // At most 8 decimal places. Uses a scaled-integer check so exponential-notation
  // values (e.g. 1e-9) can't slip past a naive string ".split('.')" test.
  .refine(
    (value) => {
      const scaled = value * 1e8;
      return Number.isFinite(scaled) && Math.abs(scaled - Math.round(scaled)) < 1e-3;
    },
    { message: "Reward supports at most 8 decimal places." },
  );

export const verificationConfigSchema = z
  .object({
    /** Expected recipient for TRANSACTION_HASH proofs (Nimiq address). */
    targetAddress: z.string().min(8).max(80).optional(),
    /** Minimum transfer amount in NIM for TRANSACTION_HASH proofs. */
    minAmountNim: z.number().positive().max(MAX_REWARD_AMOUNT).optional(),
    /** Hashtags that must appear in a fetched social post (or in instructions fallback). */
    requiredHashtags: z.array(z.string().min(1).max(64)).max(20).optional(),
    /** @mentions that must appear in the social post. */
    requiredMentions: z.array(z.string().min(1).max(64)).max(20).optional(),
    /** Minimum likes+reposts (or reactions) when platform metrics are available. */
    minEngagement: z.number().int().min(0).max(1_000_000).optional(),
    /** Minimum worker reputationScore required to submit. */
    minReputation: z.number().int().min(0).max(10_000).optional(),
    /** Reject proofs after this time (ISO date). */
    deadlineAt: z.coerce.date().optional(),
    /** Exact message that must be signed for WALLET_INTERACTION proofs. */
    expectedMessage: z.string().min(1).max(2000).optional(),
    /** Require signed address to match the worker's linked Nimiq wallet. */
    senderMustMatchWorker: z.boolean().optional(),
    /** Live post URL to compare against screenshot OCR (social + screenshot campaigns). */
    livePostUrl: z.string().url().max(2000).optional(),
    /** Referral: referred user must have completed at least one ACCEPTED quest. */
    requireFirstQuest: z.boolean().optional(),
  })
  .strict();

export type VerificationConfig = z.infer<typeof verificationConfigSchema>;

export const createQuestObjectSchema = z.object({
  title: z.string().min(3).max(100),
  category: questCategorySchema,
  description: z.string().min(10).max(2000),
  rewardAmount: rewardAmountSchema,
  totalSlots: z.number().int().positive().max(MAX_TOTAL_SLOTS),
  // Optional scheduled start. Omitted/null = the quest goes live as soon as it's published.
  startAt: z.coerce.date().optional(),
  proofType: questProofTypeSchema,
  proofInstructions: z.string().min(5).max(1000),
  // Optional sample-evidence image as a compressed JPEG/PNG/WebP data URL.
  sampleEvidence: z
    .string()
    .max(700_000)
    .refine((v) => ALLOWED_SAMPLE_MIME.test(v), "Must be a JPEG, PNG, or WebP image data URL")
    .optional(),
  verificationConfig: verificationConfigSchema.optional(),
});

export const createQuestSchema = createQuestObjectSchema.refine(
  (q) => q.rewardAmount * q.totalSlots <= 10_000_000,
  {
    message: "Reward pool (reward × slots) cannot exceed 10,000,000 NIM.",
    path: ["totalSlots"],
  },
);

// Editing a draft: every field is optional, but the same per-field rules apply.
export const updateQuestSchema = createQuestObjectSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateQuestInput = z.infer<typeof createQuestSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

export { loadRootEnv } from "./load-env.js";

export const APP_NAME = "NimiqEarn Quest";
