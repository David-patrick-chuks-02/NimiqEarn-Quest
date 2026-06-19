import type { CreateUserInput } from "@nimiqearn/shared";

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
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
