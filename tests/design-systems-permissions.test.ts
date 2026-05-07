import { describe, expect, it } from "vitest";
import { checkPermission } from "../src/lib/auth";

describe("design-system permissions", () => {
  it("allows viewers to read and editors to mutate design systems", () => {
    expect(checkPermission("viewer", "design_systems:read")).toBe(true);
    expect(checkPermission("viewer", "design_systems:create")).toBe(false);
    expect(checkPermission("viewer", "design_systems:update")).toBe(false);

    expect(checkPermission("editor", "design_systems:read")).toBe(true);
    expect(checkPermission("editor", "design_systems:create")).toBe(true);
    expect(checkPermission("editor", "design_systems:update")).toBe(true);
  });
});
