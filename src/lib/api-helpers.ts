import { NextRequest, NextResponse } from "next/server";
import { queryOne, errorResponse, normalizeResourceRow } from "./db";
import { withAuth } from "./with-auth";
import type { User, Permission } from "./auth";

export type ResourceLoadResult<T> =
  | { resource: T; response: null }
  | { resource: null; response: NextResponse };

export interface LoadResourceOrFailOptions<T> {
  table: string;
  id: number | string;
  user: User;
  check: (user: User, resource: T) => Promise<boolean>;
  notFoundCode?: string;
  notFoundMessage: string;
  forbiddenCode?: string;
  forbiddenMessage: string;
}

export async function loadResourceOrFail<T>(
  opts: LoadResourceOrFailOptions<T>,
): Promise<ResourceLoadResult<T>> {
  const rawResource = await queryOne<T>(
    `SELECT * FROM ${opts.table} WHERE id = $1`,
    [Number(opts.id)],
  );
  const resource = rawResource
    ? normalizeResourceRow<T>(opts.table, rawResource)
    : undefined;
  if (!resource) {
    const res = errorResponse(
      opts.notFoundCode ?? "NOT_FOUND",
      opts.notFoundMessage,
      404,
    );
    return {
      resource: null,
      response: NextResponse.json(res.body, { status: res.status }),
    };
  }
  if (!(await opts.check(opts.user, resource))) {
    const res = errorResponse(
      opts.forbiddenCode ?? "OWNERSHIP_REQUIRED",
      opts.forbiddenMessage,
      403,
    );
    return {
      resource: null,
      response: NextResponse.json(res.body, { status: res.status }),
    };
  }
  return { resource, response: null };
}

export interface WithResourceOptions<TResource> {
  permission: Permission;
  table: string;
  check: (user: User, resource: TResource) => Promise<boolean>;
  notFoundMessage: string;
  notFoundCode?: string;
  forbiddenMessage: string;
  forbiddenCode?: string;
  handler: (ctx: {
    resource: TResource;
    user: User;
    request: NextRequest;
    params: { id: string };
  }) => Promise<NextResponse>;
}

/**
 * Wraps withAuth + loadResourceOrFail for the common "load one resource by id
 * and do one thing with it" pattern. Only fits routes whose params shape is
 * { id: string }. Complex handlers (body parsing, post-load counts, etc.)
 * should use loadResourceOrFail directly inside a regular withAuth wrapper.
 */
export function withResource<TResource>(opts: WithResourceOptions<TResource>) {
  type Context = { params: Promise<{ id: string }> };
  return withAuth<Context>(
    opts.permission,
    async (request, user, { params }) => {
      const resolved = await params;
      const { resource, response: errResp } =
        await loadResourceOrFail<TResource>({
          table: opts.table,
          id: resolved.id,
          user,
          check: opts.check,
          notFoundCode: opts.notFoundCode,
          notFoundMessage: opts.notFoundMessage,
          forbiddenCode: opts.forbiddenCode,
          forbiddenMessage: opts.forbiddenMessage,
        });
      if (errResp) return errResp;
      return opts.handler({
        resource: resource as TResource,
        user,
        request,
        params: resolved,
      });
    },
  );
}
