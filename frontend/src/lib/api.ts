import type {
  AdminPillDTO,
  AdminRedeemCodeDTO,
  AdminStats,
  AdminUserDTO,
  AlchemyProfileDTO,
  AlchemyProfileRecordDTO,
  AlchemyQueueDTO,
  AlchemyRecipeDTO,
  ApiError,
  CongPhapDTO,
  CongPhapListResult,
  CultivationState,
  CurrentExpeditionDTO,
  ExpeditionBranchDTO,
  ExpeditionClaimDTO,
  ExpeditionDTO,
  LearnCongPhapResult,
  LevelUpResult,
  MaterialDTO,
  MaterialInventoryDTO,
  Me,
  PillInventoryItem,
  RealmConfigDTO,
  RedeemResult,
  StartExpeditionInput,
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

// GET /materials/inventory — the player's active material balances.
export function fetchMaterials(): Promise<MaterialInventoryDTO[]> {
  return apiFetch<MaterialInventoryDTO[]>("/materials/inventory");
}

// GET /alchemy/recipes — active recipes available to the player.
export function fetchAlchemyRecipes(): Promise<AlchemyRecipeDTO[]> {
  return apiFetch<AlchemyRecipeDTO[]>("/alchemy/recipes");
}

// GET /alchemy/queue — settles completed jobs before returning the queue.
export function fetchAlchemyQueue(): Promise<AlchemyQueueDTO> {
  return apiFetch<AlchemyQueueDTO>("/alchemy/queue");
}

// POST /alchemy/queue — spends the requested recipe inputs server-side.
export function queueAlchemy(
  recipeId: string,
  quantity: number,
): Promise<AlchemyQueueDTO> {
  return apiFetch<AlchemyQueueDTO>("/alchemy/queue", {
    method: "POST",
    body: JSON.stringify({ recipeId, quantity }),
  });
}

// GET /alchemy/profile — hồ sơ Đan Sư (server lazy-create khi chưa có).
export function fetchAlchemyProfile(): Promise<AlchemyProfileDTO> {
  return apiFetch<AlchemyProfileDTO>("/alchemy/profile");
}

// POST /alchemy/rank-up — thăng cấp Đan Sư khi đủ Đan Khí + cảnh giới.
export function rankUpAlchemy(): Promise<AlchemyProfileRecordDTO> {
  return apiFetch<AlchemyProfileRecordDTO>("/alchemy/rank-up", {
    method: "POST",
  });
}

// POST /alchemy/furnace/upgrade — nâng Đan Lô bằng Đan Khí + Linh Thạch.
export function upgradeAlchemyFurnace(): Promise<AlchemyProfileRecordDTO> {
  return apiFetch<AlchemyProfileRecordDTO>("/alchemy/furnace/upgrade", {
    method: "POST",
  });
}

// GET /expeditions/branches — active branch and difficulty configuration.
export function fetchExpeditionBranches(): Promise<ExpeditionBranchDTO[]> {
  return apiFetch<ExpeditionBranchDTO[]>("/expeditions/branches");
}

// GET /expeditions/current — quota and the single active/completed expedition.
export function fetchCurrentExpedition(): Promise<CurrentExpeditionDTO> {
  return apiFetch<CurrentExpeditionDTO>("/expeditions/current");
}

// POST /expeditions/start — creates a server-snapshotted expedition.
export function startExpedition(
  input: StartExpeditionInput,
): Promise<ExpeditionDTO> {
  return apiFetch<ExpeditionDTO>("/expeditions/start", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// POST /expeditions/claim — atomically grants the stored reward.
export function claimExpedition(): Promise<ExpeditionClaimDTO> {
  return apiFetch<ExpeditionClaimDTO>("/expeditions/claim", {
    method: "POST",
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

// GET /admin/materials — full material catalog, inactive rows included.
export function fetchAdminMaterials(): Promise<{ materials: MaterialDTO[] }> {
  return apiFetch<{ materials: MaterialDTO[] }>("/admin/materials");
}

// PUT /admin/materials — full catalog upsert; referenced rows are not deleted.
export function updateAdminMaterials(
  materials: MaterialDTO[],
): Promise<{ materials: MaterialDTO[] }> {
  return apiFetch<{ materials: MaterialDTO[] }>("/admin/materials", {
    method: "PUT",
    body: JSON.stringify({ materials }),
  });
}

// GET /admin/alchemy/recipes — full recipe catalog, inactive rows included.
export function fetchAdminAlchemyRecipes(): Promise<{
  recipes: AlchemyRecipeDTO[];
}> {
  return apiFetch<{ recipes: AlchemyRecipeDTO[] }>("/admin/alchemy/recipes");
}

// PUT /admin/alchemy/recipes — full recipe catalog upsert.
export function updateAdminAlchemyRecipes(
  recipes: AlchemyRecipeDTO[],
): Promise<{ recipes: AlchemyRecipeDTO[] }> {
  return apiFetch<{ recipes: AlchemyRecipeDTO[] }>("/admin/alchemy/recipes", {
    method: "PUT",
    body: JSON.stringify({ recipes }),
  });
}

// GET /admin/expeditions — full branch/difficulty catalog.
export function fetchAdminExpeditions(): Promise<{
  branches: ExpeditionBranchDTO[];
}> {
  return apiFetch<{ branches: ExpeditionBranchDTO[] }>("/admin/expeditions");
}

// PUT /admin/expeditions — full branch/difficulty catalog upsert.
export function updateAdminExpeditions(
  branches: ExpeditionBranchDTO[],
): Promise<{ branches: ExpeditionBranchDTO[] }> {
  return apiFetch<{ branches: ExpeditionBranchDTO[] }>("/admin/expeditions", {
    method: "PUT",
    body: JSON.stringify({ branches }),
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

// GET /congphap — owned công pháp (with definitions) + the active catalog.
export function fetchCongPhap(): Promise<CongPhapListResult> {
  return apiFetch<CongPhapListResult>("/congphap");
}

// POST /congphap/equip — put an active công pháp in slot 0..3 (replaces any
// công pháp already in that slot, server-side).
export function equipCongPhap(
  congPhapId: string,
  slot: number,
): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/congphap/equip", {
    method: "POST",
    body: JSON.stringify({ congPhapId, slot }),
  });
}

// POST /congphap/unequip — clear this công pháp's slot.
export function unequipCongPhap(congPhapId: string): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/congphap/unequip", {
    method: "POST",
    body: JSON.stringify({ congPhapId }),
  });
}

// POST /congphap/levelup — spend Linh Thạch for +1 level; returns both new values.
export function levelUpCongPhap(congPhapId: string): Promise<LevelUpResult> {
  return apiFetch<LevelUpResult>("/congphap/levelup", {
    method: "POST",
    body: JSON.stringify({ congPhapId }),
  });
}

// POST /congphap/:id/learn — học môn bằng 1 Bí Tịch + 300 Linh Thạch (Phase 2).
export function learnCongPhap(
  congPhapId: string,
): Promise<LearnCongPhapResult> {
  return apiFetch<LearnCongPhapResult>(`/congphap/${congPhapId}/learn`, {
    method: "POST",
  });
}

// GET /admin/congphap — full catalog, inactive included.
export function fetchAdminCongPhap(): Promise<{ congphap: CongPhapDTO[] }> {
  return apiFetch<{ congphap: CongPhapDTO[] }>("/admin/congphap");
}

// POST /admin/congphap — create (id chosen once here, immutable after).
export function createAdminCongPhap(def: CongPhapDTO): Promise<CongPhapDTO> {
  return apiFetch<CongPhapDTO>("/admin/congphap", {
    method: "POST",
    body: JSON.stringify(def),
  });
}

// PUT /admin/congphap/:id — full-row update; the id travels in the URL only.
export function updateAdminCongPhap(
  id: string,
  body: Omit<CongPhapDTO, "id">,
): Promise<CongPhapDTO> {
  return apiFetch<CongPhapDTO>(`/admin/congphap/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// POST /admin/grant — give a player a công pháp and/or Linh Thạch.
export function grantToUser(body: {
  userId: string;
  congPhapId?: string;
  linhThach?: number;
}): Promise<{ ok: true }> {
  return apiFetch<{ ok: true }>("/admin/grant", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// GET /admin/users — search players by username for the grant picker.
export function searchAdminUsers(
  q: string,
): Promise<{ users: AdminUserDTO[] }> {
  return apiFetch<{ users: AdminUserDTO[] }>(
    `/admin/users?q=${encodeURIComponent(q)}`,
  );
}

export { API_BASE };
