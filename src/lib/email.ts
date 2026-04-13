import nodemailer from "nodemailer";
import { Resend } from "resend";
import { query } from "@/lib/db";

export interface EmailConfig {
  provider: "smtp" | "resend" | "none";
  // SMTP
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean; // true = TLS (465), false = STARTTLS (587)
  smtp_user?: string;
  smtp_pass?: string;
  // Common
  from_email?: string;
  from_name?: string;
  // Resend
  resend_api_key?: string;
}

const EMAIL_KEYS: (keyof EmailConfig)[] = [
  "provider",
  "smtp_host",
  "smtp_port",
  "smtp_secure",
  "smtp_user",
  "smtp_pass",
  "from_email",
  "from_name",
  "resend_api_key",
];

/** Load email config from DB, fall back to env vars */
export async function loadEmailConfig(): Promise<EmailConfig> {
  try {
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
      [EMAIL_KEYS.map((k) => `email.${k}`)],
    );
    const db: Record<string, string> = {};
    for (const row of rows) {
      db[row.key.replace("email.", "")] = row.value;
    }

    if (db.provider && db.provider !== "none") {
      return {
        provider: db.provider as EmailConfig["provider"],
        smtp_host: db.smtp_host,
        smtp_port: db.smtp_port ? Number(db.smtp_port) : undefined,
        smtp_secure: db.smtp_secure === "true",
        smtp_user: db.smtp_user,
        smtp_pass: db.smtp_pass,
        from_email: db.from_email,
        from_name: db.from_name,
        resend_api_key: db.resend_api_key,
      };
    }
  } catch {
    // DB not ready yet — fall through to env vars
  }

  // Env var fallback
  if (process.env.RESEND_API_KEY) {
    return {
      provider: "resend",
      resend_api_key: process.env.RESEND_API_KEY,
      from_email: process.env.FROM_EMAIL ?? "noreply@bluekiwi.app",
    };
  }

  return { provider: "none" };
}

/** Save email config to DB */
export async function saveEmailConfig(cfg: EmailConfig): Promise<void> {
  const entries: [string, string][] = [
    [`email.provider`, cfg.provider ?? "none"],
    [`email.from_email`, cfg.from_email ?? ""],
    [`email.from_name`, cfg.from_name ?? ""],
    [`email.smtp_host`, cfg.smtp_host ?? ""],
    [`email.smtp_port`, String(cfg.smtp_port ?? "")],
    [`email.smtp_secure`, String(cfg.smtp_secure ?? false)],
    [`email.smtp_user`, cfg.smtp_user ?? ""],
    [`email.smtp_pass`, cfg.smtp_pass ?? ""],
    [`email.resend_api_key`, cfg.resend_api_key ?? ""],
  ];

  for (const [key, value] of entries) {
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value],
    );
  }
}

function buildFromAddress(cfg: EmailConfig): string {
  const name = cfg.from_name?.trim();
  const addr = cfg.from_email?.trim() || "noreply@bluekiwi.app";
  return name ? `${name} <${addr}>` : addr;
}

async function sendViaSmtp(
  cfg: EmailConfig,
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; error?: string }> {
  const transporter = nodemailer.createTransport({
    host: cfg.smtp_host,
    port: cfg.smtp_port ?? 587,
    secure: cfg.smtp_secure ?? false,
    auth: cfg.smtp_user
      ? { user: cfg.smtp_user, pass: cfg.smtp_pass }
      : undefined,
  });

  try {
    await transporter.sendMail({
      from: buildFromAddress(cfg),
      to,
      subject,
      html,
    });
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[email] smtp send failed:", msg);
    return { sent: false, error: msg };
  }
}

async function sendViaResend(
  cfg: EmailConfig,
  to: string,
  subject: string,
  html: string,
): Promise<{ sent: boolean; error?: string }> {
  const resend = new Resend(cfg.resend_api_key);
  try {
    const { error } = await resend.emails.send({
      from: buildFromAddress(cfg),
      to,
      subject,
      html,
    });
    if (error) return { sent: false, error: error.message };
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[email] resend send failed:", msg);
    return { sent: false, error: msg };
  }
}

function buildInviteHtml(params: {
  inviterName: string;
  roleLabel: string;
  inviteUrl: string;
  expires: string;
}): string {
  const { inviterName, roleLabel, inviteUrl, expires } = params;
  return `<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">🥝 BlueKiwi</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">팀원으로 초대되었습니다</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            <strong>${inviterName}</strong>님이 BlueKiwi에 <strong>${roleLabel}</strong> 역할로 초대했습니다.<br/>
            아래 버튼을 클릭해 계정을 생성하세요.
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
            초대 수락하기
          </a>
          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            이 링크는 <strong>${expires}</strong>까지 유효합니다.<br/>
            버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣으세요:<br/>
            <a href="${inviteUrl}" style="color:#2563eb;word-break:break-all;">${inviteUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            이 메일은 BlueKiwi에서 자동 발송되었습니다. 본인이 요청하지 않은 경우 무시하세요.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendInviteEmail({
  to,
  inviteUrl,
  role,
  inviterName,
  expiresAt,
}: {
  to: string;
  inviteUrl: string;
  role: string;
  inviterName: string;
  expiresAt: Date;
}): Promise<{ sent: boolean; error?: string }> {
  const cfg = await loadEmailConfig();

  if (cfg.provider === "none") {
    return { sent: false, error: "Email not configured" };
  }

  const roleLabel =
    role === "admin" ? "관리자" : role === "editor" ? "편집자" : "열람자";
  const expires = expiresAt.toLocaleDateString("ko-KR");
  const html = buildInviteHtml({ inviterName, roleLabel, inviteUrl, expires });
  const subject = `${inviterName}님이 BlueKiwi에 초대했습니다`;

  if (cfg.provider === "smtp") {
    return sendViaSmtp(cfg, to, subject, html);
  }
  return sendViaResend(cfg, to, subject, html);
}
