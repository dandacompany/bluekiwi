import { NextResponse } from "next/server";
import { openApiSpec } from "@/lib/openapi";

export function GET() {
  return NextResponse.json(openApiSpec);
}
