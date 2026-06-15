import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { users } from "@/db/schema";
import { asc } from "drizzle-orm";

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const allUsers = await db
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
    .orderBy(asc(users.createdAt));

  return Response.json(
    allUsers.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }))
  );
}
