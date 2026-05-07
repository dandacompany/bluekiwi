import { describe, expect, it } from "vitest";
import { decodeNumericId } from "../src/lib/db/value-codecs";

describe("value codecs", () => {
  it("decodes safe numeric ids from postgres and sqlite values", () => {
    expect(decodeNumericId(42)).toBe(42);
    expect(decodeNumericId("42")).toBe(42);
  });

  it("rejects unsafe or non-integer ids", () => {
    expect(decodeNumericId("12.5")).toBeUndefined();
    expect(decodeNumericId("-1")).toBeUndefined();
    expect(decodeNumericId("9007199254740992")).toBeUndefined();
    expect(decodeNumericId(null)).toBeUndefined();
  });
});
