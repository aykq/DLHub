import cron from "node-cron";
import { eq, or, and, lte } from "drizzle-orm";
import { db } from "@/db";
import { downloads } from "@/db/schema";
import { readdir, unlink } from "fs/promises";
import path from "path";

const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH ?? "/downloads";

const STUCK_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 saat

export interface CleanupResult {
  expiredRemoved: number;
  stuckReset: number;
  errors: string[];
}

export async function runCleanup(): Promise<CleanupResult> {
  const result: CleanupResult = { expiredRemoved: 0, stuckReset: 0, errors: [] };

  // 1. Süresi dolan tamamlanmış indirmeleri temizle
  try {
    const expired = await db.query.downloads.findMany({
      where: (d, { and, lte, not }) =>
        and(
          lte(d.expiresAt, new Date()),
          not(eq(d.status, "expired"))
        ),
      columns: { id: true, filePath: true },
    });

    for (const download of expired) {
      if (download.filePath) {
        try {
          await unlink(download.filePath);
        } catch {
          // dosya zaten silinmiş olabilir
        }
      }
      await db
        .update(downloads)
        .set({ status: "expired", filePath: null })
        .where(eq(downloads.id, download.id));
      result.expiredRemoved++;
    }
  } catch (err) {
    result.errors.push(`expired cleanup: ${String(err)}`);
  }

  // 2. 2 saatten uzun süredir takılı kalmış indirmeleri hata olarak işaretle
  try {
    const stuckBefore = new Date(Date.now() - STUCK_THRESHOLD_MS);
    const stuck = await db.query.downloads.findMany({
      where: (d, { and, or, eq, lte }) =>
        and(
          or(eq(d.status, "pending"), eq(d.status, "downloading")),
          lte(d.createdAt, stuckBefore)
        ),
      columns: { id: true },
    });

    let allFiles: string[] = [];
    try { allFiles = await readdir(DOWNLOADS_PATH); } catch { /* ignore */ }

    for (const download of stuck) {
      await db
        .update(downloads)
        .set({ status: "error", filePath: null, errorMessage: "Timed out: download exceeded 2 hours" })
        .where(eq(downloads.id, download.id));

      for (const file of allFiles) {
        if (file.startsWith(`${download.id}_`)) {
          await unlink(path.join(DOWNLOADS_PATH, file)).catch(() => {});
        }
      }

      result.stuckReset++;
    }
  } catch (err) {
    result.errors.push(`stuck cleanup: ${String(err)}`);
  }

  return result;
}

cron.schedule(
  "0 * * * *",
  async () => {
    console.log("[cron] cleanup started");
    try {
      const result = await runCleanup();
      console.log(
        `[cron] cleanup done — expired: ${result.expiredRemoved}, stuck: ${result.stuckReset}` +
          (result.errors.length ? `, errors: ${result.errors.join("; ")}` : "")
      );
    } catch (err) {
      console.error("[cron] cleanup error:", err);
    }
  },
  { timezone: "UTC" }
);

console.log("[cron] scheduled: cleanup @every hour");
