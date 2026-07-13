export interface ApiQuest {
  id: string;
  title: string;
  category: string;
  description: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  startAt: string | null;
  scheduled?: boolean;
  promoted: boolean;
  proofType: string;
  proofInstructions: string;
  status: string;
  createdAt: string;
  publishedAt: string | null;
}

/** Lightweight quest shape returned by the discovery/browse list. */
export interface DiscoverQuest {
  id: string;
  title: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  promoted: boolean;
  proofType: string;
  viewCount: number;
  creatorName: string | null;
}

export interface DiscoverPage {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  quests: DiscoverQuest[];
}

export interface WorkerSubmission {
  id: string;
  questId: string;
  questTitle: string;
  reward: number;
  status: string;
  payoutTxHash: string | null;
  payoutTxUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface WorkerEarnings {
  totalEarned: number;
  count: number;
  submissions: WorkerSubmission[];
}

export interface CreatorDashboard {
  user: {
    id: string;
    telegramId: string;
    displayName: string | null;
    role: string;
    status: string;
  };
  quests: {
    total: number;
    DRAFT: number;
    PUBLISHED: number;
    CLOSED: number;
    ARCHIVED: number;
  };
}

export function parseApiError(data: { error?: string; code?: string }, fallback: string) {
  const error = new Error(data.error ?? fallback);
  (error as Error & { code?: string }).code = data.code;
  return error;
}
