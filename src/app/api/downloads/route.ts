import { auth } from "@/lib/auth";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { eq, desc, or, and, gte, count } from "drizzle-orm";
import { startDownload } from "@/lib/ytdlp-download";
import { createDownloadToken } from "@/lib/download-token";
import { getSetting } from "@/lib/settings";
import { type NextRequest } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userDownloads = await db.query.downloads.findMany({
    where: eq(downloads.userId, session.user.id),
    orderBy: [desc(downloads.createdAt)],
    limit: 50,
  });

  const now = new Date();
  const result = userDownloads.map((dl) => ({
    ...dl,
    createdAt: dl.createdAt.toISOString(),
    expiresAt: dl.expiresAt?.toISOString() ?? null,
    token:
      dl.status === "completed" && dl.expiresAt && dl.expiresAt > now
        ? createDownloadToken(dl.id, dl.expiresAt)
        : null,
  }));

  return Response.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true },
  });
  if (dbUser?.status !== "approved") {
    return Response.json({ error: "Account not approved" }, { status: 403 });
  }

  const body = await req.json() as {
    url?: string;
    quality?: string;
    container?: string;
    vcodec?: string;
    acodec?: string;
  };
  const { url, quality, container, vcodec, acodec } = body;

  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return Response.json({ error: "Enter a valid URL" }, { status: 400 });
  }

  const validContainers = ["mp4", "mkv", "webm", "mp3"];
  if (!quality || !container || !validContainers.includes(container)) {
    return Response.json({ error: "Invalid format selection" }, { status: 400 });
  }

  // Build a readable format ID for DB storage
  const formatId = [quality, container, vcodec, acodec].filter(Boolean).join("_");

  // Whitelist kontrolü
  const whitelistValue = await getSetting("whitelist_domains");
  const whitelist = whitelistValue.split(",").map((d) => d.trim()).filter(Boolean);
  if (whitelist.length > 0) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      const allowed = whitelist.some((d) => hostname === d || hostname.endsWith(`.${d}`));
      if (!allowed) {
        return Response.json({ error: "This domain is not allowed for downloads" }, { status: 403 });
      }
    } catch {
      return Response.json({ error: "Enter a valid URL" }, { status: 400 });
    }
  }

  // Günlük indirme limiti kontrolü
  const limitValue = await getSetting("daily_download_limit");
  const dailyLimit = parseInt(limitValue, 10);
  if (dailyLimit > 0) {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [{ total: todayCount }] = await db
      .select({ total: count() })
      .from(downloads)
      .where(and(eq(downloads.userId, session.user.id), gte(downloads.createdAt, since)));
    if (todayCount >= dailyLimit) {
      return Response.json(
        { error: `Daily download limit reached (${dailyLimit})` },
        { status: 429 }
      );
    }
  }

  // Sistem geneli max 1 eş zamanlı indirme
  const active = await db.query.downloads.findFirst({
    where: or(
      eq(downloads.status, "pending"),
      eq(downloads.status, "downloading")
    ),
    columns: { id: true },
  });
  if (active) {
    return Response.json(
      { error: "A download is already in progress" },
      { status: 409 }
    );
  }

  const [record] = await db
    .insert(downloads)
    .values({ userId: session.user.id, url, format: formatId, status: "pending" })
    .returning({ id: downloads.id });

  const vkCookiesPath = await getSetting("vk_cookies_path");
  startDownload(record.id, url, quality, container, vcodec, acodec, vkCookiesPath || undefined);

  await db
    .update(downloads)
    .set({ status: "downloading" })
    .where(eq(downloads.id, record.id));

  return Response.json({ id: record.id }, { status: 201 });
}
