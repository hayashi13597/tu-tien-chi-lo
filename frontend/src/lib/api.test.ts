import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";
import type { AdminPillDTO } from "./types";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("apiFetch", () => {
  it("returns JSON on a 200", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { linhKhi: 5 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiFetch<{ linhKhi: number }>("/cultivation/state");

    expect(data).toEqual({ linhKhi: 5 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    expect(init?.credentials).toBe("include");
  });

  it("refreshes once on 401 then replays the original request", async () => {
    const fetchMock = vi
      .fn()
      // first call: original request 401s
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "X", message: "no" } }),
      )
      // second call: refresh succeeds
      .mockResolvedValueOnce(jsonResponse(200, {}))
      // third call: replayed original succeeds
      .mockResolvedValueOnce(jsonResponse(200, { linhKhi: 9 }));
    vi.stubGlobal("fetch", fetchMock);

    const data = await apiFetch<{ linhKhi: number }>("/cultivation/state");

    expect(data).toEqual({ linhKhi: 9 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/refresh");
  });

  it("throws Authentication expired when refresh fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "X", message: "no" } }),
      )
      .mockResolvedValueOnce(
        jsonResponse(401, { error: { code: "X", message: "no" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/cultivation/state")).rejects.toThrow(
      "Authentication expired",
    );
  });

  it("does not attempt a refresh for a 401 on /auth/refresh itself", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(401, { error: { code: "X", message: "bad" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiFetch("/auth/refresh", { method: "POST" })).rejects.toThrow(
      "bad",
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("maps a non-401 error to its message", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, {
        error: { code: "BAD", message: "Linh khí chưa đủ" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      apiFetch("/cultivation/breakthrough", { method: "POST" }),
    ).rejects.toThrow("Linh khí chưa đủ");
  });
});

describe("pill api", () => {
  it("fetchInventory returns the parsed array", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, [{ id: "hoi-khi-dan", quantity: 5 }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchInventory } = await import("./api");
    const inv = await fetchInventory();
    expect(inv).toEqual([{ id: "hoi-khi-dan", quantity: 5 }]);
    expect(fetchMock.mock.calls[0][0]).toContain("/pills/inventory");
  });

  it("consumePill posts the pillId and returns fresh state", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { linhKhi: 42 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { consumePill } = await import("./api");
    const state = await consumePill("hoi-khi-dan");
    expect(state).toEqual({ linhKhi: 42 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/pills/consume");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ pillId: "hoi-khi-dan" });
  });

  it("consumePill surfaces the server error message", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(409, {
          error: { code: "PILL_OUT_OF_STOCK", message: "Hết hàng" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { consumePill } = await import("./api");
    await expect(consumePill("x")).rejects.toThrow("Hết hàng");
  });
});

describe("materials and alchemy api", () => {
  it("fetchMaterials GETs the player's material inventory", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, [{ materialId: "xich-viem-tinh", quantity: 3 }]),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchMaterials } = await import("./api");

    await expect(fetchMaterials()).resolves.toEqual([
      { materialId: "xich-viem-tinh", quantity: 3 },
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/materials/inventory",
    );
  });

  it("queueAlchemy POSTs recipe and quantity", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { jobs: [], outputGrants: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { queueAlchemy } = await import("./api");

    await queueAlchemy("hoi-khi-dan", 2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/alchemy/queue");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      recipeId: "hoi-khi-dan",
      quantity: 2,
    });
  });

  it("fetches alchemy profile and posts rank-up/furnace", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, {
          profile: { rank: 1, danKhi: 0, furnaceLevel: 1 },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAlchemyProfile, rankUpAlchemy, upgradeAlchemyFurnace } =
      await import("./api");

    await fetchAlchemyProfile();
    await rankUpAlchemy();
    await upgradeAlchemyFurnace();

    expect(String(fetchMock.mock.calls[0][0])).toContain("/alchemy/profile");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/alchemy/rank-up");
    expect(fetchMock.mock.calls[1][1]?.method).toBe("POST");
    expect(String(fetchMock.mock.calls[2][0])).toContain(
      "/alchemy/furnace/upgrade",
    );
    expect(fetchMock.mock.calls[2][1]?.method).toBe("POST");
  });
});

describe("expedition api", () => {
  it("startExpedition POSTs the selected branch, difficulty and duration", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { id: "exp-1", status: "running" }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { startExpedition } = await import("./api");

    await startExpedition({
      branchId: "hoa-vuc",
      difficulty: "hard",
      durationSec: 28800,
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/expeditions/start");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      branchId: "hoa-vuc",
      difficulty: "hard",
      durationSec: 28800,
    });
  });

  it("claimExpedition POSTs to the claim endpoint", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { expedition: null, reward: { multiplier: 1 } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { claimExpedition } = await import("./api");

    await claimExpedition();
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/expeditions/claim");
    expect(init?.method).toBe("POST");
  });
});

describe("admin api", () => {
  it("fetchMe GETs /auth/me", async () => {
    const me = { id: "u1", username: "alice", role: "admin" };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, me),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchMe } = await import("./api");

    const data = await fetchMe();

    expect(data).toEqual(me);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/auth/me");
  });

  it("updateAdminRealms PUTs the realms wrapped in { realms }", async () => {
    const realms = [
      {
        name: "Phàm Nhân",
        subStages: [
          {
            name: "Sơ Kỳ",
            linhKhiRequired: 100,
            cultivationRate: 1,
            baseSuccessRate: 90,
            pityIncrement: 10,
            maxSuccessRate: 95,
            punishmentSeconds: 300,
            baseKhiHuyet: 40,
            baseChanNguyen: 30,
            baseCongVatLy: 6,
            baseCongPhep: 6,
            basePhongThu: 4,
            baseTocDo: 2,
          },
        ],
      },
    ];
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { realms }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { updateAdminRealms } = await import("./api");

    const data = await updateAdminRealms(realms);

    expect(data).toEqual({ realms });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/realms");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ realms });
  });

  it("admin fetches surface the server error message on failure", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(400, {
          error: {
            code: "INVALID_REALM_CONFIG",
            message: "linhKhiRequired must strictly increase",
          },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { updateAdminRealms } = await import("./api");

    await expect(updateAdminRealms([])).rejects.toThrow(
      "linhKhiRequired must strictly increase",
    );
  });
});

describe("admin pill api", () => {
  const samplePill: AdminPillDTO = {
    id: "test-dan",
    name: "Test Đan",
    glyph: "试",
    rarity: 1,
    tier: 1,
    effectKind: "linhKhi",
    amount: 25,
    multiplier: null,
    durationSec: null,
    bonusPct: null,
    combatAttribute: null,
    combatTrigger: null,
    desc: "d",
    active: true,
    starterQuantity: 0,
  };

  it("fetchAdminPills GETs /admin/pills", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { pills: [samplePill] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAdminPills } = await import("./api");
    const data = await fetchAdminPills();
    expect(data.pills[0].id).toBe("test-dan");
    expect(String(fetchMock.mock.calls[0][0])).toContain("/admin/pills");
  });

  it("createAdminPill POSTs the full pill including id", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, samplePill),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createAdminPill } = await import("./api");
    await createAdminPill(samplePill);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/pills");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string).id).toBe("test-dan");
  });

  it("updateAdminPill PUTs to /admin/pills/:id without id in the body", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, samplePill),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { updateAdminPill } = await import("./api");
    const { id, ...body } = samplePill;
    await updateAdminPill(id, body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/pills/test-dan");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string).id).toBeUndefined();
  });
});

describe("admin catalog api", () => {
  const material = {
    id: "xich-viem-tinh",
    name: "Xích Viêm Tinh",
    glyph: "炎",
    rarity: 1,
    tier: 1,
    description: "d",
    active: true,
  };
  const recipe = {
    id: "hoi-khi-dan",
    pillId: "hoi-khi-dan",
    durationSec: 1800,
    linhThachCost: 10,
    active: true,
    ingredients: [{ materialId: material.id, quantity: 2 }],
    tier: 1,
    minAlchemyRank: 1,
    baseSuccessPct: 100,
  };
  const branch = {
    branch: {
      id: "hoa-vuc",
      name: "Hỏa Vực",
      glyph: "火",
      description: "d",
      basePower: 100,
      alchemyMaterialId: material.id,
      upgradeMaterialWeights: [{ materialId: material.id, weight: 1 }],
      tier: 1,
      minRealmMajor: 0,
      recommendedPower: 0,
      bossDropWeights: [],
    },
    difficulties: [
      {
        key: "easy" as const,
        enemyMultiplier: 0.8,
        normalDropRate: 0.5,
        bossDropRate: 0.8,
        rewardMultiplier: 0.25,
        adaptiveCoefficient: 0.5,
      },
      {
        key: "normal" as const,
        enemyMultiplier: 1,
        normalDropRate: 0.4,
        bossDropRate: 0.7,
        rewardMultiplier: 0.5,
        adaptiveCoefficient: 0.75,
      },
      {
        key: "hard" as const,
        enemyMultiplier: 1.5,
        normalDropRate: 0.3,
        bossDropRate: 0.6,
        rewardMultiplier: 1,
        adaptiveCoefficient: 1,
      },
    ],
  };

  it("fetches and replaces the admin material catalog", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { materials: [material] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAdminMaterials, updateAdminMaterials } = await import("./api");

    await expect(fetchAdminMaterials()).resolves.toEqual({
      materials: [material],
    });
    await updateAdminMaterials([material]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/admin/materials");
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/admin/materials");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ materials: [material] });
  });

  it("fetches and replaces the admin alchemy recipe catalog", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { recipes: [recipe] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAdminAlchemyRecipes, updateAdminAlchemyRecipes } =
      await import("./api");

    await expect(fetchAdminAlchemyRecipes()).resolves.toEqual({
      recipes: [recipe],
    });
    await updateAdminAlchemyRecipes([recipe]);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/admin/alchemy/recipes",
    );
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/admin/alchemy/recipes");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ recipes: [recipe] });
  });

  it("fetches and replaces the admin expedition catalog", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { branches: [branch] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAdminExpeditions, updateAdminExpeditions } = await import(
      "./api"
    );

    await expect(fetchAdminExpeditions()).resolves.toEqual({
      branches: [branch],
    });
    await updateAdminExpeditions([branch]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/admin/expeditions");
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toContain("/admin/expeditions");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string)).toEqual({ branches: [branch] });
  });
});

describe("redeem api", () => {
  it("redeemCode POSTs the code and returns rewards", async () => {
    const result = {
      rewards: [
        { kind: "pill", id: "p1", name: "Pill", glyph: "x", quantity: 3 },
      ],
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, result),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { redeemCode } = await import("./api");
    const data = await redeemCode("TEST2026");
    expect(data.rewards[0].kind).toBe("pill");
    expect(data.rewards[0].id).toBe("p1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/redeem");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({ code: "TEST2026" });
  });

  it("fetchAdminCodes GETs /admin/codes", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { codes: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAdminCodes } = await import("./api");
    const data = await fetchAdminCodes();
    expect(data.codes).toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/admin/codes");
  });

  it("updateAdminCode PUTs to /admin/codes/:id without id/code/redeemedCount in body", async () => {
    const body = {
      active: true,
      maxRedemptions: 5,
      expiresAt: null,
      rewards: [],
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { id: "c1", code: "X", redeemedCount: 0, ...body }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { updateAdminCode } = await import("./api");
    await updateAdminCode("c1", body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/codes/c1");
    expect(init?.method).toBe("PUT");
    const parsed = JSON.parse(init?.body as string);
    expect(parsed.id).toBeUndefined();
    expect(parsed.code).toBeUndefined();
    expect(parsed.redeemedCount).toBeUndefined();
  });
});

describe("congphap api", () => {
  it("fetchCongPhap GETs /congphap", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { owned: [], catalog: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCongPhap } = await import("./api");
    const data = await fetchCongPhap();
    expect(data.owned).toEqual([]);
    expect(String(fetchMock.mock.calls[0][0])).toContain("/congphap");
  });

  it("equipCongPhap POSTs the id and slot", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { equipCongPhap } = await import("./api");
    await equipCongPhap("liet-hoa-tam", 2);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/congphap/equip");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toEqual({
      congPhapId: "liet-hoa-tam",
      slot: 2,
    });
  });

  it("levelUpCongPhap returns the new level and Linh Thạch", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, {
          level: 3,
          linhThach: 40,
          material: { id: "xich-viem-tinh", quantity: 2 },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { levelUpCongPhap } = await import("./api");
    const res = await levelUpCongPhap("thiet-cot-quyet");
    expect(res).toEqual({
      level: 3,
      linhThach: 40,
      material: { id: "xich-viem-tinh", quantity: 2 },
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/congphap/levelup");
  });

  it("updateAdminCongPhap keeps the id in the URL only", async () => {
    const def = {
      id: "cp1",
      name: "N",
      glyph: "g",
      rarity: 1,
      category: "passive" as const,
      desc: "d",
      active: true,
      maxLevel: 5,
      baseCost: 100,
      costGrowth: 1.5,
      upgradeMaterialId: null,
      baseMaterialCost: 0,
      materialCostGrowth: 1,
      effects: [
        { attribute: "tocDo" as const, flatPerLevel: 1, pctPerLevel: 0 },
      ],
      powerPerLevel: null,
      chanNguyenCost: null,
      dupRefundLinhThach: null,
      tier: 1,
      branch: "chienDao" as const,
      minRealmMajor: 0,
      biTichMaterialId: null,
    };
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, def),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { updateAdminCongPhap } = await import("./api");
    const { id, ...body } = def;
    await updateAdminCongPhap(id, body);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/congphap/cp1");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(init?.body as string).id).toBeUndefined();
  });

  it("searchAdminUsers encodes the query", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { users: [] }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { searchAdminUsers } = await import("./api");
    await searchAdminUsers("a b&c");
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      "/admin/users?q=a%20b%26c",
    );
  });

  it("grantToUser POSTs the grant body", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(200, { ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { grantToUser } = await import("./api");
    await grantToUser({ userId: "u1", linhThach: 500 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/admin/grant");
    expect(JSON.parse(init?.body as string)).toEqual({
      userId: "u1",
      linhThach: 500,
    });
  });
});
