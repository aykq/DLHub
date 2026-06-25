import { auth } from "@/lib/auth";
import { db } from "@/db";
import { downloads, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyDownloadToken } from "@/lib/download-token";
import { createReadStream } from "fs";
import { stat } from "fs/promises";
import path from "path";
import { type NextRequest } from "next/server";

const CHUNK_SIZE = 100 * 1024 * 1024; // 100 MB — Cloudflare uyumlu

function nodeStreamToWeb(nodeStream: ReturnType<typeof createReadStream>): ReadableStream {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk));
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;

  const token = req.nextUrl.searchParams.get("token");
  if (!token) return new Response("Token required", { status: 400 });

  const verified = verifyDownloadToken(token);
  if (!verified || verified.downloadId !== id) {
    return new Response("Invalid or expired link", { status: 401 });
  }

  const download = await db.query.downloads.findFirst({
    where: eq(downloads.id, id),
    columns: { userId: true, status: true, filePath: true, title: true, format: true },
  });

  if (!download || download.status !== "completed" || !download.filePath) {
    return new Response("File not found", { status: 404 });
  }

  if (download.userId !== session.user.id) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { role: true },
    });
    if (dbUser?.role !== "admin") return new Response("Forbidden", { status: 403 });
  }

  let fileStat: Awaited<ReturnType<typeof stat>>;
  try {
    fileStat = await stat(download.filePath);
  } catch {
    return new Response("File no longer available", { status: 410 });
  }

  const fileSize = fileStat.size;
  const ext = path.extname(download.filePath) || ".mp4";
  const safeTitle = (download.title ?? "download")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .trim()
    .slice(0, 100) || "download";
  // filename= param must be Latin-1 (≤255); strip non-ASCII for the fallback
  const asciiTitle = safeTitle.replace(/[^\x00-\x7F]/g, "").trim() || "download";
  const encodedFilename = encodeURIComponent(`${safeTitle}${ext}`);

  const contentDisposition =
    `attachment; filename="${asciiTitle}${ext}"; filename*=UTF-8''${encodedFilename}`;

  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) return new Response("Invalid range", { status: 416 });

    const start = parseInt(match[1], 10);
    const requestedEnd = match[2] ? parseInt(match[2], 10) : undefined;
    const end = Math.min(
      start + CHUNK_SIZE - 1,
      fileSize - 1,
      requestedEnd ?? fileSize - 1
    );

    if (start >= fileSize) {
      return new Response(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const fileStream = createReadStream(download.filePath, { start, end });

    return new Response(nodeStreamToWeb(fileStream), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": "application/octet-stream",
        "Content-Disposition": contentDisposition,
      },
    });
  }

  // Range header yok — dosya 100MB'tan küçükse doğrudan gönder, büyükse ilk chunk
  if (fileSize <= CHUNK_SIZE) {
    const fileStream = createReadStream(download.filePath);
    return new Response(nodeStreamToWeb(fileStream), {
      status: 200,
      headers: {
        "Accept-Ranges": "bytes",
        "Content-Length": fileSize.toString(),
        "Content-Type": "application/octet-stream",
        "Content-Disposition": contentDisposition,
      },
    });
  }

  const end = CHUNK_SIZE - 1;
  const fileStream = createReadStream(download.filePath, { start: 0, end });
  return new Response(nodeStreamToWeb(fileStream), {
    status: 206,
    headers: {
      "Content-Range": `bytes 0-${end}/${fileSize}`,
      "Accept-Ranges": "bytes",
      "Content-Length": CHUNK_SIZE.toString(),
      "Content-Type": "application/octet-stream",
      "Content-Disposition": contentDisposition,
    },
  });
}
