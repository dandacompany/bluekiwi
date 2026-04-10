import { NextResponse } from "next/server";
import {
  execute,
  queryOne,
  type Credential,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canManageCredentialShares } from "@/lib/authorization";

type Params = { params: Promise<{ id: string; groupId: string }> };

export const DELETE = withAuth<Params>(
  "credentials:write",
  async (_request, user, { params }) => {
    const { id, groupId } = await params;
    const cred = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );
    if (!cred || !(await canManageCredentialShares(user, cred))) {
      const res = errorResponse("CREDENTIAL_REVEAL_DENIED", "권한 없음", 403);
      return NextResponse.json(res.body, { status: res.status });
    }
    const r = await execute(
      "DELETE FROM credential_shares WHERE credential_id = $1 AND group_id = $2",
      [Number(id), Number(groupId)],
    );
    const res = okResponse({ removed: r.rowCount > 0 });
    return NextResponse.json(res.body, { status: res.status });
  },
);

