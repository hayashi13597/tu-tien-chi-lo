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
    effectKind: "linhKhi",
    amount: 25,
    multiplier: null,
    durationSec: null,
    bonusPct: null,
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
