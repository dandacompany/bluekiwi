// Dependency-free in-memory fixed-window rate limiter.
//
// NOTE: State lives in a module-level Map, so limits are enforced PER INSTANCE
// (a single Node process). A multi-instance / horizontally-scaled deployment
// would let each instance grant its own quota. Redis is already in the stack
// (see docker-compose) but has no client dependency yet; move this state there
// when running more than one app instance.

interface WindowState {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, WindowState>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  now?: number;
}

export function rateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = opts.now ?? Date.now();
  const existing = buckets.get(key);

  if (!existing || now >= existing.resetAt) {
    // Start a fresh window.
    const state: WindowState = { count: 1, resetAt: now + opts.windowMs };
    buckets.set(key, state);
    return { allowed: true, remaining: opts.limit - 1, retryAfterMs: 0 };
  }

  if (existing.count >= opts.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: existing.resetAt - now,
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: opts.limit - existing.count,
    retryAfterMs: 0,
  };
}

// Derive a rate-limit key from the client IP plus a scope and optional extra
// discriminator (e.g. a username). Falls back to "unknown" when no IP header
// is present so requests behind a misconfigured proxy still share a bucket.
export function clientKey(
  request: Request,
  scope: string,
  extra?: string,
): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return extra ? `${scope}:${ip}:${extra}` : `${scope}:${ip}`;
}
