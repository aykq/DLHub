import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { users, downloads } from "@/db/schema";
import { asc, gte, count } from "drizzle-orm";
import { getSetting } from "@/lib/settings";

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const [allUsers, todayDownloads, limitValue] = await Promise.all([
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
      .select({ userId: downloads.userId, total: count() })
      .from(downloads)
      .where(gte(downloads.createdAt, todayStart))
      .groupBy(downloads.userId),
    getSetting("daily_download_limit"),
  ]);

  const todayMap = new Map(todayDownloads.map((r) => [r.userId, r.total]));
  const dailyLimit = parseInt(limitValue, 10) || 0;

  return Response.json(
    allUsers.map((u) => ({
      ...u,
      createdAt: u.createdAt.toISOString(),
      todayCount: todayMap.get(u.id) ?? 0,
      dailyLimit,
    }))
  );
}
