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
