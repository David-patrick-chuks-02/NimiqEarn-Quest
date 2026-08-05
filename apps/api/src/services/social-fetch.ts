/**
 * Social post fetch via public HTML (og tags). No paid platform API.
 */
export interface SocialPostSnapshot {
  platform: "x" | "other";
  url: string;
  exists: boolean;
  deleted: boolean;
  isPublic: boolean;
  text: string;
  hashtags: string[];
  mentions: string[];
  engagement: number | null;
  source: "html" | "error";
  error?: string;
}

function extractHashtags(text: string): string[] {
  return [...text.matchAll(/#([a-zA-Z0-9_]{2,64})/gi)].map((m) => m[1]!.toLowerCase());
}

function extractMentions(text: string): string[] {
  return [...text.matchAll(/@([a-zA-Z0-9_]{2,64})/gi)].map((m) => m[1]!.toLowerCase());
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function fetchHtml(url: string): Promise<SocialPostSnapshot> {
  const host = new URL(url).hostname.toLowerCase();
  const platform: SocialPostSnapshot["platform"] =
    host.includes("x.com") || host.includes("twitter.com") ? "x" : "other";
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
      headers: {
        "user-agent": "NimiqEarnQuest-Verifier/1.0",
        accept: "text/html,application/json;q=0.9,*/*;q=0.8",
      },
    });
    if (res.status === 404 || res.status === 410) {
      return {
        platform,
        url,
        exists: false,
        deleted: true,
        isPublic: false,
        text: "",
        hashtags: [],
        mentions: [],
        engagement: null,
        source: "html",
      };
    }
    const body = (await res.text()).slice(0, 250_000);
    const isPublic = res.status >= 200 && res.status < 400;
    // Prefer og:description / twitter:description when present.
    const og =
      body.match(/property=["']og:description["']\s+content=["']([^"']+)/i)?.[1] ??
      body.match(/name=["']description["']\s+content=["']([^"']+)/i)?.[1] ??
      "";
    const text = decodeHtml(og) || body.replace(/<[^>]+>/g, " ").slice(0, 4000);
    return {
      platform,
      url,
      exists: isPublic,
      deleted: !isPublic,
      isPublic,
      text,
      hashtags: extractHashtags(text + body),
      mentions: extractMentions(text + body),
      engagement: null,
      source: "html",
    };
  } catch (err) {
    return {
      platform,
      url,
      exists: false,
      deleted: false,
      isPublic: false,
      text: "",
      hashtags: [],
      mentions: [],
      engagement: null,
      source: "error",
      error: err instanceof Error ? err.message : "fetch_failed",
    };
  }
}

export async function fetchSocialPost(url: string): Promise<SocialPostSnapshot> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return {
      platform: "other",
      url,
      exists: false,
      deleted: false,
      isPublic: false,
      text: "",
      hashtags: [],
      mentions: [],
      engagement: null,
      source: "error",
      error: "invalid_url",
    };
  }

  return fetchHtml(parsed.toString());
}
