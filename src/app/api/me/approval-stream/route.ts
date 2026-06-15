import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { addUserSseClient, removeUserSseClient } from "@/lib/notifications";
import { getPendingUserId } from "@/lib/pending-cookie";

export const dynamic = "force-dynamic";

export async function GET() {
  // JWT session (Google OAuth veya approved magic link kullanıcısı)
  let userId: string | null = null;

  const session = await auth();
  if (session?.user?.id) {
    userId = session.user.id;
  } else {
    userId = await getPendingUserId();
  }

  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: { status: true },
  });

  if (!user || user.status !== "pending") {
    return Response.json({ error: "Not pending" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  let ctrl: ReadableStreamDefaultController;

  const stream = new ReadableStream({
    start(c) {
      ctrl = c;
      addUserSseClient(userId!, ctrl);
      c.enqueue(encoder.encode(": connected\n\n"));

      const heartbeat = setInterval(() => {
        try {
          c.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      (ctrl as ReadableStreamDefaultController & { _hb?: ReturnType<typeof setInterval> })._hb = heartbeat;
    },
    cancel() {
      const hb = (ctrl as ReadableStreamDefaultController & { _hb?: ReturnType<typeof setInterval> })._hb;
      if (hb) clearInterval(hb);
      removeUserSseClient(userId!, ctrl);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
