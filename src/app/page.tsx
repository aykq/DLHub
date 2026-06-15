import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users, downloads } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import { Navbar } from "@/components/layout/Navbar";
import { DownloadForm } from "@/components/download/DownloadForm";
import { DownloadHistory, type DownloadRecord } from "@/components/download/DownloadHistory";
import { StatusMonitor } from "@/components/StatusMonitor";
import { createDownloadToken } from "@/lib/download-token";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true, role: true },
  });

  if (!dbUser) redirect("/force-signout");
  if (dbUser.status === "pending") redirect("/pending");
  if (dbUser.status === "blocked") redirect("/blocked");

  const userDownloads = await db.query.downloads.findMany({
    where: eq(downloads.userId, session.user.id),
    orderBy: [desc(downloads.createdAt)],
    limit: 50,
  });

  const now = new Date();

  const activeDownload = userDownloads.find(
    (dl) => dl.status === "downloading" || dl.status === "pending"
  );

  const initialDownloads: DownloadRecord[] = userDownloads.map((dl) => ({
    id: dl.id,
    url: dl.url,
    title: dl.title,
    format: dl.format,
    status: dl.status,
    fileSize: dl.fileSize,
    expiresAt: dl.expiresAt?.toISOString() ?? null,
    createdAt: dl.createdAt.toISOString(),
    token:
      dl.status === "completed" && dl.expiresAt && dl.expiresAt > now
        ? createDownloadToken(dl.id, dl.expiresAt)
        : null,
  }));

  return (
    <>
      <Navbar />
      <StatusMonitor />
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-4">
        <DownloadForm
          activeDownloadId={activeDownload?.id ?? null}
          activeDownloadTitle={activeDownload?.title ?? null}
        />
        <DownloadHistory initialDownloads={initialDownloads} />
      </main>
    </>
  );
}
