import { NextRequest, NextResponse } from "next/server";

import { errorResponse } from "@/lib/db";
import { requireAuth } from "@/lib/with-auth";
import {
  loadEmailConfig,
  saveEmailConfig,
  type EmailConfig,
} from "@/lib/email";

async function requireSuperuser(request: NextRequest) {
  const authResult = await requireAuth(request, "users:read");
  if (authResult instanceof NextResponse) return authResult;
  if (authResult.role !== "superuser") {
    const res = errorResponse("FORBIDDEN", "Forbidden", 403);
    return NextResponse.json(res.body, { status: res.status });
  }
  return authResult;
}

export async function GET(request: NextRequest) {
  const auth = await requireSuperuser(request);
  if (auth instanceof NextResponse) return auth;

  const cfg = await loadEmailConfig();

  // Mask the password and API key before returning
  return NextResponse.json({
    ...cfg,
    smtp_pass: cfg.smtp_pass ? "••••••••" : "",
    resend_api_key: cfg.resend_api_key ? "••••••••" : "",
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperuser(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request.json()) as Partial<EmailConfig> & {
    smtp_pass?: string;
    resend_api_key?: string;
  };

  // Load existing config so we can keep masked values unchanged
  const existing = await loadEmailConfig();

  const cfg: EmailConfig = {
    provider: body.provider ?? "none",
    from_email: body.from_email ?? "",
    from_name: body.from_name ?? "",
    smtp_host: body.smtp_host ?? "",
    smtp_port: body.smtp_port ? Number(body.smtp_port) : undefined,
    smtp_secure: body.smtp_secure ?? false,
    smtp_user: body.smtp_user ?? "",
    // Keep existing value if client sent the masked placeholder
    smtp_pass:
      body.smtp_pass === "••••••••" ? existing.smtp_pass : body.smtp_pass,
    resend_api_key:
      body.resend_api_key === "••••••••"
        ? existing.resend_api_key
        : body.resend_api_key,
  };

  await saveEmailConfig(cfg);

  return NextResponse.json({ ok: true });
}
