"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useSyncExternalStore,
} from "react";

const TOKEN_STORAGE = "nimiqearn_admin_token";
const EMAIL_STORAGE = "nimiqearn_admin_email";
const AUTH_EVENT = "nimiqearn-admin-auth";
const CACHE_TTL_MS = 12_000;
const LEGACY_KEY_STORAGE = "nimiqearn_admin_key";

type CacheEntry = { at: number; data: unknown };
type AdminFetchInit = RequestInit & { bypassCache?: boolean };

type AdminAuthContextValue = {
  email: string;
  unlocked: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  adminFetch: (path: string, init?: AdminFetchInit) => Promise<unknown>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}

function notifyAuthChange() {
  window.dispatchEvent(new Event(AUTH_EVENT));
}

function subscribeAuth(onStoreChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === TOKEN_STORAGE || e.key === EMAIL_STORAGE || e.key === null) onStoreChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(AUTH_EVENT, onStoreChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(AUTH_EVENT, onStoreChange);
  };
}

function getTokenSnapshot() {
  return localStorage.getItem(TOKEN_STORAGE) ?? "";
}

function getEmailSnapshot() {
  return localStorage.getItem(EMAIL_STORAGE) ?? "";
}

function getServerSnapshot() {
  return "";
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeAuth, getTokenSnapshot, getServerSnapshot);
  const email = useSyncExternalStore(subscribeAuth, getEmailSnapshot, getServerSnapshot);
  const cacheRef = useRef(new Map<string, CacheEntry>());
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const adminFetch = useCallback(async (path: string, init?: AdminFetchInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const bypassCache = Boolean(init?.bypassCache);
    const { bypassCache: _ignored, ...fetchInit } = init ?? {};

    if (method === "GET" && !bypassCache) {
      const hit = cacheRef.current.get(path);
      if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
    }

    const activeToken = tokenRef.current.trim() || localStorage.getItem(TOKEN_STORAGE) || "";
    const res = await fetch(path, {
      ...fetchInit,
      headers: {
        ...(fetchInit.headers ?? {}),
        ...(activeToken ? { authorization: `Bearer ${activeToken}` } : {}),
        "content-type": "application/json",
      },
    });
    if (res.status === 401) {
      localStorage.removeItem(TOKEN_STORAGE);
      localStorage.removeItem(EMAIL_STORAGE);
      cacheRef.current.clear();
      notifyAuthChange();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
    }
    const data = await res.json();

    if (method === "GET") {
      cacheRef.current.set(path, { at: Date.now(), data });
    } else {
      cacheRef.current.clear();
    }
    return data;
  }, []);

  const login = useCallback(async (rawEmail: string, password: string) => {
    const nextEmail = rawEmail.trim();
    if (!nextEmail || !password) throw new Error("Enter email and password.");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: nextEmail, password }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error((body as { error?: string }).error ?? "Login failed");
    }
    const data = (await res.json()) as { token?: string; email?: string };
    if (!data.token) throw new Error("Login failed");
    localStorage.removeItem(LEGACY_KEY_STORAGE);
    localStorage.setItem(TOKEN_STORAGE, data.token);
    localStorage.setItem(EMAIL_STORAGE, data.email ?? nextEmail);
    cacheRef.current.clear();
    notifyAuthChange();
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE);
    localStorage.removeItem(EMAIL_STORAGE);
    localStorage.removeItem(LEGACY_KEY_STORAGE);
    cacheRef.current.clear();
    notifyAuthChange();
  }, []);

  const value = useMemo(
    () => ({
      email,
      unlocked: token.length > 0,
      login,
      logout,
      adminFetch,
    }),
    [email, token, login, logout, adminFetch],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}
