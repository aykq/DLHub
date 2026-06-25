import { db } from "@/db";
import { users, downloads, settings } from "@/db/schema";
import { desc, asc, eq, gte, count } from "drizzle-orm";
import { AdminDashboard, type AdminUser, type AdminDownload, type AdminStats } from "@/components/admin/AdminDashboard";
import { PageTransitionWrapper } from "@/components/layout/PageTransitionWrapper";
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

export default async function AdminPage() {
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [allUsers, allDownloads, diskUsage, allSettings, todayDownloads] = await Promise.all([
    db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.createdAt)),
    db
      .select({
        id: downloads.id,
        url: downloads.url,
        title: downloads.title,
        format: downloads.format,
        status: downloads.status,
        fileSize: downloads.fileSize,
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
      .limit(100),
    getDiskUsage(),
    db.select().from(settings),
    db
      .select({ userId: downloads.userId, total: count() })
      .from(downloads)
      .where(gte(downloads.createdAt, todayStart))
      .groupBy(downloads.userId),
  ]);

  const pendingCount = allUsers.filter((u) => u.status === "pending").length;
  const activeCount = allDownloads.filter(
    (dl) => dl.status === "downloading" || dl.status === "pending"
  ).length;

  const settingsMap = Object.fromEntries(allSettings.map((s) => [s.key, s.value]));
  const dailyLimit = parseInt(settingsMap.daily_download_limit ?? "0", 10) || 0;
  const todayMap = new Map(todayDownloads.map((r) => [r.userId, r.total]));

  const stats: AdminStats = {
    totalUsers: allUsers.length,
    pendingUsers: pendingCount,
    activeDownloads: activeCount,
    diskUsage,
    totalDownloadedBytes: 0,
    platformStats: [],
  };

  const initialUsers: AdminUser[] = allUsers.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
    todayCount: todayMap.get(u.id) ?? 0,
    dailyLimit,
  }));

  const initialDownloads: AdminDownload[] = allDownloads.map((dl) => ({
    ...dl,
    createdAt: dl.createdAt.toISOString(),
    expiresAt: dl.expiresAt?.toISOString() ?? null,
  }));

  return (
    <main className="flex-1 w-full">
      <PageTransitionWrapper>
      <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
        <AdminDashboard
          initialStats={stats}
          initialUsers={initialUsers}
          initialDownloads={initialDownloads}
          initialSettings={{
            daily_download_limit: settingsMap.daily_download_limit ?? "10",
            whitelist_domains: settingsMap.whitelist_domains ?? "",
            download_expiry_hours: settingsMap.download_expiry_hours ?? "24",
            vk_cookies_path: settingsMap.vk_cookies_path ?? "",
          }}
        />
      </div>
      </PageTransitionWrapper>
    </main>
  );
}
