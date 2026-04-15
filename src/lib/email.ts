import nodemailer from "nodemailer";
import { Resend } from "resend";
import { execute, query } from "@/lib/db";

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
    const placeholders = EMAIL_KEYS.map((_, index) => `$${index + 1}`).join(", ");
    const rows = await query<{ key: string; value: string }>(
      `SELECT key, value FROM system_settings WHERE key IN (${placeholders})`,
      EMAIL_KEYS.map((k) => `email.${k}`),
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
    await execute(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = $3`,
      [key, value, new Date().toISOString()],
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

const EMAIL_STRINGS = {
  ko: {
    heading: "팀원으로 초대되었습니다",
    body: (name: string, role: string) =>
      `<strong>${name}</strong>님이 BlueKiwi에 <strong>${role}</strong> 역할로 초대했습니다.<br/>아래 버튼을 클릭해 계정을 생성하거나, CLI로 바로 연결할 수 있습니다.`,
    acceptBtn: "초대 수락하기",
    cliHeading: "AI 코딩 에이전트에서 바로 연결하기",
    cliDesc:
      "아래 명령어를 터미널에 붙여넣으면 CLI 설치부터 계정 생성, MCP 연결까지 한 번에 완료됩니다.",
    linkExpiry: (d: string) =>
      `이 링크는 <strong>${d}</strong>까지 유효합니다.`,
    linkFallback: "버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣으세요:",
    footer:
      "이 메일은 BlueKiwi에서 자동 발송되었습니다. 본인이 요청하지 않은 경우 무시하세요.",
    subject: (name: string) => `${name}님이 BlueKiwi에 초대했습니다`,
    roles: { admin: "관리자", editor: "편집자", viewer: "열람자" } as Record<
      string,
      string
    >,
  },
  en: {
    heading: "You've been invited to join the team",
    body: (name: string, role: string) =>
      `<strong>${name}</strong> has invited you to BlueKiwi as <strong>${role}</strong>.<br/>Click the button below to create your account, or connect directly via CLI.`,
    acceptBtn: "Accept Invitation",
    cliHeading: "Connect from your AI coding agent",
    cliDesc:
      "Paste the command below into your terminal to install the CLI, create your account, and connect MCP in one step.",
    linkExpiry: (d: string) =>
      `This link is valid until <strong>${d}</strong>.`,
    linkFallback:
      "If the button doesn't work, paste this URL into your browser:",
    footer:
      "This email was sent automatically by BlueKiwi. If you didn't request this, please ignore it.",
    subject: (name: string) => `${name} invited you to BlueKiwi`,
    roles: { admin: "Admin", editor: "Editor", viewer: "Viewer" } as Record<
      string,
      string
    >,
  },
} as const;

type EmailLocale = keyof typeof EMAIL_STRINGS;

function buildInviteHtml(params: {
  inviterName: string;
  inviteUrl: string;
  expires: string;
  serverUrl: string;
  token: string;
  role: string;
  locale: EmailLocale;
}): string {
  const { inviterName, inviteUrl, expires, serverUrl, token, role, locale } =
    params;
  const s = EMAIL_STRINGS[locale] ?? EMAIL_STRINGS.en;
  const roleLabel = s.roles[role] ?? role;
  const cliCommand = `bluekiwi accept ${token} --server ${serverUrl}`;
  const lang = locale === "ko" ? "ko" : "en";
  return `<!DOCTYPE html>
<html lang="${lang}">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <tr><td style="background:#2563eb;padding:24px 32px;">
          <span style="color:#ffffff;font-size:20px;font-weight:700;">🥝 BlueKiwi</span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">${s.heading}</h1>
          <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
            ${s.body(inviterName, roleLabel)}
          </p>
          <a href="${inviteUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
            ${s.acceptBtn}
          </a>

          <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
            <tr><td style="background:#f3f4f6;border-radius:8px;padding:16px;">
              <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#374151;">${s.cliHeading}</p>
              <p style="margin:0 0 10px;font-size:12px;color:#6b7280;line-height:1.5;">
                ${s.cliDesc}
              </p>
              <div style="background:#e5e7eb;border-radius:6px;padding:12px;">
                <code style="font-family:monospace;font-size:12px;color:#1f2937;word-break:break-all;">npm i -g bluekiwi && ${cliCommand}</code>
              </div>
            </td></tr>
          </table>

          <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
            ${s.linkExpiry(expires)}<br/>
            ${s.linkFallback}<br/>
            <a href="${inviteUrl}" style="color:#2563eb;word-break:break-all;">${inviteUrl}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">
            ${s.footer}
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
  locale = "en",
}: {
  to: string;
  inviteUrl: string;
  role: string;
  inviterName: string;
  expiresAt: Date;
  locale?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const cfg = await loadEmailConfig();

  if (cfg.provider === "none") {
    return { sent: false, error: "Email not configured" };
  }

  const loc: EmailLocale = locale === "ko" ? "ko" : "en";
  const s = EMAIL_STRINGS[loc];
  const dateLocale = loc === "ko" ? "ko-KR" : "en-US";
  const expires = expiresAt.toLocaleDateString(dateLocale);
  const parsedUrl = new URL(inviteUrl);
  const serverUrl = parsedUrl.origin;
  const token = parsedUrl.pathname.split("/invite/")[1] ?? "";
  const html = buildInviteHtml({
    inviterName,
    inviteUrl,
    expires,
    serverUrl,
    token,
    role,
    locale: loc,
  });
  const subject = s.subject(inviterName);

  if (cfg.provider === "smtp") {
    return sendViaSmtp(cfg, to, subject, html);
  }
  return sendViaResend(cfg, to, subject, html);
}
