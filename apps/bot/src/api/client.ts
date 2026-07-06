import type { CreateQuestInput, CreateUserInput, UpdateQuestInput } from "@nimiqearn/shared";
import type { ApiQuest, CreatorDashboard } from "./types.js";
import { parseApiError } from "./types.js";

export interface ApiWallet {
  nimiqAddress: string;
  status: string;
  isPrimary?: boolean;
  linkedAt: string;
  updatedAt: string;
}

export interface ApiWalletListItem {
  id: string;
  nimiqAddress: string;
  status: string;
  isPrimary: boolean;
  linkedAt: string;
}

export interface WalletChallenge {
  token: string;
  message: string;
  expiresAt: string;
}

export interface PublicQuest {
  id: string;
  title: string;
  description: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  deadline: string;
  proofType: string;
  proofInstructions: string;
  viewCount: number;
  publishedAt: string | null;
  creatorName: string | null;
}

export interface ApiUser {
  id: string;
  telegramId: string;
  telegramUsername: string | null;
  displayName: string | null;
  role: string;
  status: string;
  reputationScore: number;
  createdAt: string;
  updatedAt: string;
  wallet: ApiWallet | null;
  wallets: ApiWalletListItem[];
}

export function createApiClient(baseUrl: string, sharedSecret?: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const authHeaders: Record<string, string> = sharedSecret
    ? { "x-internal-key": sharedSecret }
    : {};
  const jsonHeaders = { "Content-Type": "application/json", ...authHeaders };

  return {
    async upsertUser(input: CreateUserInput): Promise<ApiUser> {
      const response = await fetch(`${normalizedBase}/api/users/upsert`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to save profile (${response.status})`);
      }

      const data = (await response.json().catch(() => ({}))) as { user: ApiUser };
      return data.user;
    },

    async getUserByTelegramId(telegramId: string): Promise<ApiUser | null> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}`,
        { headers: authHeaders },
      );

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to look up profile (${response.status})`);
      }

      const data = (await response.json().catch(() => ({}))) as { user: ApiUser };
      return data.user;
    },

    async startWalletChallenge(telegramId: string): Promise<WalletChallenge> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/challenge`,
        { method: "POST", headers: authHeaders },
      );

      const data = (await response.json().catch(() => ({}))) as {
        challenge?: WalletChallenge;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        throw parseApiError(data, `Failed to start wallet verification (${response.status})`);
      }

      return data.challenge!;
    },

    /** Public: fetch a shared (published) quest by id, or null if unavailable. */
    async getPublicQuest(questId: string): Promise<PublicQuest | null> {
      const response = await fetch(
        `${normalizedBase}/api/quests/${encodeURIComponent(questId)}`,
        { headers: authHeaders },
      );
      if (!response.ok) return null;
      const data = (await response.json().catch(() => ({}))) as { quest?: PublicQuest };
      return data.quest ?? null;
    },

    /** Link a wallet by pasted address (validated server-side; no signing). */
    async linkWalletByAddress(telegramId: string, nimiqAddress: string): Promise<ApiWallet> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/link`,
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ nimiqAddress }) },
      );
      const data = (await response.json().catch(() => ({}))) as {
        wallet?: ApiWallet;
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        throw parseApiError(data, `Failed to link wallet (${response.status})`);
      }
      return data.wallet!;
    },

    /** Best-effort: tell the API which message to edit into a confirmation once the wallet links. */
    async setWalletChallengeNotify(telegramId: string, messageId: number): Promise<void> {
      await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/challenge/notify`,
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ messageId }) },
      );
    },

    async setPrimaryWallet(
      telegramId: string,
      walletId: string,
    ): Promise<ApiWalletListItem[]> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallets/${encodeURIComponent(walletId)}/primary`,
        { method: "POST", headers: authHeaders },
      );
      const data = (await response.json().catch(() => ({}))) as {
        wallets?: ApiWalletListItem[];
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        throw parseApiError(data, `Failed to set primary wallet (${response.status})`);
      }
      return data.wallets ?? [];
    },

    async unlinkWallet(telegramId: string, walletId: string): Promise<ApiWalletListItem[]> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallets/${encodeURIComponent(walletId)}`,
        { method: "DELETE", headers: authHeaders },
      );
      const data = (await response.json().catch(() => ({}))) as {
        wallets?: ApiWalletListItem[];
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        throw parseApiError(data, `Failed to unlink wallet (${response.status})`);
      }
      return data.wallets ?? [];
    },

    async registerCreator(telegramId: string): Promise<ApiUser> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/creator/register`,
        { method: "POST", headers: authHeaders },
      );

      const data = (await response.json().catch(() => ({}))) as { user?: ApiUser; error?: string; code?: string };

      if (!response.ok) {
        throw parseApiError(data, `Failed to register creator (${response.status})`);
      }

      return data.user!;
    },

    async getCreatorDashboard(telegramId: string): Promise<CreatorDashboard> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/creator/dashboard`,
        { headers: authHeaders },
      );

      const data = (await response.json().catch(() => ({}))) as {
        dashboard?: CreatorDashboard;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        throw parseApiError(data, `Failed to load creator dashboard (${response.status})`);
      }

      return data.dashboard!;
    },

    async createQuest(telegramId: string, input: CreateQuestInput): Promise<ApiQuest> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/quests`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            ...input,
            deadline: input.deadline.toISOString(),
          }),
        },
      );

      const data = (await response.json().catch(() => ({}))) as { quest?: ApiQuest; error?: string; code?: string };

      if (!response.ok) {
        throw parseApiError(data, `Failed to create quest (${response.status})`);
      }

      return data.quest!;
    },

    async updateQuest(
      telegramId: string,
      questId: string,
      input: UpdateQuestInput,
    ): Promise<ApiQuest> {
      const body: Record<string, unknown> = { ...input };
      if (input.deadline instanceof Date) {
        body.deadline = input.deadline.toISOString();
      }

      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/quests/${encodeURIComponent(questId)}`,
        {
          method: "PATCH",
          headers: jsonHeaders,
          body: JSON.stringify(body),
        },
      );

      const data = (await response.json().catch(() => ({}))) as { quest?: ApiQuest; error?: string; code?: string };

      if (!response.ok) {
        throw parseApiError(data, `Failed to update quest (${response.status})`);
      }

      return data.quest!;
    },

    async listCreatorQuests(telegramId: string, status?: string): Promise<ApiQuest[]> {
      const query = status ? `?status=${encodeURIComponent(status)}` : "";
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/quests${query}`,
        { headers: authHeaders },
      );

      const data = (await response.json().catch(() => ({}))) as { quests?: ApiQuest[]; error?: string; code?: string };

      if (!response.ok) {
        throw parseApiError(data, `Failed to list quests (${response.status})`);
      }

      return data.quests ?? [];
    },

    async publishQuest(telegramId: string, questId: string): Promise<ApiQuest> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/quests/${encodeURIComponent(questId)}/publish`,
        { method: "POST", headers: authHeaders },
      );

      const data = (await response.json().catch(() => ({}))) as { quest?: ApiQuest; error?: string; code?: string };

      if (!response.ok) {
        throw parseApiError(data, `Failed to publish quest (${response.status})`);
      }

      return data.quest!;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
