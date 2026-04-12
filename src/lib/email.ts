import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL =
  process.env.FROM_EMAIL ?? "BlueKiwi <noreply@bluekiwi.dante-labs.com>";

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
  if (!resend) {
    return { sent: false, error: "RESEND_API_KEY not configured" };
  }

  const roleLabel =
    role === "admin" ? "관리자" : role === "editor" ? "편집자" : "열람자";
  const expires = expiresAt.toLocaleDateString("ko-KR");

  const html = `
<!DOCTYPE html>
<html lang="ko">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <!-- header -->
        <tr>
          <td style="background:#2563eb;padding:24px 32px;">
            <span style="color:#ffffff;font-size:20px;font-weight:700;">🥝 BlueKiwi</span>
          </td>
        </tr>
        <!-- body -->
        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 8px;font-size:18px;font-weight:600;color:#111827;">팀원으로 초대되었습니다</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
              <strong>${inviterName}</strong>님이 BlueKiwi에 <strong>${roleLabel}</strong> 역할로 초대했습니다.<br/>
              아래 버튼을 클릭해 계정을 생성하세요.
            </p>
            <a href="${inviteUrl}"
               style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">
              초대 수락하기
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;">
              이 링크는 <strong>${expires}</strong>까지 유효합니다.<br/>
              버튼이 동작하지 않으면 아래 주소를 브라우저에 붙여넣으세요:<br/>
              <a href="${inviteUrl}" style="color:#2563eb;word-break:break-all;">${inviteUrl}</a>
            </p>
          </td>
        </tr>
        <!-- footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              이 메일은 BlueKiwi에서 자동 발송되었습니다. 본인이 요청하지 않은 경우 무시하세요.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `${inviterName}님이 BlueKiwi에 초대했습니다`,
      html,
    });
    if (error) {
      console.warn("[email] resend error:", error);
      return { sent: false, error: error.message };
    }
    return { sent: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[email] send failed:", msg);
    return { sent: false, error: msg };
  }
}
