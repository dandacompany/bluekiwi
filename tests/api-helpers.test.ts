import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/db", async () => {
  const actual =
    await vi.importActual<typeof import("../src/lib/db")>("../src/lib/db");
  return {
    ...actual,
    queryOne: vi.fn(),
  };
});

import { queryOne } from "../src/lib/db";
import { loadResourceOrFail } from "../src/lib/api-helpers";
import type { User } from "../src/lib/auth";

const mockUser = {
  id: 1,
  email: "u@example.com",
  name: "u",
  role: "member",
} as unknown as User;

interface Row {
  id: number;
  owner_id: number;
}

describe("loadResourceOrFail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 NOT_FOUND when queryOne yields no row", async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(undefined);
    const result = await loadResourceOrFail<Row>({
      table: "things",
      id: 42,
      user: mockUser,
      check: async () => true,
      notFoundMessage: "not found",
      forbiddenMessage: "forbidden",
    });
    expect(result.resource).toBeNull();
    expect(result.response).not.toBeNull();
    expect(result.response?.status).toBe(404);
    const body = await result.response!.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(body.error.message).toBe("not found");
  });

  it("returns 403 OWNERSHIP_REQUIRED when check rejects the user", async () => {
    vi.mocked(queryOne).mockResolvedValueOnce({ id: 1, owner_id: 2 });
    const result = await loadResourceOrFail<Row>({
      table: "things",
      id: 1,
      user: mockUser,
      check: async () => false,
      notFoundMessage: "not found",
      forbiddenMessage: "no permission",
    });
    expect(result.resource).toBeNull();
    expect(result.response?.status).toBe(403);
    const body = await result.response!.json();
    expect(body.error.code).toBe("OWNERSHIP_REQUIRED");
    expect(body.error.message).toBe("no permission");
  });

  it("returns the resource when check passes", async () => {
    const row: Row = { id: 7, owner_id: 1 };
    vi.mocked(queryOne).mockResolvedValueOnce(row);
    const result = await loadResourceOrFail<Row>({
      table: "things",
      id: 7,
      user: mockUser,
      check: async () => true,
      notFoundMessage: "not found",
      forbiddenMessage: "forbidden",
    });
    expect(result.resource).toEqual(row);
    expect(result.response).toBeNull();
  });

  it("honors custom notFoundCode and forbiddenCode", async () => {
    vi.mocked(queryOne).mockResolvedValueOnce(undefined);
    const notFound = await loadResourceOrFail<Row>({
      table: "things",
      id: 1,
      user: mockUser,
      check: async () => true,
      notFoundCode: "THING_MISSING",
      notFoundMessage: "nope",
      forbiddenMessage: "forbidden",
    });
    const nfBody = await notFound.response!.json();
    expect(nfBody.error.code).toBe("THING_MISSING");

    vi.mocked(queryOne).mockResolvedValueOnce({ id: 1, owner_id: 2 });
    const forbidden = await loadResourceOrFail<Row>({
      table: "things",
      id: 1,
      user: mockUser,
      check: async () => false,
      forbiddenCode: "THING_FORBIDDEN",
      notFoundMessage: "nope",
      forbiddenMessage: "no",
    });
    const fBody = await forbidden.response!.json();
    expect(fBody.error.code).toBe("THING_FORBIDDEN");
  });
});
