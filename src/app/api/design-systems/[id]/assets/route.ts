import { NextRequest, NextResponse } from "next/server";
import { DesignSystem, errorResponse, okResponse } from "@/lib/db";
import { canEditDesignSystem } from "@/lib/authorization";
import { loadResourceOrFail } from "@/lib/api-helpers";
import { withAuth } from "@/lib/with-auth";
import {
  addDesignSystemAsset,
  recordDesignSystemEvent,
} from "@/lib/db/repositories/design-systems";
import { parseDesignSystemId } from "../../route-helpers";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "design_systems:update",
  async (request: NextRequest, user, { params }) => {
    const { id } = await params;
    const parsedId = parseDesignSystemId(id);
    if (parsedId instanceof NextResponse) return parsedId;
    const designSystemId = parsedId;
    const body = await request.json();

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
      const asset = await addDesignSystemAsset({
        designSystemId,
        kind: body.kind,
        filename: String(body.filename ?? ""),
        mimeType: String(body.mime_type ?? ""),
        contentText:
          typeof body.content_text === "string" ? body.content_text : null,
        contentBase64:
          typeof body.content_base64 === "string" ? body.content_base64 : null,
      });
      await recordDesignSystemEvent({
        designSystemId,
        actorUserId: user.id,
        action: "add_asset",
        summary: `Added asset ${asset.filename}`,
        metadata: {
          asset_id: asset.id,
          filename: asset.filename,
          kind: asset.kind,
          mime_type: asset.mime_type,
          size_bytes: asset.size_bytes,
        },
      });

      const res = okResponse(asset, 201);
      return NextResponse.json(res.body, { status: res.status });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const res = errorResponse("VALIDATION_ERROR", message, 400);
      return NextResponse.json(res.body, { status: res.status });
    }
  },
);
