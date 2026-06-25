import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getVideoInfo } from "@/lib/yt-dlp";
import { type NextRequest } from "next/server";

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
