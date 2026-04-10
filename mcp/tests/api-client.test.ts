import { describe, it, expect, vi, beforeEach } from "vitest";
import { BlueKiwiClient } from "../src/api-client.js";
import { BlueKiwiAuthError } from "../src/errors.js";

describe("BlueKiwiClient", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it("sends bearer token and returns parsed JSON", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    const client = new BlueKiwiClient("https://api.test", "bk_secret");
    const result = await client.request<{ ok: boolean }>(
      "GET",
      "/api/workflows",
    );
    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/workflows");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer bk_secret",
      "Content-Type": "application/json",
    });
  });

  it("throws BlueKiwiAuthError on 401", async () => {
    fetchMock.mockResolvedValue(new Response("unauthorized", { status: 401 }));
    const client = new BlueKiwiClient("https://api.test", "bad");
    await expect(
      client.request("GET", "/api/workflows"),
    ).rejects.toBeInstanceOf(BlueKiwiAuthError);
  });

  it("throws BlueKiwiApiError with status on 5xx", async () => {
    fetchMock.mockResolvedValue(new Response("boom", { status: 500 }));
    const client = new BlueKiwiClient("https://api.test", "bk");
    await expect(client.request("GET", "/api/workflows")).rejects.toMatchObject(
      {
        name: "BlueKiwiApiError",
        status: 500,
      },
    );
  });
});
