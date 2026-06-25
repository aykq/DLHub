import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getVideoInfo } from "@/lib/yt-dlp";
import { type NextRequest } from "next/server";

const rateLimitMap = new Map<string, number[]>();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 8;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const prev = (rateLimitMap.get(userId) ?? []).filter(t => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_MAX) return false;
  rateLimitMap.set(userId, [...prev, now]);
  return true;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true },
  });
  if (dbUser?.status !== "approved") {
    return Response.json({ error: "Account not approved" }, { status: 403 });
  }

  if (!checkRateLimit(session.user.id)) {
    return Response.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }

  const url = req.nextUrl.searchParams.get("url");
  if (!url || !url.startsWith("http")) {
    return Response.json({ error: "Enter a valid URL" }, { status: 400 });
  }

  try {
    const result = await getVideoInfo(url);
    return Response.json(result);
  } catch (err) {
    console.error("[formats] yt-dlp error:", err);
    return Response.json(
      { error: "Could not fetch video info. Is the URL supported?" },
      { status: 422 }
    );
  }
}
