import { requireAdmin } from "@/lib/admin-guard";
import { runCleanup } from "@/lib/cron";

export async function POST() {
  const adminId = await requireAdmin();
  if (!adminId) return Response.json({ error: "Forbidden" }, { status: 403 });

  try {
    const result = await runCleanup();
    return Response.json({ ok: true, ...result });
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
