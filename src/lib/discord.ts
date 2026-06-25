import { createApprovalToken } from "./admin-token";

interface NewUserNotificationData {
  userId: string;
  name: string | null;
  email: string | null;
  provider: string;
  image: string | null;
  isNewUser: boolean;
  signedInAt: Date;
}

interface DownloadCompleteNotificationData {
  userId: string;
  userName: string | null;
  title: string | null;
  format: string;
  fileSize: number | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google OAuth",
  resend: "Email (Magic Link)",
};

async function sendWebhook(body: object): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return;

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Discord webhook failed: ${res.status}`);
  }
}

export async function sendSignInDiscordNotification(data: NewUserNotificationData) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const providerLabel = PROVIDER_LABELS[data.provider] ?? data.provider;

  if (data.isNewUser) {
    const token = createApprovalToken(data.userId);
    const approvalUrl = `${appUrl}/admin/approve?token=${token}`;

    await sendWebhook({
      embeds: [
        {
          title: "🔔 New User Registration Request",
          color: 0xe11d48,
          description: `[✅ Open approval page →](${approvalUrl})`,
          fields: [
            { name: "👤 Name", value: data.name ?? "—", inline: true },
            { name: "📧 Email", value: data.email ?? "—", inline: true },
            { name: "🔑 Provider", value: providerLabel, inline: true },
          ],
          ...(data.image ? { thumbnail: { url: data.image } } : {}),
          footer: { text: "DLHub Bot" },
          timestamp: data.signedInAt.toISOString(),
        },
      ],
    });
  } else {
    await sendWebhook({
      embeds: [
        {
          title: "🔑 User Signed In",
          color: 0x2563eb,
          fields: [
            { name: "👤 Name", value: data.name ?? "—", inline: true },
            { name: "📧 Email", value: data.email ?? "—", inline: true },
            { name: "🔑 Provider", value: providerLabel, inline: true },
          ],
          ...(data.image ? { thumbnail: { url: data.image } } : {}),
          footer: { text: "DLHub Bot" },
          timestamp: data.signedInAt.toISOString(),
        },
      ],
    });
  }
}

export async function sendDownloadCompleteDiscordNotification(data: DownloadCompleteNotificationData) {
  const fileSizeMB = data.fileSize ? (data.fileSize / 1024 / 1024).toFixed(1) + " MB" : "—";

  await sendWebhook({
    embeds: [
      {
        title: "✅ Download Complete",
        color: 0x16a34a,
        fields: [
          { name: "👤 User", value: data.userName ?? "—", inline: true },
          { name: "📁 Format", value: data.format, inline: true },
          { name: "📦 Size", value: fileSizeMB, inline: true },
          { name: "🎬 Title", value: data.title ?? "—", inline: false },
        ],
        footer: { text: "DLHub Bot" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
}
