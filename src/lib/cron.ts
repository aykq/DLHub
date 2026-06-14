import cron from "node-cron";
import { lt, eq } from "drizzle-orm";
import { db } from "@/db";
import { downloads } from "@/db/schema";
import { unlink } from "fs/promises";

// Saatlik dosya temizliği — süresi dolan indirmeleri diskten ve DB'den sil
cron.schedule(
  "0 * * * *",
  async () => {
    console.log("[cron] cleanup started");
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
      }

      if (expired.length > 0) {
        console.log(`[cron] cleanup: ${expired.length} expired download(s) removed`);
      }
    } catch (err) {
      console.error("[cron] cleanup error:", err);
    }
  },
  { timezone: "UTC" }
);

console.log("[cron] scheduled: cleanup @every hour");
