import type {
  AdminPillDTO,
  AdminRedeemCodeDTO,
  AdminStats,
  ApiError,
  CultivationState,
  Me,
  PillInventoryItem,
  RealmConfigDTO,
  RedeemResult,
} from "./types";

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

// GET /pills/inventory — the player's owned pills with quantities.
export function fetchInventory(): Promise<PillInventoryItem[]> {
  return apiFetch<PillInventoryItem[]>("/pills/inventory");
}

// POST /pills/consume — consume one pill; returns the fresh cultivation state.
export function consumePill(pillId: string): Promise<CultivationState> {
  return apiFetch<CultivationState>("/pills/consume", {
    method: "POST",
    body: JSON.stringify({ pillId }),
  });
}

// GET /auth/me — who is logged in (id, username, role from the access token).
export function fetchMe(): Promise<Me> {
  return apiFetch<Me>("/auth/me");
}

// GET /admin/stats — aggregate counts for the admin overview page.
export function fetchAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/admin/stats");
}

// GET /admin/realms — the full live realm config.
export function fetchAdminRealms(): Promise<{ realms: RealmConfigDTO[] }> {
  return apiFetch<{ realms: RealmConfigDTO[] }>("/admin/realms");
}

// PUT /admin/realms — full replace; the backend validates and live-reloads.
export function updateAdminRealms(
  realms: RealmConfigDTO[],
): Promise<{ realms: RealmConfigDTO[] }> {
  return apiFetch<{ realms: RealmConfigDTO[] }>("/admin/realms", {
    method: "PUT",
    body: JSON.stringify({ realms }),
  });
}

// GET /admin/pills — the full catalog, inactive pills included.
export function fetchAdminPills(): Promise<{ pills: AdminPillDTO[] }> {
  return apiFetch<{ pills: AdminPillDTO[] }>("/admin/pills");
}

// POST /admin/pills — create a pill (id chosen once here, immutable after).
export function createAdminPill(pill: AdminPillDTO): Promise<AdminPillDTO> {
  return apiFetch<AdminPillDTO>("/admin/pills", {
    method: "POST",
    body: JSON.stringify(pill),
  });
}

// PUT /admin/pills/:id — full-row update; the id travels in the URL only.
export function updateAdminPill(
  id: string,
  body: Omit<AdminPillDTO, "id">,
): Promise<AdminPillDTO> {
  return apiFetch<AdminPillDTO>(`/admin/pills/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// POST /redeem — player exchanges a code for pills.
export function redeemCode(code: string): Promise<RedeemResult> {
  return apiFetch<RedeemResult>("/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

// GET /admin/codes — full catalog including inactive.
export function fetchAdminCodes(): Promise<{ codes: AdminRedeemCodeDTO[] }> {
  return apiFetch<{ codes: AdminRedeemCodeDTO[] }>("/admin/codes");
}

// POST /admin/codes — create a new code.
export function createAdminCode(
  body: Omit<AdminRedeemCodeDTO, "redeemedCount">,
): Promise<AdminRedeemCodeDTO> {
  return apiFetch<AdminRedeemCodeDTO>("/admin/codes", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// PUT /admin/codes/:id — full-row update; id and code travel in URL/existing record only.
export function updateAdminCode(
  id: string,
  body: Omit<AdminRedeemCodeDTO, "id" | "code" | "redeemedCount">,
): Promise<AdminRedeemCodeDTO> {
  return apiFetch<AdminRedeemCodeDTO>(`/admin/codes/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export { API_BASE };
