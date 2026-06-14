import { auth } from "@/lib/auth";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { metubeFindByUrl, metubeDeleteFromQueue } from "@/lib/metube";
import { createDownloadToken } from "@/lib/download-token";
import { unlink } from "fs/promises";

async function requireAccess(downloadUserId: string, sessionUserId: string): Promise<boolean> {
  if (downloadUserId === sessionUserId) return true;
  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, sessionUserId),
    columns: { role: true },
  });
  return dbUser?.role === "admin";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const download = await db.query.downloads.findFirst({
    where: eq(downloads.id, id),
  });

  if (!download) return Response.json({ error: "Bulunamadı" }, { status: 404 });
  if (!await requireAccess(download.userId, session.user.id)) {
    return Response.json({ error: "Yetkisiz" }, { status: 403 });
  }

  // Aktif indirme ise metube'yi kontrol ederek durumu güncelle
  if (
    (download.status === "downloading" || download.status === "pending") &&
    download.metubeId
  ) {
    const found = await metubeFindByUrl(download.metubeId, `${id}_`);
    if (found?.item.status === "finished" && found.item.filename) {
      const expiryHours = parseInt(process.env.DOWNLOAD_EXPIRY_HOURS ?? "24");
      const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);
      await db
        .update(downloads)
        .set({
          status: "completed",
          title: found.item.title ?? null,
          filePath: `/downloads/${found.item.filename}`,
          expiresAt,
        })
        .where(eq(downloads.id, id));
      download.status = "completed";
      download.title = found.item.title ?? null;
      download.filePath = `/downloads/${found.item.filename}`;
      download.expiresAt = expiresAt;
    }
  }

  let token: string | null = null;
  if (
    download.status === "completed" &&
    download.expiresAt &&
    download.expiresAt > new Date()
  ) {
    token = createDownloadToken(id, download.expiresAt);
  }

  return Response.json({ ...download, token });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const download = await db.query.downloads.findFirst({
    where: eq(downloads.id, id),
    columns: {
      id: true,
      userId: true,
      status: true,
      metubeId: true,
      filePath: true,
    },
  });

  if (!download) return Response.json({ error: "Bulunamadı" }, { status: 404 });
  if (!await requireAccess(download.userId, session.user.id)) {
    return Response.json({ error: "Yetkisiz" }, { status: 403 });
  }

  // Aktif indirmeyi metube'den iptal et
  if (
    download.metubeId &&
    (download.status === "downloading" || download.status === "pending")
  ) {
    const found = await metubeFindByUrl(download.metubeId, `${id}_`);
    if (found && !found.inDone) {
      await metubeDeleteFromQueue([found.key]);
    }
  }

  // Dosyayı diskten sil
  if (download.filePath) {
    try {
      await unlink(download.filePath);
    } catch {
      // dosya zaten silinmiş olabilir
    }
  }

  await db
    .update(downloads)
    .set({ status: "expired", filePath: null })
    .where(eq(downloads.id, id));

  return Response.json({ ok: true });
}
