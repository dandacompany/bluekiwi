import { describe, it, expect } from "vitest";
import {
  generateInviteToken,
  buildInviteUrl,
  isExpired,
} from "../src/lib/invites";

describe("invites", () => {
  it("generates 43-character base64url token", () => {
    const token = generateInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("generates unique tokens", () => {
    const a = generateInviteToken();
    const b = generateInviteToken();
    expect(a).not.toBe(b);
  });

  it("builds invite url with token", () => {
    expect(buildInviteUrl("https://team.example.com", "abc")).toBe(
      "https://team.example.com/invite/abc",
    );
  });

  it("detects expired timestamps", () => {
    const past = new Date(Date.now() - 1000);
    const future = new Date(Date.now() + 60_000);
    expect(isExpired(past)).toBe(true);
    expect(isExpired(future)).toBe(false);
  });
});
