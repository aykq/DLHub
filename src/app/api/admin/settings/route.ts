import { requireAdmin } from "@/lib/admin-guard";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { type NextRequest } from "next/server";

const DEFAULTS: Record<string, string> = {
  daily_download_limit: "10",
  whitelist_domains: "",
};

export async function GET() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const [limitRow, whitelistRow] = await Promise.all([
    db.query.settings.findFirst({ where: eq(settings.key, "daily_download_limit") }),
    db.query.settings.findFirst({ where: eq(settings.key, "whitelist_domains") }),
  ]);

  return Response.json({
    daily_download_limit: limitRow?.value ?? DEFAULTS.daily_download_limit,
    whitelist_domains: whitelistRow?.value ?? DEFAULTS.whitelist_domains,
  });
}

export async function PATCH(req: NextRequest) {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json() as Record<string, string>;
  const allowed = ["daily_download_limit", "whitelist_domains"];

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
