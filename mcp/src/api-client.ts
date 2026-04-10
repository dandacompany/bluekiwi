import {
  BlueKiwiAuthError,
  BlueKiwiApiError,
  BlueKiwiNetworkError,
} from "./errors.js";

const RETRY_DELAYS_MS = [100, 500, 2000];

export class BlueKiwiClient {
  constructor(private baseUrl: string, private apiKey: string) {
    if (!baseUrl) throw new Error("BlueKiwiClient: baseUrl is required");
    if (!apiKey) throw new Error("BlueKiwiClient: apiKey is required");
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const url = `${this.baseUrl.replace(/\/$/, "")}${path}`;
    const init: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    };

    let lastError: unknown;
    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const res = await fetch(url, init);
        if (res.status === 401) {
          throw new BlueKiwiAuthError();
        }
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (res.status >= 500 && attempt < RETRY_DELAYS_MS.length) {
            lastError = new BlueKiwiApiError(res.status, text);
            await sleep(RETRY_DELAYS_MS[attempt]);
            continue;
          }
          throw new BlueKiwiApiError(res.status, text);
        }
        const text = await res.text();
        return (text ? JSON.parse(text) : null) as T;
      } catch (err) {
        if (err instanceof BlueKiwiAuthError || err instanceof BlueKiwiApiError) {
          throw err;
        }
        lastError = err;
        if (attempt < RETRY_DELAYS_MS.length) {
          await sleep(RETRY_DELAYS_MS[attempt]);
          continue;
        }
        throw new BlueKiwiNetworkError(
          `Failed to reach ${url} after ${RETRY_DELAYS_MS.length + 1} attempts`,
          err
        );
      }
    }
    throw new BlueKiwiNetworkError("Unreachable", lastError);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
