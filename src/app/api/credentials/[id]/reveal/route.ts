import { NextResponse } from "next/server";
import { queryOne, type Credential, okResponse, errorResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";
import { canRevealCredential } from "@/lib/authorization";

type Params = { params: Promise<{ id: string }> };

export const POST = withAuth<Params>(
  "credentials:read",
  async (_request, user, { params }) => {
    const { id } = await params;
    const cred = await queryOne<Credential>(
      "SELECT * FROM credentials WHERE id = $1",
      [Number(id)],
    );
    if (!cred) {
      const res = errorResponse("NOT_FOUND", "크레덴셜 없음", 404);
      return NextResponse.json(res.body, { status: res.status });
    }
    if (!(await canRevealCredential(user, cred))) {
      const res = errorResponse(
        "CREDENTIAL_REVEAL_DENIED",
        "평문 조회 권한 없음",
        403,
      );
      return NextResponse.json(res.body, { status: res.status });
    }
    const res = okResponse({ id: cred.id, secrets: cred.secrets });
    return NextResponse.json(res.body, { status: res.status });
  },
);
