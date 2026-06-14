import { NextResponse } from "next/server";
import { maskSecrets, okResponse, listResponse, errorResponse } from "@/lib/db";
import { buildCredentialVisibilityFilter } from "@/lib/authorization";
import { decryptSecret } from "@/lib/crypto";
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
  // Return explicit fields only — NEVER spread the row (raw `secrets` would leak).
  const masked = rows.map((c) => ({
    id: c.id,
    service_name: c.service_name,
    description: c.description,
    owner_id: c.owner_id,
    created_at: c.created_at,
    updated_at: c.updated_at,
    secrets_masked: maskSecrets(decryptSecret(c.secrets)),
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
    id: row!.id,
    service_name: row!.service_name,
    description: row!.description,
    owner_id: row!.owner_id,
    created_at: row!.created_at,
    updated_at: row!.updated_at,
    secrets_masked: maskSecrets(decryptSecret(row!.secrets)),
  });
  return NextResponse.json(res.body, { status: res.status });
});
