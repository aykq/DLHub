import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/auth";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendSignInDiscordNotification } from "@/lib/discord";
import { createNotification, broadcastNotification } from "@/lib/notifications";
import { setPendingCookie } from "@/lib/pending-cookie";
import { checkRateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email() });

const HOUR_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  // IP bazlı rate limit (Cloudflare Tunnel arkasında CF-Connecting-IP güvenilir)
  const ip =
    req.headers.get("CF-Connecting-IP") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";

  const ipCheck = checkRateLimit(`ip:${ip}`, 20, HOUR_MS);
  if (!ipCheck.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: ipCheck.retryAfterSeconds },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const email = parsed.data.email;

  // Email bazlı rate limit
  const emailCheck = checkRateLimit(`email:${email}`, 5, HOUR_MS);
  if (!emailCheck.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: emailCheck.retryAfterSeconds },
      { status: 429 }
    );
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { id: true, status: true },
  });

  // Blocklı kullanıcı
  if (existing?.status === "blocked") {
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  }

  // Onaylı kullanıcı — magic link emaili gönder, pending ekranı gösterme
  if (existing?.status === "approved") {
    await signIn("nodemailer", { email, redirect: false, callbackUrl: "/" });
    return NextResponse.json({ ok: true, status: "email-sent" });
  }

  // Yeni veya pending kullanıcı — email gönderme, cookie set et
  const isAdmin = email === process.env.ADMIN_EMAIL;

  let userId: string;
  if (!existing) {
    const [newUser] = await db
      .insert(users)
      .values({
        email,
        status: isAdmin ? "approved" : "pending",
        role: isAdmin ? "admin" : "user",
      })
      .returning({ id: users.id });
    userId = newUser.id;

    // Admin emaili ise direkt magic link gönder
    if (isAdmin) {
      await signIn("nodemailer", { email, redirect: false, callbackUrl: "/" });
      return NextResponse.json({ ok: true, status: "email-sent" });
    }

    // Yeni kullanıcı — Discord + in-app bildirim
    const message = `Yeni kullanıcı onay bekliyor: ${email}`;
    try {
      await Promise.all([
        sendSignInDiscordNotification({
          userId,
          name: null,
          email,
          provider: "nodemailer",
          image: null,
          isNewUser: true,
          signedInAt: new Date(),
        }),
        createNotification("new_user", message, userId),
      ]);
      broadcastNotification({
        type: "new_user",
        message,
        userId,
        email,
        isNewUser: true,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Signup notification failed:", err);
    }
  } else {
    // Mevcut pending kullanıcı
    userId = existing.id;
  }

  // Pending cookie set et, email gönderme
  const res = NextResponse.json({ ok: true, status: "pending" });
  setPendingCookie(res, userId);
  return res;
}
