import { db } from "@/db";
import { users, downloads, settings } from "@/db/schema";
import { desc, asc, eq, or } from "drizzle-orm";
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
  const [allUsers, allDownloads, diskUsage, allSettings] = await Promise.all([
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
  ]);

  const pendingCount = allUsers.filter((u) => u.status === "pending").length;
  const activeCount = allDownloads.filter(
    (dl) => dl.status === "downloading" || dl.status === "pending"
  ).length;

  const settingsMap = Object.fromEntries(allSettings.map((s) => [s.key, s.value]));

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
  }));

  const initialDownloads: AdminDownload[] = allDownloads.map((dl) => ({
    ...dl,
    createdAt: dl.createdAt.toISOString(),
    expiresAt: dl.expiresAt?.toISOString() ?? null,
  }));

  return (
    <main className="flex-1 w-full">
      <PageTransitionWrapper>
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <AdminDashboard
          initialStats={stats}
          initialUsers={initialUsers}
          initialDownloads={initialDownloads}
          initialSettings={{
            daily_download_limit: settingsMap.daily_download_limit ?? "10",
            whitelist_domains: settingsMap.whitelist_domains ?? "",
          }}
        />
      </div>
      </PageTransitionWrapper>
    </main>
  );
}
