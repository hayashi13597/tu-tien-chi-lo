import type { ApiError } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:5000";

// Module-level guard: if several in-flight calls 401 at once, only the first
// triggers a token refresh — the rest fall through and rely on that refresh.
let isRefreshing = false;

async function refreshAccessToken(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  // A 401 on a normal request means the access cookie expired: silently refresh
  // (once) and replay. Skip this for the refresh endpoint itself to avoid recursion.
  if (res.status === 401 && !path.includes("/auth/refresh") && !isRefreshing) {
    isRefreshing = true;
    const refreshed = await refreshAccessToken();
    isRefreshing = false;
    if (refreshed) {
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
      if (!retryRes.ok) {
        const err = (await retryRes
          .json()
          .catch(() => null)) as ApiError | null;
        throw new Error(err?.error?.message ?? "Request failed");
      }
      return retryRes.json() as Promise<T>;
    }
    throw new Error("Authentication expired");
  }

  if (!res.ok) {
    const err = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export { API_BASE };
