"use client";
import { useCallback, useEffect, useState } from "react";

export interface UseListFetchResult<T> {
  data: T[];
  loading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Standard "load a list on mount, refetch when deps change" hook.
 *
 * - url may be a plain string or a factory closure that reads current props
 *   or state. When a factory is provided, the effect re-runs whenever deps
 *   change, so callers pass the same deps array they would to a raw
 *   useEffect.
 * - refetch() is returned for callers that need to re-fetch imperatively
 *   after a mutation.
 * - A cancelled flag guards against race conditions when deps change
 *   rapidly and an older request resolves after a newer one.
 */
export function useListFetch<T>(
  url: string | (() => string),
  deps: React.DependencyList,
): UseListFetchResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const resolveUrl = useCallback(
    () => (typeof url === "function" ? url() : url),
    // Deps are supplied by the caller; react-hooks/exhaustive-deps can't
    // statically verify this pattern, but it is the same contract as
    // useEffect(fn, deps) which the caller is already using.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    deps,
  );

  const refetch = useCallback(async () => {
    setLoading(true);
    const res = await fetch(resolveUrl());
    const json = await res.json();
    setData((json.data ?? []) as T[]);
    setLoading(false);
  }, [resolveUrl]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(resolveUrl());
      const json = await res.json();
      if (cancelled) return;
      setData((json.data ?? []) as T[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveUrl]);

  return { data, loading, refetch };
}
