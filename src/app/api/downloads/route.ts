import { auth } from "@/lib/auth";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { getDownloadFormat } from "@/lib/formats";
import { metubeAdd } from "@/lib/metube";
import { type NextRequest } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userDownloads = await db.query.downloads.findMany({
    where: eq(downloads.userId, session.user.id),
    orderBy: [desc(downloads.createdAt)],
    limit: 50,
  });

  return Response.json(userDownloads);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true },
  });
  if (dbUser?.status !== "approved") {
    return Response.json({ error: "Hesabınız henüz onaylanmamış" }, { status: 403 });
  }

  const body = await req.json() as { url?: string; formatId?: string };
  const { url, formatId } = body;

  if (!url || typeof url !== "string" || !url.startsWith("http")) {
    return Response.json({ error: "Geçerli bir URL girin" }, { status: 400 });
  }

  const fmt = formatId ? getDownloadFormat(formatId) : undefined;
  if (!fmt) {
    return Response.json({ error: "Geçersiz format seçimi" }, { status: 400 });
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
      { error: "Şu an başka bir indirme devam ediyor, lütfen bekleyin" },
      { status: 409 }
    );
  }

  const [record] = await db
    .insert(downloads)
    .values({ userId: session.user.id, url, format: fmt.id, status: "pending" })
    .returning({ id: downloads.id });

  const namePrefix = `${record.id}_`;
  const result = await metubeAdd(url, fmt.quality, fmt.format, namePrefix);

  if (!result.added) {
    await db
      .update(downloads)
      .set({ status: "error", errorMessage: result.error ?? "metube hatası" })
      .where(eq(downloads.id, record.id));
    return Response.json(
      { error: result.error ?? "İndirme başlatılamadı" },
      { status: 502 }
    );
  }

  await db
    .update(downloads)
    .set({ status: "downloading", metubeId: url })
    .where(eq(downloads.id, record.id));

  return Response.json({ id: record.id }, { status: 201 });
}
