import { NextResponse } from "next/server";
import { query, listResponse } from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth("apikeys:read_own", async (_request, user) => {
  const rows = await query<{ id: number; name: string }>(
    `SELECT ug.id, ug.name
       FROM user_groups ug
       JOIN user_group_members ugm ON ugm.group_id = ug.id
       WHERE ugm.user_id = $1
       ORDER BY ug.name ASC`,
    [user.id],
  );
  const res = listResponse(rows, rows.length);
  return NextResponse.json(res.body, { status: res.status });
});
