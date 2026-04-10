// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

import { useListFetch } from "../src/lib/use-list-fetch";

const originalFetch = globalThis.fetch;

beforeEach(() => {
  vi.useRealTimers();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(responses: Array<{ data: unknown[] }>) {
  const calls: string[] = [];
  let i = 0;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    calls.push(typeof input === "string" ? input : input.toString());
    const body = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return calls;
}

describe("useListFetch", () => {
  it("fetches data on mount and exposes loading state", async () => {
    const calls = mockFetch([{ data: [{ id: 1 }, { id: 2 }] }]);
    const { result } = renderHook(() =>
      useListFetch<{ id: number }>("/api/things", []),
    );
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(calls).toEqual(["/api/things"]);
  });

  it("refetches when deps change", async () => {
    const calls = mockFetch([{ data: [{ id: 1 }] }, { data: [{ id: 2 }] }]);
    let dep = "a";
    const { result, rerender } = renderHook(
      ({ d }: { d: string }) =>
        useListFetch<{ id: number }>(() => `/api/things?q=${d}`, [d]),
      { initialProps: { d: dep } },
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 1 }]);

    dep = "b";
    rerender({ d: dep });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([{ id: 2 }]);
    expect(calls).toEqual(["/api/things?q=a", "/api/things?q=b"]);
  });

  it("refetch() re-runs the fetch manually", async () => {
    const calls = mockFetch([{ data: [{ id: 1 }] }, { data: [{ id: 9 }] }]);
    const { result } = renderHook(() =>
      useListFetch<{ id: number }>("/api/things", []),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.refetch();
    });
    expect(result.current.data).toEqual([{ id: 9 }]);
    expect(calls).toEqual(["/api/things", "/api/things"]);
  });

  it("empty json.data becomes empty array", async () => {
    mockFetch([{ data: [] }]);
    const { result } = renderHook(() =>
      useListFetch<{ id: number }>("/api/things", []),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual([]);
  });
});
