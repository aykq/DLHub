import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { addUserSseClient, removeUserSseClient } from "@/lib/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const userId = session.user.id;
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
      addUserSseClient(userId, ctrl);
      c.enqueue(encoder.encode(": connected\n\n"));

      // Heartbeat every 25s to keep connection alive through proxies
      const heartbeat = setInterval(() => {
        try {
          c.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25000);

      // Store cleanup ref on controller via closure
      (ctrl as ReadableStreamDefaultController & { _hb?: ReturnType<typeof setInterval> })._hb = heartbeat;
    },
    cancel() {
      const hb = (ctrl as ReadableStreamDefaultController & { _hb?: ReturnType<typeof setInterval> })._hb;
      if (hb) clearInterval(hb);
      removeUserSseClient(userId, ctrl);
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
