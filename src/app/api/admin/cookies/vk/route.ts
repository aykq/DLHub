import { requireAdmin } from "@/lib/admin-guard";
import { mkdir, writeFile, stat } from "fs/promises";
import path from "path";

const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH ?? "/downloads";
const COOKIES_DIR = path.join(DOWNLOADS_PATH, "cookies");
const COOKIES_PATH = path.join(COOKIES_DIR, "vk.txt");

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const info = await stat(COOKIES_PATH);
    return Response.json({ exists: true, lastModified: info.mtime.toISOString() });
  } catch {
    return Response.json({ exists: false, lastModified: null });
  }
}

export async function POST(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const content = await (file as File).text();
  if (!content.trim()) {
    return Response.json({ error: "Cookie file is empty" }, { status: 400 });
  }

  await mkdir(COOKIES_DIR, { recursive: true });
  await writeFile(COOKIES_PATH, content, "utf-8");

  return Response.json({ ok: true });
}
