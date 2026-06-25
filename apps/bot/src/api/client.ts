import type { CreateUserInput } from "@nimiqearn/shared";
import type { CreatorDashboard } from "./types.js";
import { parseApiError } from "./types.js";

export interface ApiWallet {
  nimiqAddress: string;
  status: string;
  linkedAt: string;
  updatedAt: string;
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
}

export function createApiClient(baseUrl: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");

  return {
    async upsertUser(input: CreateUserInput): Promise<ApiUser> {
      const response = await fetch(`${normalizedBase}/api/users/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        throw new Error(`Failed to save profile (${response.status})`);
      }

      const data = (await response.json()) as { user: ApiUser };
      return data.user;
    },

    async getUserByTelegramId(telegramId: string): Promise<ApiUser | null> {
      const response = await fetch(`${normalizedBase}/api/users/${encodeURIComponent(telegramId)}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to look up profile (${response.status})`);
      }

      const data = (await response.json()) as { user: ApiUser };
      return data.user;
    },

    async linkWallet(telegramId: string, nimiqAddress: string): Promise<ApiWallet> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nimiqAddress }),
        },
      );

      const data = (await response.json()) as { wallet?: ApiWallet; error?: string; code?: string };

      if (!response.ok) {
        const error = new Error(data.error ?? `Failed to link wallet (${response.status})`);
        (error as Error & { code?: string }).code = data.code;
        throw error;
      }

      return data.wallet!;
    },

    async registerCreator(telegramId: string): Promise<ApiUser> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/creator/register`,
        { method: "POST" },
      );

      const data = (await response.json()) as { user?: ApiUser; error?: string; code?: string };

      if (!response.ok) {
        throw parseApiError(data, `Failed to register creator (${response.status})`);
      }

      return data.user!;
    },

    async getCreatorDashboard(telegramId: string): Promise<CreatorDashboard> {
      const response = await fetch(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/creator/dashboard`,
      );

      const data = (await response.json()) as {
        dashboard?: CreatorDashboard;
        error?: string;
        code?: string;
      };

      if (!response.ok) {
        throw parseApiError(data, `Failed to load creator dashboard (${response.status})`);
      }

      return data.dashboard!;
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
