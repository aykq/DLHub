import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";

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
    })
    .from(downloads)
    .leftJoin(users, eq(downloads.userId, users.id))
    .orderBy(desc(downloads.createdAt))
    .limit(100);

  return Response.json(
    rows.map((dl) => ({
      ...dl,
      createdAt: dl.createdAt.toISOString(),
      expiresAt: dl.expiresAt?.toISOString() ?? null,
    }))
  );
}
