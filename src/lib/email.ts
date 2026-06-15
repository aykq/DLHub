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
const loginUrl = () => process.env.NEXTAUTH_URL ?? "https://dlhub.aykq.org.tr";

export async function sendUnblockedEmail(email: string): Promise<void> {
  const url = `${loginUrl()}/login`;
  await transport().sendMail({
    to: email,
    from: from(),
    subject: "DLHub — Hesabınızın Engeli Kaldırıldı",
    text: `Hesabınıza erişim kısıtlaması kaldırıldı. Giriş yapmak için: ${url}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:24px;font-weight:900;margin:0 0 8px">DLHub</h1>
        <p style="color:#6b7280;margin:0 0 32px;font-size:14px">Video indirme platformu</p>
        <h2 style="font-size:18px;font-weight:700;margin:0 0 12px">Hesabınızın Engeli Kaldırıldı</h2>
        <p style="color:#374151;font-size:14px;margin:0 0 24px">
          Hesabınıza erişim kısıtlaması kaldırıldı. Aşağıdaki butona tıklayarak giriş yapabilirsiniz.
        </p>
        <a href="${url}" style="display:inline-block;background:#000;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">
          Giriş Yap
        </a>
        <p style="color:#9ca3af;font-size:12px;margin:24px 0 0">
          Bu mesajı siz talep etmediyseniz görmezden gelebilirsiniz.
        </p>
      </div>
    `,
  });
}
