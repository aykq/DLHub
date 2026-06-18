import { createTransport } from "nodemailer";

function transport() {
  return createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER ?? "",
      pass: process.env.EMAIL_APP_PASSWORD ?? "",
    },
  });
}

const from = () => `DLHub <${process.env.EMAIL_USER ?? ""}>`;
const appUrl = () => process.env.NEXTAUTH_URL ?? "https://dlhub.aykq.org.tr";

function buildEmailHtml(heading: string, body: string, buttonText: string, buttonUrl: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5c518;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <div style="padding:40px 16px">
    <div style="max-width:520px;margin:0 auto;background:#0f0f0f;border-radius:12px;overflow:hidden">

      <!-- Brand -->
      <div style="padding:28px 32px 0">
        <div style="font-size:21px;font-weight:900;color:#f5c518;letter-spacing:-0.5px">DLHub</div>
        <div style="font-size:11px;color:#52525b;margin-top:3px;text-transform:uppercase;letter-spacing:0.07em">Video indirme platformu</div>
      </div>

      <!-- Divider -->
      <div style="margin:20px 32px 0;height:1px;background:#1f1f1f"></div>

      <!-- Content -->
      <div style="padding:24px 32px 32px">
        <h2 style="font-size:20px;font-weight:700;color:#ffffff;margin:0 0 12px;line-height:1.3">${heading}</h2>
        <p style="font-size:14px;color:#a1a1aa;line-height:1.7;margin:0 0 28px">${body}</p>
        <a href="${buttonUrl}" style="display:inline-block;background:#f5c518;color:#0f0f0f;padding:13px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:700;letter-spacing:0.01em">${buttonText}</a>
      </div>

      <!-- Footer -->
      <div style="padding:16px 32px 24px;border-top:1px solid #1f1f1f">
        <p style="font-size:11px;color:#52525b;margin:0;line-height:1.6">${footerNote}</p>
      </div>

    </div>
  </div>
</body>
</html>`;
}

export async function sendUnblockedEmail(email: string): Promise<void> {
  const loginUrl = `${appUrl()}/login`;
  await transport().sendMail({
    to: email,
    from: from(),
    subject: "DLHub — Hesabınızın Engeli Kaldırıldı",
    text: `Hesabınıza erişim kısıtlaması kaldırıldı. Giriş yapmak için: ${loginUrl}`,
    html: buildEmailHtml(
      "Hesabınızın Engeli Kaldırıldı",
      "Hesabınıza uygulanan erişim kısıtlaması kaldırıldı. Tekrar giriş yapabilirsiniz.",
      "Giriş Yap",
      loginUrl,
      "Bu mesajı beklemiyorsanız görmezden gelebilirsiniz."
    ),
  });
}
