export type Phase = "loading" | "no-telegram" | "not-creator" | "ready" | "error";
export type TabKey = "home" | "create" | "quests" | "wallet";

export type CategoryValue =
  | "PRODUCT_TESTING"
  | "SOCIAL_CAMPAIGN"
  | "COMMUNITY_ENGAGEMENT"
  | "REFERRAL"
  | "CONTENT"
  | "FEEDBACK"
  | "BUG_BOUNTY"
  | "OTHER";

export type ProofTypeValue =
  | "TEXT"
  | "LINK"
  | "SCREENSHOT"
  | "UPLOADED_MEDIA"
  | "TRANSACTION_HASH"
  | "REFERRAL_EVENT";

export type QuestTemplate = {
  id: string;
  label: string;
  blurb: string;
  category: CategoryValue;
  proofType: ProofTypeValue;
  title: string;
  description: string;
  proofInstructions: string;
  rewardAmount: string;
  totalSlots: string;
};

export interface Quest {
  id: string;
  title: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  startAt: string | null;
  scheduled: boolean;
  promoted: boolean;
  status: "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
  escrowAddress: string | null;
  viewCount: number;
  publishedAt: string | null;
}

export interface Dashboard {
  user: { displayName: string | null; role: string; status: string };
  quests: { total: number; DRAFT: number; PUBLISHED: number; CLOSED: number };
}

export type ProofRules = {
  targetAddress: string;
  minAmountNim: string;
  requiredHashtags: string;
  requiredMentions: string;
  expectedMessage: string;
  livePostUrl: string;
  requireFirstQuest: boolean;
};

export type QuestForm = ProofRules & {
  title: string;
  category: string;
  description: string;
  rewardAmount: string;
  totalSlots: string;
  startAt: string;
  proofType: string;
  proofInstructions: string;
  sampleEvidence: string;
  minReputation: string;
  deadlineAt: string;
};

export interface WalletTx {
  hash: string;
  direction: "in" | "out";
  amountNim: number;
  timestamp: number | null;
  explorerUrl: string;
}

export interface FaucetQuote {
  presets: number[];
  defaultNim: number;
  maxNim: number;
  balanceNim: number | null;
  remainingNim: number | null;
  requestedNim: number;
  amountNim: number;
  canRequest: boolean;
  capped: boolean;
  reachable: boolean;
}

export type QuestFilter = {
  status: "all" | "PUBLISHED" | "DRAFT" | "CLOSED";
  promotedOnly: boolean;
};

export type StudioSubmission = {
  id: string;
  status: string;
  proof: string;
  verificationOutcome?: string | null;
  confidenceScore?: number | null;
  verificationSignals?: Record<string, unknown> | null;
  moderationQueue?: string | null;
  creatorCanReview?: boolean;
  payoutTxUrl: string | null;
  createdAt: string;
  worker: { telegramId: string; username: string | null; displayName: string | null };
};

export type StudioBalance = {
  nim: number | null;
  reachable: boolean;
  address: string | null;
};

export type BalanceBump = { from: number; to: number };

export interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: string;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export {};
