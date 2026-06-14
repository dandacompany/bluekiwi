/**
 * Server-side WebSocket relay notifier.
 * Calls POST /notify on the WS relay so connected browsers receive real-time updates.
 * Non-fatal: silently skips when WS relay is unavailable.
 *
 * Includes the task owner's user_id so the relay can scope delivery to that user
 * (and admins) instead of broadcasting to every connected browser, and
 * authenticates to the relay with the shared WS_RELAY_SECRET.
 */

import { queryOne } from "@/lib/db";

const WS_RELAY_URL = process.env.WS_RELAY_URL ?? "http://ws-relay:3001";
const WS_RELAY_SECRET = process.env.WS_RELAY_SECRET ?? "";

export async function notifyTaskUpdate(
  taskId: number,
  event: string,
  data?: unknown,
): Promise<void> {
  try {
    // Resolve the task owner so the relay can scope delivery. On any lookup
    // failure we fall back to null (untargeted) rather than dropping the event.
    let ownerUserId: number | null = null;
    try {
      const row = await queryOne<{ user_id: number | null }>(
        "SELECT user_id FROM tasks WHERE id = $1",
        [taskId],
      );
      ownerUserId = row?.user_id ?? null;
    } catch {
      // keep ownerUserId = null
    }

    await fetch(`${WS_RELAY_URL}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(WS_RELAY_SECRET ? { "x-relay-secret": WS_RELAY_SECRET } : {}),
      },
      body: JSON.stringify({
        type: "task_update",
        task_id: taskId,
        user_id: ownerUserId,
        event,
        data,
      }),
    });
  } catch {
    // WS relay unavailable — not fatal, page refresh still works
  }
}
