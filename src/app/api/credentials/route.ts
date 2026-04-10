import { NextResponse } from "next/server";
import {
  query,
  queryOne,
  type Credential,
  maskSecrets,
  okResponse,
  listResponse,
  errorResponse,
} from "@/lib/db";
import {
  buildCredentialVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth("credentials:read", async (request, user) => {
  const filter = await buildCredentialVisibilityFilter("c", user, 1);
  const rows = await query<Credential>(
    `SELECT c.* FROM credentials c WHERE ${filter.sql} ORDER BY c.updated_at DESC`,
    filter.params,
  );
  // Always mask secrets in list responses. Reveal is a separate endpoint.
  const masked = rows.map((c) => ({
    ...c,
    secrets: JSON.stringify(maskSecrets(c.secrets)),
  }));
  const res = listResponse(masked, masked.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth("credentials:write", async (request, user) => {
  const body = await request.json();
  const { service_name, description = "", secrets = "{}", folder_id } = body;
  if (!service_name) {
    const res = errorResponse("VALIDATION_ERROR", "service_name required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  // Resolve folder: credentials cannot live in public folders.
  let targetFolderId: number;
  if (typeof folder_id === "number") {
    const f = await loadFolder(folder_id);
    if (!f) {
      const res = errorResponse("NOT_FOUND", "folder not found", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (f.visibility === "public") {
      const res = errorResponse(
        "CREDENTIAL_IN_PUBLIC_FOLDER",
        "크레덴셜은 공개 폴더에 생성할 수 없습니다",
        400,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canEditFolder(user, f))) {
      const res = errorResponse("OWNERSHIP_REQUIRED", "폴더 권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    targetFolderId = f.id;
  } else {
    const mw = await queryOne<{ id: number }>(
      "SELECT id FROM folders WHERE owner_id = $1 AND is_system = true AND name = 'My Workspace' LIMIT 1",
      [user.id],
    );
    targetFolderId = mw!.id;
  }

  const row = await queryOne<Credential>(
    `INSERT INTO credentials (service_name, description, secrets, owner_id, folder_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [service_name, description, secrets, user.id, targetFolderId],
  );
  // Return masked in response
  const res = okResponse({
    ...row!,
    secrets: JSON.stringify(maskSecrets(row!.secrets)),
  });
  return NextResponse.json(res.body, { status: res.status });
});
