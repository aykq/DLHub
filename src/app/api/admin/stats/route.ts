import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { users, downloads } from "@/db/schema";
import { eq, or, count, sum } from "drizzle-orm";
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
    [{ total: totalDownloadedBytes }],
    completedDownloads,
    diskUsage,
  ] = await Promise.all([
    db.select({ total: count() }).from(users),
    db.select({ total: count() }).from(users).where(eq(users.status, "pending")),
    db
      .select({ total: count() })
      .from(downloads)
      .where(or(eq(downloads.status, "downloading"), eq(downloads.status, "pending"))),
    db
      .select({ total: sum(downloads.fileSize) })
      .from(downloads)
      .where(eq(downloads.status, "completed")),
    db
      .select({ url: downloads.url, fileSize: downloads.fileSize })
      .from(downloads)
      .where(eq(downloads.status, "completed")),
    getDiskUsage(),
  ]);

  // Platform bazlı istatistik
  const platformMap = new Map<string, { count: number; bytes: number }>();
  for (const dl of completedDownloads) {
    try {
      const hostname = new URL(dl.url).hostname.replace(/^www\./, "");
      const existing = platformMap.get(hostname) ?? { count: 0, bytes: 0 };
      existing.count++;
      existing.bytes += dl.fileSize ?? 0;
      platformMap.set(hostname, existing);
    } catch { /* skip */ }
  }
  const platformStats = Array.from(platformMap.entries())
    .map(([domain, s]) => ({ domain, count: s.count, bytes: s.bytes }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return Response.json({
    totalUsers,
    pendingUsers,
    activeDownloads,
    diskUsage,
    totalDownloadedBytes: Number(totalDownloadedBytes ?? 0),
    platformStats,
  });
}
