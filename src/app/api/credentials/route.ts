import { NextResponse } from "next/server";
import { maskSecrets, okResponse, listResponse, errorResponse } from "@/lib/db";
import { buildCredentialVisibilityFilter } from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import {
  createCredential,
  listCredentialsForVisibilityFilter,
} from "@/lib/db/repositories/credentials";

export const GET = withAuth("credentials:read", async (request, user) => {
  const filter = await buildCredentialVisibilityFilter("c", user, 1);
  const rows = await listCredentialsForVisibilityFilter(
    filter.sql,
    filter.params,
  );
  // Always mask secrets in list responses. Reveal is a separate endpoint.
  const masked = rows.map((c) => ({
    ...c,
    secrets_masked: maskSecrets(c.secrets),
  }));
  const res = listResponse(masked, masked.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth("credentials:write", async (request, user) => {
  const body = await request.json();
  const { service_name, description = "", secrets = "{}" } = body;
  if (!service_name) {
    const res = errorResponse("VALIDATION_ERROR", "service_name required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  const row = await createCredential({
    serviceName: service_name,
    description,
    secrets,
    ownerId: user.id,
  });
  const res = okResponse({
    ...row!,
    secrets_masked: maskSecrets(row!.secrets),
  });
  return NextResponse.json(res.body, { status: res.status });
});
