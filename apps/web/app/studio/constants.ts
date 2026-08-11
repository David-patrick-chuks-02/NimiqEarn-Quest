import type { Dashboard, QuestTemplate, TabKey } from "./types";

export const CATEGORIES = [
  { value: "PRODUCT_TESTING", label: "Product testing" },
  { value: "SOCIAL_CAMPAIGN", label: "Social campaign" },
  { value: "COMMUNITY_ENGAGEMENT", label: "Community engagement" },
  { value: "REFERRAL", label: "Referral" },
  { value: "CONTENT", label: "Content" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "BUG_BOUNTY", label: "Bug bounty" },
  { value: "OTHER", label: "Other" },
] as const;

/** Creator-facing proof types that are launch-ready (wallet sign / video held back). */
export const PROOF_TYPES = [
  { value: "TEXT", label: "Text", hint: "Written answer" },
  { value: "LINK", label: "Link", hint: "Public URL" },
  { value: "SCREENSHOT", label: "Screenshot", hint: "Image proof" },
  { value: "UPLOADED_MEDIA", label: "Image", hint: "File upload" },
  { value: "TRANSACTION_HASH", label: "Tx hash", hint: "On-chain" },
  { value: "REFERRAL_EVENT", label: "Referral", hint: "Invite proof" },
] as const;
/** One-tap starters so creators don’t stare at empty enums. */
export const QUEST_TEMPLATES: QuestTemplate[] = [
  {
    id: "feedback-text",
    label: "Product feedback",
    blurb: "Text · easy review",
    category: "FEEDBACK",
    proofType: "TEXT",
    title: "Try the product and share feedback",
    description:
      "1. Open the product / bot and complete the main flow.\n2. Note what worked and what felt confusing.\n3. Submit a short written review.",
    proofInstructions: "Write 2–5 sentences: what you tried, what worked, what to improve.",
    rewardAmount: "50",
    totalSlots: "20",
  },
  {
    id: "social-link",
    label: "Social share",
    blurb: "Link to a public post",
    category: "SOCIAL_CAMPAIGN",
    proofType: "LINK",
    title: "Share our announcement post",
    description:
      "1. Open the campaign post linked in the instructions.\n2. Like / repost / quote as described.\n3. Submit the public URL of your post.",
    proofInstructions: "Paste the public link to your post (must be viewable without login).",
    rewardAmount: "25",
    totalSlots: "50",
  },
  {
    id: "screenshot-proof",
    label: "Screenshot proof",
    blurb: "Upload confirmation",
    category: "COMMUNITY_ENGAGEMENT",
    proofType: "SCREENSHOT",
    title: "Join and screenshot confirmation",
    description:
      "1. Complete the community action described below.\n2. Take a screenshot that clearly shows you did it.\n3. Upload that screenshot as proof.",
    proofInstructions: "Upload a clear screenshot showing the completed action.",
    rewardAmount: "30",
    totalSlots: "30",
  },
  {
    id: "onchain-tx",
    label: "On-chain payment",
    blurb: "Verified on-chain",
    category: "OTHER",
    proofType: "TRANSACTION_HASH",
    title: "Send a small NIM test transfer",
    description:
      "1. Send the required NIM amount to the pay-to address in Verification rules.\n2. Copy the transaction hash.\n3. Submit the hash as proof.",
    proofInstructions: "Paste the transaction hash from your wallet or explorer.",
    rewardAmount: "100",
    totalSlots: "10",
  },
  {
    id: "referral",
    label: "Referral",
    blurb: "Invite who joins",
    category: "REFERRAL",
    proofType: "REFERRAL_EVENT",
    title: "Invite a friend to start the bot",
    description:
      "1. Share your invite with a friend.\n2. They must open the bot and create a profile.\n3. Submit their Telegram username or id as proof.",
    proofInstructions: "Submit the referred person's Telegram @username or numeric id.",
    rewardAmount: "75",
    totalSlots: "25",
  },
  {
    id: "bug-bounty",
    label: "Bug report",
    blurb: "Repro write-up",
    category: "BUG_BOUNTY",
    proofType: "TEXT",
    title: "Report a reproducible bug",
    description:
      "1. Reproduce the issue.\n2. Describe steps, expected vs actual result.\n3. Include device / Telegram version if relevant.",
    proofInstructions: "Steps to reproduce, expected result, actual result.",
    rewardAmount: "200",
    totalSlots: "15",
  },
];

/** Defaults applied when the creator only changes category (keeps title if already typed). */
export const CATEGORY_DEFAULTS: Record<
  string,
  { proofType: string; proofHint: string }
> = {
  PRODUCT_TESTING: { proofType: "TEXT", proofHint: "Describe what you tested and your findings." },
  SOCIAL_CAMPAIGN: { proofType: "LINK", proofHint: "Paste the public URL of your post." },
  COMMUNITY_ENGAGEMENT: {
    proofType: "SCREENSHOT",
    proofHint: "Upload a screenshot that proves you completed the action.",
  },
  REFERRAL: {
    proofType: "REFERRAL_EVENT",
    proofHint: "Submit the referred person's Telegram @username or id.",
  },
  CONTENT: { proofType: "LINK", proofHint: "Paste the link to your published content." },
  FEEDBACK: { proofType: "TEXT", proofHint: "Write your feedback in a few sentences." },
  BUG_BOUNTY: { proofType: "TEXT", proofHint: "Steps to reproduce, expected vs actual." },
  OTHER: { proofType: "TEXT", proofHint: "Submit the proof described in the instructions." },
};
/** Proof-type–specific verification fields (cleared when the creator switches proof type). */
export const emptyProofRules = {
  targetAddress: "",
  minAmountNim: "",
  requiredHashtags: "",
  requiredMentions: "",
  expectedMessage: "",
  livePostUrl: "",
  requireFirstQuest: false,
};

export const emptyForm = {
  title: "",
  category: "SOCIAL_CAMPAIGN",
  description: "",
  rewardAmount: "",
  totalSlots: "",
  startAt: "",
  proofType: "LINK",
  proofInstructions: "",
  sampleEvidence: "", // compressed image data URL, optional
  // Optional verificationConfig (campaign rules)
  ...emptyProofRules,
  // Gates that apply to any proof type
  minReputation: "",
  deadlineAt: "",
};
export const PREVIEW_DASHBOARD: Dashboard = {
  user: { displayName: "Local preview", role: "CREATOR", status: "ACTIVE" },
  quests: { total: 0, DRAFT: 0, PUBLISHED: 0, CLOSED: 0 },
};
export const TABS: { key: TabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "create", label: "Create" },
  { key: "quests", label: "Quests" },
  { key: "wallet", label: "Wallet" },
];

// Per-tab page header (home has its own personalised greeting, so it's omitted here).
export const TAB_META: Partial<Record<TabKey, { title: string; subtitle: string }>> = {
  create: {
    title: "New quest",
    subtitle: "Start from a template, or build from scratch.",
  },
  quests: { title: "Your quests", subtitle: "Publish, share, and track performance." },
  wallet: { title: "Wallet", subtitle: "The balance that funds your quests." },
};

export const FAUCET_PRESETS_UI = [100, 500, 1000, 5000, 10_000] as const;
export const FAUCET_DEFAULT_NIM = 500;
export const FAUCET_MAX_NIM_UI = 1_000_000;
