"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_SIZE, buildQuery } from "./utils";
import { useAdminAuth } from "./auth";

export function useAdminList<T>(
  path: string,
  searchInput: string,
  extra?: Record<string, string | undefined>,
) {
  const { unlocked, adminFetch } = useAdminAuth();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState(() => searchInput.trim());
  const [tick, setTick] = useState(0);
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchBoot = useRef(true);

  useEffect(() => {
    const next = searchInput.trim();
    if (searchBoot.current) {
      searchBoot.current = false;
      setSearch(next);
      return;
    }
    const delay = next === search ? 0 : 200;
    const t = setTimeout(() => {
      setPage(0);
      setSearch(next);
    }, delay);
    return () => clearTimeout(t);
  }, [searchInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const extraKey = JSON.stringify(extra ?? {});

  useEffect(() => {
    if (!unlocked) return;
    let cancelled = false;
    const parsed = JSON.parse(extraKey) as Record<string, string | undefined>;
    const qs = buildQuery({
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
      q: search || undefined,
      ...parsed,
    });
    const url = `${path}${qs}`;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = (await adminFetch(url, tick > 0 ? { bypassCache: true } : undefined)) as {
          items?: T[];
          total?: number;
        };
        if (cancelled) return;
        setItems(data.items ?? []);
        setTotal(typeof data.total === "number" ? data.total : 0);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [unlocked, adminFetch, path, page, search, extraKey, tick]);

  const reload = useCallback(() => setTick((n) => n + 1), []);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min(total, (page + 1) * PAGE_SIZE);
  const meta = loading && items.length === 0
    ? "Loading…"
    : total === 0
      ? "0 results"
      : `${from}–${to} of ${total}${loading ? "…" : ""}`;

  return {
    items,
    total,
    loading,
    error,
    page,
    pageCount,
    meta,
    setPage,
    reload,
    setError,
    adminFetch,
  };
}
