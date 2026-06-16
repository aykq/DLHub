import { auth } from "@/lib/auth";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProgress, removeFromStore, getFileSize } from "@/lib/ytdlp-download";
import { createDownloadToken } from "@/lib/download-token";
import { sendDownloadCompleteDiscordNotification } from "@/lib/discord";
import { createNotification, broadcastNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

const POLL_INTERVAL_MS = 2000;
const KEEPALIVE_INTERVAL_MS = 25_000;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const download = await db.query.downloads.findFirst({
    where: eq(downloads.id, id),
    columns: {
      id: true,
      userId: true,
      url: true,
      format: true,
      status: true,
      title: true,
      expiresAt: true,
    },
  });

  if (!download) return new Response("Not found", { status: 404 });

  if (download.userId !== session.user.id) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { role: true },
    });
    if (dbUser?.role !== "admin") return new Response("Forbidden", { status: 403 });
  }

  const encoder = new TextEncoder();

  function makeEvent(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  if (
    download.status === "completed" ||
    download.status === "error" ||
    download.status === "expired"
  ) {
    let token: string | null = null;
    if (download.status === "completed" && download.expiresAt && download.expiresAt > new Date()) {
      token = createDownloadToken(id, download.expiresAt);
    }
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(makeEvent({ status: download.status, token }));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      function send(data: object) {
        try { controller.enqueue(makeEvent(data)); } catch { cleanup(); }
      }

      function cleanup() {
        if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; }
      }

      function close(data?: object) {
        cleanup();
        if (data) { try { controller.enqueue(makeEvent(data)); } catch { /* closed */ } }
        try { controller.close(); } catch { /* already closed */ }
      }

      keepAliveTimer = setInterval(() => {
        try { controller.enqueue(encoder.encode(": ping\n\n")); } catch { cleanup(); }
      }, KEEPALIVE_INTERVAL_MS);

      pollTimer = setInterval(async () => {
        try {
          const prog = getProgress(id);

          if (!prog) {
            // Not in store — check DB (completed before SSE connected, or server restart)
            const current = await db.query.downloads.findFirst({
              where: eq(downloads.id, id),
              columns: { status: true, expiresAt: true },
            });
            if (current?.status === "completed" && current.expiresAt) {
              close({ status: "completed", token: createDownloadToken(id, current.expiresAt) });
            } else {
              close({ status: current?.status ?? "error" });
            }
            return;
          }

          if (prog.status === "pending" || prog.status === "downloading") {
            send({
              status: "downloading",
              percent: prog.percent,
              speed: prog.speed,
              eta: prog.eta,
              title: prog.title,
            });
            return;
          }

          if (prog.status === "finished") {
            // Avoid double-processing if another SSE client already finalized
            const current = await db.query.downloads.findFirst({
              where: eq(downloads.id, id),
              columns: { status: true, expiresAt: true },
            });
            if (current?.status === "completed" && current.expiresAt) {
              removeFromStore(id);
              close({ status: "completed", token: createDownloadToken(id, current.expiresAt) });
              return;
            }

            const filePath = prog.filename ?? null;
            const expiryHours = parseInt(process.env.DOWNLOAD_EXPIRY_HOURS ?? "24");
            const expiresAt = new Date(Date.now() + expiryHours * 3600 * 1000);
            const fileSize = filePath ? await getFileSize(filePath) : null;

            await db.update(downloads).set({
              status: "completed",
              title: prog.title ?? null,
              filePath: filePath ?? null,
              fileSize,
              expiresAt,
            }).where(eq(downloads.id, id));

            const token = createDownloadToken(id, expiresAt);

            try {
              const userRecord = await db.query.users.findFirst({
                where: eq(users.id, download.userId),
                columns: { name: true },
              });
              const msg = `İndirme tamamlandı: ${prog.title ?? download.url}`;
              await Promise.all([
                sendDownloadCompleteDiscordNotification({
                  userId: download.userId,
                  userName: userRecord?.name ?? null,
                  title: prog.title ?? null,
                  format: download.format,
                  fileSize,
                }),
                createNotification("download_complete", msg, download.userId),
              ]);
              broadcastNotification({
                type: "download_complete",
                message: msg,
                userId: download.userId,
                createdAt: new Date().toISOString(),
              });
            } catch { /* bildirim hatası critical değil */ }

            removeFromStore(id);
            close({ status: "completed", token, title: prog.title });
            return;
          }

          if (prog.status === "error") {
            await db.update(downloads).set({
              status: "error",
              errorMessage: prog.error ?? "Bilinmeyen hata",
            }).where(eq(downloads.id, id));
            removeFromStore(id);
            close({ status: "error", error: prog.error });
          }
        } catch (err) {
          console.error("[progress SSE] poll error:", err);
        }
      }, POLL_INTERVAL_MS);
    },

    cancel() {
      if (pollTimer) clearInterval(pollTimer);
      if (keepAliveTimer) clearInterval(keepAliveTimer);
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
