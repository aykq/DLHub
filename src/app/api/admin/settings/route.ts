import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

const DEFAULTS: Record<string, string> = {
  daily_download_limit: "10",
  whitelist_domains: "",
  download_expiry_hours: "24",
};

const SETTING_KEYS = ["daily_download_limit", "whitelist_domains", "download_expiry_hours"];

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const rows = await Promise.all(
    SETTING_KEYS.map((key) => db.query.settings.findFirst({ where: eq(settings.key, key) }))
  );

  return Response.json(
    Object.fromEntries(SETTING_KEYS.map((key, i) => [key, rows[i]?.value ?? DEFAULTS[key]]))
  );
}

export async function PATCH(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Record<string, string>;
  const allowed = SETTING_KEYS;

  for (const key of allowed) {
    if (key in body) {
      await db
        .insert(settings)
        .values({ key, value: body[key] })
        .onConflictDoUpdate({ target: settings.key, set: { value: body[key] } });
    }
  }

  return Response.json({ ok: true });
}
