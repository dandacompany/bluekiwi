import { NextRequest, NextResponse } from "next/server";
import {
  query,
  insert,
  queryOne,
  Credential,
  maskSecrets,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import { withOptionalAuth } from "@/lib/with-auth";

function toMaskedCredential(row: Credential) {
  const { secrets, ...rest } = row;
  return { ...rest, secrets_masked: maskSecrets(secrets) };
}

export const GET = withOptionalAuth("credentials:read", async () => {
  const rows = await query<Credential>(
    "SELECT * FROM credentials ORDER BY updated_at DESC",
  );

  const masked = rows.map(toMaskedCredential);
  const res = listResponse(masked, masked.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withOptionalAuth(
  "credentials:write",
  async (request: NextRequest) => {
    const body = await request.json();
    const { service_name, description, secrets } = body;

    if (
      !service_name ||
      typeof service_name !== "string" ||
      !service_name.trim()
    ) {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "service_name is required",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!secrets || typeof secrets !== "object") {
      const res = errorResponse(
        "VALIDATION_ERROR",
        "secrets must be an object",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const credentialId = await insert(
      "INSERT INTO credentials (service_name, description, secrets) VALUES ($1, $2, $3) RETURNING id",
      [
        service_name.trim(),
        (description ?? "").trim(),
        JSON.stringify(secrets),
      ],
    );

    const created = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [credentialId],
    );

    const res = okResponse(created ? toMaskedCredential(created) : null, 201);
    return NextResponse.json(res.body, { status: res.status });
  },
);
