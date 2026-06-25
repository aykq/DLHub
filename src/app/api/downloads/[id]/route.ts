import { auth } from "@/lib/auth";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProgress, removeFromStore, cancelDownload } from "@/lib/ytdlp-download";
import { createDownloadToken } from "@/lib/download-token";
import { readdir, unlink } from "fs/promises";
import path from "path";
import { getSetting } from "@/lib/settings";

const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH ?? "/downloads";

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

  // İndirme tamamlandıysa ama DB henüz güncellenmemişse güncelle
  if (download.status === "downloading" || download.status === "pending") {
    const prog = getProgress(id);
    if (prog?.status === "finished" && prog.filename) {
      const expiryHours = parseInt(await getSetting("download_expiry_hours"));
      const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);
      await db
        .update(downloads)
        .set({
          status: "completed",
          title: prog.title ?? null,
          filePath: prog.filename,
          expiresAt,
        })
        .where(eq(downloads.id, id));
      download.status = "completed";
      download.title = prog.title ?? null;
      download.filePath = prog.filename;
      download.expiresAt = expiresAt;
      removeFromStore(id);
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
      filePath: true,
    },
  });

  if (!download) return Response.json({ error: "Bulunamadı" }, { status: 404 });
  if (!await requireAccess(download.userId, session.user.id)) {
    return Response.json({ error: "Yetkisiz" }, { status: 403 });
  }

  const isActive = download.status === "downloading" || download.status === "pending";

  if (isActive) {
    cancelDownload(id);

    try {
      const files = await readdir(DOWNLOADS_PATH);
      await Promise.all(
        files
          .filter((f) => f.startsWith(`${id}_`))
          .map((f) =>
            unlink(path.join(DOWNLOADS_PATH, f)).catch(() => {})
          )
      );
    } catch { }

    await db.update(downloads).set({ status: "cancelled", filePath: null }).where(eq(downloads.id, id));
    return Response.json({ ok: true });
  }

  if (download.filePath) {
    try { await unlink(download.filePath); } catch { }
  }

  await db
    .update(downloads)
    .set({ status: "expired", filePath: null })
    .where(eq(downloads.id, id));

  return Response.json({ ok: true });
}
