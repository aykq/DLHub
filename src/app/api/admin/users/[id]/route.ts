import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json() as { status?: string; role?: string };

  const updates: Record<string, string> = {};
  if (body.status && ["pending", "approved", "blocked"].includes(body.status)) {
    updates.status = body.status;
  }
  if (body.role && ["user", "admin"].includes(body.role)) {
    updates.role = body.role;
  }

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: "Geçersiz güncelleme" }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, id));
  return Response.json({ ok: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === adminId) {
    return Response.json({ error: "Kendinizi silemezsiniz" }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, id));
  return Response.json({ ok: true });
}
