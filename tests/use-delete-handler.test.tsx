// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import React from "react";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}));

import { I18nProvider } from "../src/lib/i18n/context";
import { useDeleteHandler } from "../src/lib/use-delete-handler";

const originalFetch = globalThis.fetch;

function wrapper({ children }: { children: React.ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>;
}

beforeEach(() => {
  toastError.mockClear();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

interface Thing {
  id: number;
  name: string;
}

describe("useDeleteHandler", () => {
  it("success path: runs onSuccess and clears deleteTarget", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: { id: 1, deleted: true } }), {
          status: 200,
        }),
    ) as unknown as typeof fetch;
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useDeleteHandler<Thing>({
          endpoint: (t) => `/api/things/${t.id}`,
          onSuccess,
          fallbackMessage: "failed",
        }),
      { wrapper },
    );

    act(() => result.current.setDeleteTarget({ id: 1, name: "x" }));
    expect(result.current.deleteTarget).toEqual({ id: 1, name: "x" });

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onSuccess).toHaveBeenCalledOnce();
    expect(result.current.deleteTarget).toBeNull();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("failure path: surfaces translated error via toast.error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            error: {
              code: "INSTRUCTION_IN_USE",
              message: "in use",
              details: { count: 3 },
            },
          }),
          { status: 409 },
        ),
    ) as unknown as typeof fetch;
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useDeleteHandler<Thing>({
          endpoint: (t) => `/api/things/${t.id}`,
          onSuccess,
          fallbackMessage: "fallback",
        }),
      { wrapper },
    );

    act(() => result.current.setDeleteTarget({ id: 1, name: "x" }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(onSuccess).not.toHaveBeenCalled();
    expect(result.current.deleteTarget).toBeNull();
    expect(toastError).toHaveBeenCalledOnce();
    const msg = toastError.mock.calls[0][0] as string;
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("non-JSON error body: falls back to fallbackMessage", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response("<html>500</html>", { status: 500 }),
    ) as unknown as typeof fetch;
    const { result } = renderHook(
      () =>
        useDeleteHandler<Thing>({
          endpoint: (t) => `/api/things/${t.id}`,
          onSuccess: vi.fn(),
          fallbackMessage: "fallback msg",
        }),
      { wrapper },
    );

    act(() => result.current.setDeleteTarget({ id: 1, name: "x" }));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(toastError).toHaveBeenCalledWith("fallback msg");
  });

  it("no deleteTarget: handleDelete is a no-op", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useDeleteHandler<Thing>({
          endpoint: (t) => `/api/things/${t.id}`,
          onSuccess,
          fallbackMessage: "failed",
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.handleDelete();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
