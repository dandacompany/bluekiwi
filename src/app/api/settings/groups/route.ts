import { NextResponse } from "next/server";
import {
  insertAndReturnId,
  query,
  queryOne,
  listResponse,
  okResponse,
  errorResponse,
} from "@/lib/db";
import { withAuth } from "@/lib/with-auth";

export const GET = withAuth("users:read", async () => {
  const rows = await query(
    "SELECT id, name, description, created_at FROM user_groups ORDER BY name ASC",
  );
  const res = listResponse(rows, rows.length);
  return NextResponse.json(res.body, { status: res.status });
});

export const POST = withAuth("users:write", async (request) => {
  const body = await request.json();
  const name: unknown = body.name;
  const description: unknown = body.description ?? "";

  if (typeof name !== "string" || !name.trim()) {
    const res = errorResponse("VALIDATION_ERROR", "name is required", 400);
    return NextResponse.json(res.body, { status: res.status });
  }

  const id = await insertAndReturnId(
    "INSERT INTO user_groups (name, description) VALUES ($1, $2)",
    [name.trim(), typeof description === "string" ? description : ""],
  );
  const row = await queryOne("SELECT * FROM user_groups WHERE id = $1", [id]);
  const res = okResponse(row, 201);
  return NextResponse.json(res.body, { status: res.status });
});
