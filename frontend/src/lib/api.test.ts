import { afterEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./api";

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
    const fetchMock = vi.fn(async () => jsonResponse(200, { linhKhi: 5 }));
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
