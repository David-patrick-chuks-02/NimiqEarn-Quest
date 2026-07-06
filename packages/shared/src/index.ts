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
]);
export const questStatusSchema = z.enum(["DRAFT", "PUBLISHED", "CLOSED", "ARCHIVED"]);

// NOTE: `role` is intentionally NOT accepted from clients — it is assigned
// server-side only (new users default to WORKER; creator/admin via dedicated flows).
export const createUserSchema = z.object({
  telegramId: z.string().min(1),
  telegramUsername: z.string().optional(),
  displayName: z.string().optional(),
});


// reward_amount is stored as Decimal(18, 8): max 10 integer digits, 8 fractional.
const MAX_REWARD_AMOUNT = 1_000_000_000; // 1e9, comfortably within the Decimal range
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

export const createQuestSchema = z.object({
  title: z.string().min(3).max(100),
  category: questCategorySchema,
  description: z.string().min(10).max(2000),
  rewardAmount: rewardAmountSchema,
  totalSlots: z.number().int().positive().max(1_000_000),
  deadline: z.coerce.date(),
  proofType: questProofTypeSchema,
  proofInstructions: z.string().min(5).max(1000),
});

// Editing a draft: every field is optional, but the same per-field rules apply.
export const updateQuestSchema = createQuestSchema.partial();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type CreateQuestInput = z.infer<typeof createQuestSchema>;
export type UpdateQuestInput = z.infer<typeof updateQuestSchema>;

export { loadRootEnv } from "./load-env.js";

export const APP_NAME = "NimiqEarn Quest";
