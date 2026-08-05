import type { CreateQuestInput, CreateUserInput, UpdateQuestInput } from "@nimiqearn/shared";
import type { ApiQuest, CreatorDashboard, DiscoverPage, WorkerEarnings } from "./types.js";
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

export interface PublicQuest {
  id: string;
  title: string;
  description: string;
  category: string;
  rewardAmount: string;
  totalSlots: number;
  filledSlots: number;
  slotsLeft: number;
  startAt: string | null;
  promoted: boolean;
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

/** Render free-tier API services can return 502/503/504 while cold-starting. */
async function fetchWithRetry(url: string, init?: RequestInit): Promise<Response> {
  const idempotent = !init?.method || init.method.toUpperCase() === "GET";
  const maxAttempts = idempotent ? 4 : 2;
  let lastGatewayStatus = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(url, init);
      if (
        (response.status === 502 || response.status === 503 || response.status === 504) &&
        attempt < maxAttempts - 1
      ) {
        lastGatewayStatus = response.status;
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      if (idempotent && attempt < maxAttempts - 1) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw new Error(`API unavailable (${lastGatewayStatus || "network"})`);
}

export function createApiClient(baseUrl: string, sharedSecret?: string) {
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const authHeaders: Record<string, string> = sharedSecret
    ? { "x-internal-key": sharedSecret }
    : {};
  const jsonHeaders = { "Content-Type": "application/json", ...authHeaders };

  return {
    async upsertUser(input: CreateUserInput): Promise<ApiUser> {
      const response = await fetchWithRetry(`${normalizedBase}/api/users/upsert`, {
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
      const response = await fetchWithRetry(
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

    /** Get-or-create the user's custodial wallet. Private key only when newly created. */
    async createCustodialWallet(
      telegramId: string,
    ): Promise<{ nimiqAddress: string; privateKey: string | null; created: boolean }> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/custodial`,
        { method: "POST", headers: authHeaders },
      );
      const data = (await response.json().catch(() => ({}))) as {
        nimiqAddress?: string;
        privateKey?: string | null;
        created?: boolean;
        error?: string;
        code?: string;
      };
      if (!response.ok) throw parseApiError(data, `Failed to create wallet (${response.status})`);
      return {
        nimiqAddress: data.nimiqAddress!,
        privateKey: data.privateKey ?? null,
        created: Boolean(data.created),
      };
    },

    /** On-chain balance of the user's wallet (NIM + USD), or null if they have none. */
    async getWalletBalance(telegramId: string): Promise<{
      nimiqAddress: string;
      balanceNim: number | null;
      balanceUsd: number | null;
      reachable: boolean;
    } | null> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/balance`,
        { headers: authHeaders },
      );
      if (!response.ok) return null;
      return (await response.json().catch(() => null)) as {
        nimiqAddress: string;
        balanceNim: number | null;
        balanceUsd: number | null;
        reachable: boolean;
      } | null;
    },

    /** Whether the user has a secure-action password set. */
    async getSecurityStatus(telegramId: string): Promise<{ passwordSet: boolean }> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/security`,
        { headers: authHeaders },
      );
      if (!response.ok) return { passwordSet: false };
      const data = (await response.json().catch(() => ({}))) as { passwordSet?: boolean };
      return { passwordSet: Boolean(data.passwordSet) };
    },

    /** Set or change the secure-action password (changing requires currentPassword). */
    async setSecurityPassword(
      telegramId: string,
      password: string,
      currentPassword?: string,
    ): Promise<void> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/security/password`,
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ password, currentPassword }) },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
        throw parseApiError(data, "Could not save password.");
      }
    },

    /** Remove the secure-action password (requires the current one). */
    async clearSecurityPassword(telegramId: string, password: string): Promise<void> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/security/password`,
        { method: "DELETE", headers: jsonHeaders, body: JSON.stringify({ password }) },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string };
        throw parseApiError(data, "Could not remove password.");
      }
    },

    /** Reveal (back up) the custodial private key. Requires the SAP when one is set. */
    async exportWalletKey(
      telegramId: string,
      password?: string,
    ): Promise<{ nimiqAddress: string; privateKey: string }> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/export`,
        { method: "POST", headers: jsonHeaders, body: JSON.stringify({ password }) },
      );
      const data = (await response.json().catch(() => ({}))) as {
        nimiqAddress?: string;
        privateKey?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok) throw parseApiError(data, `Failed to reveal key (${response.status})`);
      return { nimiqAddress: data.nimiqAddress!, privateKey: data.privateKey! };
    },

    /** Update the user's preferred bot language. */
    async setLanguage(telegramId: string, code: string): Promise<void> {
      await fetchWithRetry(`${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/language`, {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ code }),
      });
    },

    /** Withdraw NIM from the custodial wallet to an external address (amount NIM or "all"). */
    async withdraw(
      telegramId: string,
      toAddress: string,
      amount: number | "all",
      password?: string,
    ): Promise<{ hash: string; sentNim: number; recipient: string }> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/wallet/withdraw`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ toAddress, amount, password }),
        },
      );
      const data = (await response.json().catch(() => ({}))) as {
        hash?: string;
        sentNim?: number;
        recipient?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok) throw parseApiError(data, `Withdrawal failed (${response.status})`);
      return { hash: data.hash!, sentNim: data.sentNim!, recipient: data.recipient! };
    },

    /** Public: fetch a shared (published) quest by id, or null if unavailable. */
    /** Live, open quests for worker discovery (promoted first, paginated). */
    async discoverQuests(
      opts: { page?: number; pageSize?: number; category?: string; telegramId?: string } = {},
    ): Promise<DiscoverPage> {
      const params = new URLSearchParams();
      if (opts.page != null) params.set("page", String(opts.page));
      if (opts.pageSize != null) params.set("pageSize", String(opts.pageSize));
      if (opts.category) params.set("category", opts.category);
      // Sent with the shared secret (authHeaders) so the API personalizes the list.
      if (opts.telegramId) params.set("telegramId", opts.telegramId);
      const query = params.toString();
      const response = await fetchWithRetry(
        `${normalizedBase}/api/quests${query ? `?${query}` : ""}`,
        { headers: authHeaders },
      );
      const body = (await response.json().catch(() => ({}))) as DiscoverPage & {
        error?: string;
        code?: string;
      };
      // Throw on failure so the caller shows an error instead of a misleading empty list.
      if (!response.ok || !Array.isArray(body.quests)) {
        throw parseApiError(body, `Couldn't load quests (${response.status}).`);
      }
      return body;
    },

    /** A worker's submission history + total NIM earned. */
    async getWorkerSubmissions(telegramId: string): Promise<WorkerEarnings> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/submissions`,
        { headers: authHeaders },
      );
      const body = (await response.json().catch(() => ({}))) as WorkerEarnings & {
        error?: string;
        code?: string;
      };
      if (!response.ok || !Array.isArray(body.submissions)) {
        throw parseApiError(body, `Couldn't load earnings (${response.status}).`);
      }
      return body;
    },

    async getPublicQuest(questId: string): Promise<PublicQuest | null> {
      const response = await fetchWithRetry(
        `${normalizedBase}/api/quests/${encodeURIComponent(questId)}`,
        { headers: authHeaders },
      );
      if (!response.ok) return null;
      const data = (await response.json().catch(() => ({}))) as { quest?: PublicQuest };
      return data.quest ?? null;
    },

    async registerCreator(telegramId: string): Promise<ApiUser> {
      const response = await fetchWithRetry(
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
      const response = await fetchWithRetry(
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
      const response = await fetchWithRetry(
        `${normalizedBase}/api/users/${encodeURIComponent(telegramId)}/quests`,
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify(input),
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

      const response = await fetchWithRetry(
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
      const response = await fetchWithRetry(
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
      const response = await fetchWithRetry(
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
