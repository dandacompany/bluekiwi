/**
 * WebSocket relay authentication & delivery-scoping helpers.
 *
 * Shared between the Next.js server and the standalone ws-relay process
 * (esbuild bundles this module into scripts/ws-relay.js). Must NOT import the
 * DB layer — only the session verifier (jose) — so it stays bundle-safe.
 */

import { verifySession } from "./session";

export interface WsIdentity {
  userId: number;
  role: string;
}

export interface TaskUpdateMessage {
  type?: string;
  task_id?: number;
  /** Owner of the task this update concerns. null/undefined → untargeted. */
  user_id?: number | null;
  event?: string;
  data?: unknown;
}

/** Extract a single cookie value from a raw Cookie header. Pure. */
export function parseCookie(
  header: string | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

/**
 * Verify the `session` cookie from a Cookie header and return the caller's
 * identity, or null when absent/invalid. Used to authenticate WS upgrades.
 */
export async function identifyFromCookieHeader(
  header: string | undefined,
): Promise<WsIdentity | null> {
  const token = parseCookie(header, "session");
  if (!token) return null;
  const session = await verifySession(token);
  if (!session) return null;
  return { userId: session.userId, role: String(session.role) };
}

/**
 * Decide whether a connected client may receive a given task update.
 * - Untargeted messages (no user_id) go to everyone (backward compatible).
 * - admins/superusers receive everything (they can read all tasks).
 * - Otherwise, only the task owner receives it.
 * Pure.
 */
export function canReceive(
  identity: WsIdentity,
  message: TaskUpdateMessage,
): boolean {
  if (message.user_id == null) return true;
  if (identity.role === "admin" || identity.role === "superuser") return true;
  return identity.userId === message.user_id;
}
