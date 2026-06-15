import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { users, downloads } from "@/db/schema";
import { eq, or, count } from "drizzle-orm";
import { readdir, stat } from "fs/promises";
import path from "path";

const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH ?? "/downloads";

async function getDiskUsage(): Promise<number | null> {
  try {
    const files = await readdir(DOWNLOADS_PATH);
    let total = 0;
    await Promise.all(
      files.map(async (file) => {
        try {
          const st = await stat(path.join(DOWNLOADS_PATH, file));
          if (st.isFile()) total += st.size;
        } catch { /* skip */ }
      })
    );
    return total;
  } catch {
    return null;
  }
}

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [
    [{ total: totalUsers }],
    [{ total: pendingUsers }],
    [{ total: activeDownloads }],
    diskUsage,
  ] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(users).where(eq(users.status, "pending")),
    db
      .select({ total: count() })
      .from(downloads)
      .where(or(eq(downloads.status, "downloading"), eq(downloads.status, "pending"))),
    getDiskUsage(),
  ]);

  return Response.json({ totalUsers, pendingUsers, activeDownloads, diskUsage });
}
