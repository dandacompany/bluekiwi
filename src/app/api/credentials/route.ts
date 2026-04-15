import { NextResponse } from "next/server";
import { type Credential, maskSecrets, okResponse, listResponse, errorResponse } from "@/lib/db";
import {
  buildCredentialVisibilityFilter,
  canEditFolder,
  loadFolder,
} from "@/lib/authorization";
import { withAuth } from "@/lib/with-auth";
import {
  createCredential,
  findPersonalWorkspaceByOwnerId,
  listCredentialsForVisibilityFilter,
} from "@/lib/db/repositories/credentials";

export const GET = withAuth("credentials:read", async (request, user) => {
  const filter = await buildCredentialVisibilityFilter("c", user, 1);
  const rows = await listCredentialsForVisibilityFilter(filter.sql, filter.params);
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
    const workspaceId = await findPersonalWorkspaceByOwnerId(user.id);
    targetFolderId = workspaceId!;
  }

  const row = await createCredential({
    serviceName: service_name,
    description,
    secrets,
    ownerId: user.id,
    folderId: targetFolderId,
  });
  // Return masked in response
  const res = okResponse({
    ...row!,
    secrets_masked: maskSecrets(row!.secrets),
  });
  return NextResponse.json(res.body, { status: res.status });
});
