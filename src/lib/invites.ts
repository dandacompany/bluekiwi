import { randomBytes } from "crypto";

export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): string {
  return randomBytes(32).toString("base64url");
}

export function buildInviteUrl(publicUrl: string, token: string): string {
  return `${publicUrl.replace(/\/$/, "")}/invite/${token}`;
}

export function inviteExpiresAt(ttlMs = DEFAULT_INVITE_TTL_MS): Date {
  return new Date(Date.now() + ttlMs);
}

export function isExpired(at: Date): boolean {
  return at.getTime() <= Date.now();
}
