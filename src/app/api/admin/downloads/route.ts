import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { createDownloadToken } from "@/lib/download-token";

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
