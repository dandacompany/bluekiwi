import { errorResponse } from "@/lib/db";
import { NextResponse } from "next/server";

export function parseDesignSystemId(value: string): number | NextResponse {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) {
    const res = errorResponse(
      "VALIDATION_ERROR",
      "invalid design system id",
      400,
    );
    return NextResponse.json(res.body, { status: res.status });
  }
  return id;
}
