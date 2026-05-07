import { NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import {
  canEditDesignSystem,
  canReadDesignSystem,
} from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  deleteDesignSystemAsset,
  findDesignSystemAsset,
  recordDesignSystemEvent,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../../route-helpers";

type Params = { params: Promise<{ id: string; assetId: string }> };

function parseAssetId(value: string): number | NextResponse {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const res = errorResponse("VALIDATION_ERROR", "invalid asset id", 400);
    return NextResponse.json(res.body, { status: res.status });
  }
  return id;
}

export const GET = withAuth<Params>(
  "design_systems:read",
  async (_request, user, { params }) => {
    const { id, assetId } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;
    const parsedAssetId = parseAssetId(assetId);
    if (parsedAssetId instanceof NextResponse) return parsedAssetId;

    const { response: errResp } = await loadResourceOrFail<DesignSystem>({
      table: "design_systems",
      id: designSystemId,
      user,
      check: canReadDesignSystem,
      notFoundMessage: "디자인시스템을 찾을 수 없습니다",
      forbiddenMessage: "접근 권한 없음",
    });
    if (errResp) return errResp;

    const asset = await findDesignSystemAsset({
      designSystemId,
      assetId: parsedAssetId,
    });
    if (!asset) {
      const res = errorResponse(
        "NOT_FOUND",
        "디자인시스템 에셋을 찾을 수 없습니다",
        404,
      );
      return NextResponse.json(res.body, { status: res.status });
    }

    const res = okResponse(asset);
    return NextResponse.json(res.body, { status: res.status });
  },
);

export const DELETE = withAuth<Params>(
  "design_systems:update",
  async (_request, user, { params }) => {
    const { id, assetId } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;
    const parsedAssetId = parseAssetId(assetId);
    if (parsedAssetId instanceof NextResponse) return parsedAssetId;

    const { response: errResp } = await loadResourceOrFail<DesignSystem>({
      table: "design_systems",
      id: designSystemId,
      user,
      check: canEditDesignSystem,
      notFoundMessage: "디자인시스템을 찾을 수 없습니다",
      forbiddenMessage: "편집 권한 없음",
    });
    if (errResp) return errResp;

    try {
      const asset = await findDesignSystemAsset({
        designSystemId,
        assetId: parsedAssetId,
      });
      await deleteDesignSystemAsset({
        designSystemId,
        assetId: parsedAssetId,
      });
      await recordDesignSystemEvent({
        designSystemId,
        actorUserId: user.id,
        action: "delete_asset",
        summary: `Deleted asset ${asset?.filename ?? parsedAssetId}`,
        metadata: {
          asset_id: parsedAssetId,
          filename: asset?.filename,
          kind: asset?.kind,
          mime_type: asset?.mime_type,
        },
      });
      const res = okResponse({ id: parsedAssetId, deleted: true });
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const res = errorResponse("NOT_FOUND", message, 404);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
