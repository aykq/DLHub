import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { downloads } from "@/db/schema";
import { eq } from "drizzle-orm";
import { cancelDownload } from "@/lib/ytdlp-download";
import { unlink } from "fs/promises";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const download = await db.query.downloads.findFirst({
    where: eq(downloads.id, id),
    columns: { id: true, url: true, filePath: true, status: true },
  });

  if (!download) return Response.json({ error: "Bulunamadı" }, { status: 404 });

  if (download.status === "downloading" || download.status === "pending") {
    cancelDownload(download.id);
  }

  if (download.filePath) {
    try {
      await unlink(download.filePath);
    } catch { /* dosya zaten silinmiş olabilir */ }
  }

  await db.update(downloads).set({ status: "expired" }).where(eq(downloads.id, id));
  return Response.json({ ok: true });
}
