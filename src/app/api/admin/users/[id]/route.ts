import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";
import { broadcastUserStatus, broadcastNotification } from "@/lib/notifications";
import { signIn } from "@/lib/auth";
import { sendUnblockedEmail } from "@/lib/email";

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

  // Status değişikliği varsa güncelleme öncesi mevcut durumu al
  let previousStatus: string | undefined;
  let userEmail: string | undefined;
  if (updates.status === "approved") {
    const current = await db.query.users.findFirst({
      where: eq(users.id, id),
      columns: { status: true, email: true },
    });
    previousStatus = current?.status;
    userEmail = current?.email ?? undefined;
  }

  await db.update(users).set(updates).where(eq(users.id, id));

  if (updates.status) {
    broadcastUserStatus(id, { status: updates.status });
    broadcastNotification({
      type: `user_${updates.status}`,
      message: `Kullanıcı durumu güncellendi: ${updates.status}`,
      userId: id,
      createdAt: new Date().toISOString(),
    });

    if (updates.status === "approved" && userEmail) {
      try {
        if (previousStatus === "pending") {
          // İlk onay: magic link emaili gönder
          await signIn("nodemailer", {
            email: userEmail,
            redirect: false,
            callbackUrl: "/",
          });
        } else if (previousStatus === "blocked") {
          // Engel kaldırma: bilgilendirme emaili gönder (magic link değil)
          await sendUnblockedEmail(userEmail);
        }
      } catch (err) {
        console.error("Status email failed:", err);
      }
    }
  }

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
  broadcastUserStatus(id, { status: "deleted" });
  return Response.json({ ok: true });
}
