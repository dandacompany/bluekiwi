import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/with-auth";
import { loadEmailConfig } from "@/lib/email";
import { Resend } from "resend";
import nodemailer from "nodemailer";

const DEVELOPER_EMAIL = "dante@dante-labs.com";

const REPORT_TYPES = ["bug", "feedback", "improvement", "other"] as const;
type ReportType = (typeof REPORT_TYPES)[number];

/** Patterns that indicate PII or sensitive data */
const PII_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Email addresses
  {
    pattern: /[\w.+%-]+@[\w-]+\.[a-z]{2,}/gi,
    replacement: "[EMAIL_REDACTED]",
  },
  // Korean phone numbers (010-xxxx-xxxx or similar)
  {
    pattern: /0\d{1,2}[-.\s]?\d{3,4}[-.\s]?\d{4}/g,
    replacement: "[PHONE_REDACTED]",
  },
  // API keys / tokens (common prefixes)
  {
    pattern:
      /(sk-|pk-|bk-|ghp_|gho_|github_pat_|xoxb-|xoxp-|ya29\.|AIza)[A-Za-z0-9_-]{10,}/gi,
    replacement: "[API_KEY_REDACTED]",
  },
  // Bearer tokens
  {
    pattern: /Bearer\s+[A-Za-z0-9._-]{20,}/gi,
    replacement: "Bearer [TOKEN_REDACTED]",
  },
  // Home directory paths (/Users/xxx or /home/xxx)
  {
    pattern: /\/(Users|home)\/[^/\s]+/g,
    replacement: "/[USER_PATH_REDACTED]",
  },
  // IPv4 addresses (non-loopback)
  {
    pattern:
      /\b(?!127\.0\.0\.1|192\.168\.|10\.|172\.(?:1[6-9]|2\d|3[01])\.)(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: "[IP_REDACTED]",
  },
  // Korean resident registration numbers
  {
    pattern: /\b\d{6}[-–]\d{7}\b/g,
    replacement: "[RRN_REDACTED]",
  },
];

function stripPii(text: string): string {
  let result = text;
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function validateReportType(type: unknown): type is ReportType {
  return typeof type === "string" && REPORT_TYPES.includes(type as ReportType);
}

function buildReportHtml(params: {
  type: ReportType;
  title: string;
  message: string;
  context: string;
  submittedAt: string;
}): string {
  const typeLabels: Record<ReportType, string> = {
    bug: "🐛 Bug Report",
    feedback: "💬 User Feedback",
    improvement: "✨ Improvement Request",
    other: "📝 Other",
  };
  const label = typeLabels[params.type];

  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:20px 32px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;">🥝 BlueKiwi Developer Report</span>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 0 16px;">
              <span style="display:inline-block;background:#dbeafe;color:#1d4ed8;font-size:12px;font-weight:600;padding:4px 10px;border-radius:12px;">${label}</span>
            </td></tr>
            <tr><td style="padding:0 0 20px;">
              <h2 style="margin:0;font-size:18px;font-weight:600;color:#111827;">${escapeHtml(params.title)}</h2>
              <p style="margin:4px 0 0;font-size:12px;color:#9ca3af;">${params.submittedAt}</p>
            </td></tr>
            <tr><td style="padding:0 0 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Message</p>
              <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:14px;font-size:13px;color:#374151;line-height:1.6;white-space:pre-wrap;">${escapeHtml(params.message)}</div>
            </td></tr>
            ${
              params.context.trim()
                ? `<tr><td style="padding:0 0 20px;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#374151;">Session Context</p>
              <div style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;padding:14px;font-size:12px;color:#6b7280;line-height:1.6;white-space:pre-wrap;font-family:monospace;">${escapeHtml(params.context)}</div>
            </td></tr>`
                : ""
            }
          </table>
        </td></tr>
        <tr><td style="padding:14px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            BlueKiwi 개발자 피드백 시스템 — PII 자동 제거 처리됨
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendReportEmail(params: {
  type: ReportType;
  title: string;
  message: string;
  context: string;
}): Promise<{ sent: boolean; error?: string }> {
  const cfg = await loadEmailConfig();

  const submittedAt = new Date().toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "full",
    timeStyle: "short",
  });

  const html = buildReportHtml({
    type: params.type,
    title: params.title,
    message: params.message,
    context: params.context,
    submittedAt,
  });

  const subject = `[BlueKiwi Report] ${params.type.toUpperCase()}: ${params.title}`;

  // Use Resend directly (preferred for developer reports)
  const resendKey =
    process.env.REPORT_RESEND_KEY ??
    (cfg.provider === "resend" ? cfg.resend_api_key : undefined);

  if (resendKey) {
    const resend = new Resend(resendKey);
    try {
      const { error } = await resend.emails.send({
        from: "BlueKiwi Reports <noreply@bluekiwi.app>",
        to: DEVELOPER_EMAIL,
        subject,
        html,
      });
      if (error) return { sent: false, error: error.message };
      return { sent: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[report] resend send failed:", msg);
      return { sent: false, error: msg };
    }
  }

  // SMTP fallback
  if (cfg.provider === "smtp" && cfg.smtp_host) {
    const transporter = nodemailer.createTransport({
      host: cfg.smtp_host,
      port: cfg.smtp_port ?? 587,
      secure: cfg.smtp_secure ?? false,
      auth: cfg.smtp_user
        ? { user: cfg.smtp_user, pass: cfg.smtp_pass }
        : undefined,
    });
    try {
      const fromAddr = cfg.from_name
        ? `${cfg.from_name} <${cfg.from_email ?? "noreply@bluekiwi.app"}>`
        : (cfg.from_email ?? "noreply@bluekiwi.app");
      await transporter.sendMail({
        from: fromAddr,
        to: DEVELOPER_EMAIL,
        subject,
        html,
      });
      return { sent: true };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[report] smtp send failed:", msg);
      return { sent: false, error: msg };
    }
  }

  return { sent: false, error: "email_not_configured" };
}

export const POST = withAuth("workflows:read", async (request: NextRequest) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "invalid_json" },
      { status: 400 },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json(
      { success: false, error: "invalid_body" },
      { status: 400 },
    );
  }

  const raw = body as Record<string, unknown>;
  const type = raw.type;
  const title = raw.title;
  const message = raw.message;
  const contextRaw = raw.context;

  if (!validateReportType(type)) {
    return NextResponse.json(
      {
        success: false,
        error: "invalid_type",
        valid_types: REPORT_TYPES,
      },
      { status: 400 },
    );
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "title_required" },
      { status: 400 },
    );
  }

  if (typeof message !== "string" || message.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "message_required" },
      { status: 400 },
    );
  }

  // Sanitize all string inputs — strip PII before sending
  const safeTitle = stripPii(title.slice(0, 200).trim());
  const safeMessage = stripPii(message.slice(0, 10000).trim());
  const safeContext =
    typeof contextRaw === "string"
      ? stripPii(contextRaw.slice(0, 5000).trim())
      : "";

  const reportId = `rpt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const result = await sendReportEmail({
    type,
    title: safeTitle,
    message: safeMessage,
    context: safeContext,
  });

  if (!result.sent) {
    const isConfig = result.error === "email_not_configured";
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        hint: isConfig
          ? "Configure email (Settings → Email) or set REPORT_RESEND_KEY env var"
          : undefined,
      },
      { status: isConfig ? 503 : 502 },
    );
  }

  return NextResponse.json({ success: true, report_id: reportId });
});
