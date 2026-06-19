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

export const createUserSchema = z.object({
  telegramId: z.string().min(1),
  telegramUsername: z.string().optional(),
  displayName: z.string().optional(),
  role: userRoleSchema.default("WORKER"),
});

export const linkWalletSchema = z.object({
  nimiqAddress: z.string().min(10).max(120),
});

export const createQuestSchema = z.object({
  title: z.string().min(3).max(100),
  category: questCategorySchema,
  description: z.string().min(10),
  rewardAmount: z.number().positive(),
  totalSlots: z.number().int().positive(),
  deadline: z.coerce.date(),
  proofType: questProofTypeSchema,
  proofInstructions: z.string().min(5),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LinkWalletInput = z.infer<typeof linkWalletSchema>;
export type CreateQuestInput = z.infer<typeof createQuestSchema>;

export const APP_NAME = "NimiqEarn Quest";
