import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPendingUserId } from "@/lib/pending-cookie";

export async function GET() {
  let userId: string | null = null;

  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    userId = await getPendingUserId();
  }

  if (!userId) {
    return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { status: true },
  });

  return NextResponse.json({ status: user?.status ?? "unknown" });
}
