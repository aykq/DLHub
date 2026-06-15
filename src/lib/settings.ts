import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const DEFAULTS: Record<string, string> = {
  daily_download_limit: "10",
  whitelist_domains: "",
};

export async function getSetting(key: string): Promise<string> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) });
  return row?.value ?? DEFAULTS[key] ?? "";
}
