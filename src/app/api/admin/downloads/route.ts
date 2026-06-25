import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { createDownloadToken } from "@/lib/download-token";
import { cancelDownload } from "@/lib/ytdlp-download";
import { unlink } from "fs/promises";

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rows = await db
    .select({
      id: downloads.id,
      url: downloads.url,
      title: downloads.title,
      format: downloads.format,
      status: downloads.status,
      fileSize: downloads.fileSize,
      filePath: downloads.filePath,
      expiresAt: downloads.expiresAt,
      createdAt: downloads.createdAt,
      errorMessage: downloads.errorMessage,
      userId: downloads.userId,
      userName: users.name,
      userEmail: users.email,
      duration: downloads.duration,
      videoCodec: downloads.videoCodec,
      audioCodec: downloads.audioCodec,
      width: downloads.width,
      height: downloads.height,
    })
    .from(downloads)
    .leftJoin(users, eq(downloads.userId, users.id))
    .orderBy(desc(downloads.createdAt))
    .limit(100);

  const now = new Date();
  return Response.json(
    rows.map((dl) => ({
      ...dl,
      createdAt: dl.createdAt.toISOString(),
      expiresAt: dl.expiresAt?.toISOString() ?? null,
      token:
        dl.status === "completed" && dl.expiresAt && dl.expiresAt > now
          ? createDownloadToken(dl.id, dl.expiresAt)
          : null,
    }))
  );
}

export async function DELETE(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { ids?: string[] };
  const ids = body.ids;

  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "No IDs provided" }, { status: 400 });
  }

  const rows = await db.query.downloads.findMany({
    where: inArray(downloads.id, ids),
    columns: { id: true, filePath: true, status: true },
  });

  for (const dl of rows) {
    if (dl.status === "downloading" || dl.status === "pending") {
      cancelDownload(dl.id);
    }
    if (dl.filePath) {
      try { await unlink(dl.filePath); } catch { /* already deleted */ }
    }
  }

  await db
    .update(downloads)
    .set({ status: "expired" })
    .where(inArray(downloads.id, ids));

  return Response.json({ ok: true, deleted: rows.length });
}
