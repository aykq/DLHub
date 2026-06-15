import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendSignInDiscordNotification } from "@/lib/discord";
import { createNotification, broadcastNotification } from "@/lib/notifications";

const schema = z.object({ email: z.string().email() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email;

  // Yeni kullanıcıysa hemen pending olarak ekle ve admin'i bilgilendir
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, status: true },
  });

  if (!existing) {
    const isAdmin = email === process.env.ADMIN_EMAIL;
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        status: isAdmin ? "approved" : "pending",
        role: isAdmin ? "admin" : "user",
      })
      .returning({ id: users.id });

    if (!isAdmin) {
      const message = `Yeni kullanıcı onay bekliyor: ${email} (magic link)`;
      try {
        await Promise.all([
          sendSignInDiscordNotification({
            userId: newUser.id,
            name: null,
            email,
            provider: "nodemailer",
            image: null,
            isNewUser: true,
            signedInAt: new Date(),
          }),
          createNotification("new_user", message, newUser.id),
        ]);
        broadcastNotification({
          type: "new_user",
          message,
          userId: newUser.id,
          email,
          isNewUser: true,
          createdAt: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Magic link pre-create notification failed:", err);
      }
    }
  }

  await signIn("nodemailer", { email, redirect: false, callbackUrl: "/pending" });
  return NextResponse.json({ ok: true });
}
