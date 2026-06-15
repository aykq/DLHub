import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc } from "drizzle-orm";
import { type NextRequest } from "next/server";

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const items = await db.query.notifications.findMany({
    orderBy: [desc(notifications.createdAt)],
    limit: 50,
  });

  return Response.json(
    items.map((n) => ({
      ...n,
      createdAt: n.createdAt.toISOString(),
      read: n.read === "true",
    }))
  );
}

export async function POST(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as { action?: string };
  if (body.action === "mark-all-read") {
    await db.update(notifications).set({ read: "true" });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Geçersiz aksiyon" }, { status: 400 });
}
