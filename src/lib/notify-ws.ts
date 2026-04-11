/**
 * Server-side WebSocket relay notifier.
 * Calls POST /notify on the WS relay so connected browsers receive real-time updates.
 * Non-fatal: silently skips when WS relay is unavailable.
 */

const WS_RELAY_URL = process.env.WS_RELAY_URL ?? "http://ws-relay:3001";

export async function notifyTaskUpdate(
  taskId: number,
  event: string,
  data?: unknown,
): Promise<void> {
  try {
    await fetch(`${WS_RELAY_URL}/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "task_update",
        task_id: taskId,
        event,
        data,
      }),
    });
  } catch {
    // WS relay unavailable — not fatal, page refresh still works
  }
}
