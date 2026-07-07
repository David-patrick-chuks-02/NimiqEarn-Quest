// Cached NIM → USD price. CoinGecko's free API is rate-limited, so we cache the last value
// and only refetch every CACHE_MS. Returns null (never throws) when the price is unavailable,
// so callers can gracefully omit the USD figure.

const COINGECKO_URL = "https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=usd";
const CACHE_MS = 60_000;

let cached: { price: number; at: number } | null = null;
let inFlight: Promise<number | null> | null = null;

async function fetchPrice(): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(COINGECKO_URL, { signal: controller.signal }).finally(() =>
      clearTimeout(timer),
    );
    if (!response.ok) return null;
    const json = (await response.json()) as { "nimiq-2"?: { usd?: number } };
    const price = json["nimiq-2"]?.usd;
    return typeof price === "number" && price > 0 ? price : null;
  } catch {
    return null;
  }
}

/** Current NIM price in USD, or null if unavailable. Cached for CACHE_MS. */
export async function getNimUsdPrice(now: () => number = Date.now): Promise<number | null> {
  if (cached && now() - cached.at < CACHE_MS) return cached.price;
  // Coalesce concurrent refreshes into one request.
  if (!inFlight) {
    inFlight = fetchPrice().then((price) => {
      if (price !== null) cached = { price, at: now() };
      inFlight = null;
      return price;
    });
  }
  const fresh = await inFlight;
  // Fall back to a stale cached value if the refresh failed.
  return fresh ?? cached?.price ?? null;
}
