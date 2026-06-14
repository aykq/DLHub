const METUBE_URL = process.env.METUBE_URL ?? "http://metube:8081";

export interface MetubeItem {
  url: string;
  quality: string;
  status: "pending" | "downloading" | "finished" | "error";
  percent: number;
  speed: string | null;
  eta: string | null;
  filename: string | null;
  title: string | null;
  error: string | null;
  timestamp: number;
}

export async function metubeAdd(
  url: string,
  quality: string,
  format: string,
  namePrefix: string
): Promise<{ added: boolean; error?: string }> {
  try {
    const res = await fetch(`${METUBE_URL}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        quality,
        format,
        custom_name_prefix: namePrefix,
        auto_start: true,
      }),
    });
    if (!res.ok) return { added: false, error: `metube HTTP ${res.status}` };
    return res.json();
  } catch (err) {
    return { added: false, error: String(err) };
  }
}

export async function metubeQueue(): Promise<Record<string, MetubeItem>> {
  try {
    const res = await fetch(`${METUBE_URL}/queue`, { cache: "no-store" });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function metubeDone(): Promise<Record<string, MetubeItem>> {
  try {
    const res = await fetch(`${METUBE_URL}/done`, { cache: "no-store" });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function metubeFindByUrl(
  url: string,
  downloadIdPrefix?: string
): Promise<{ key: string; item: MetubeItem; inDone: boolean } | null> {
  const [queue, done] = await Promise.all([metubeQueue(), metubeDone()]);

  for (const [key, item] of Object.entries(queue)) {
    if (item.url !== url) continue;
    if (downloadIdPrefix && item.filename && !item.filename.startsWith(downloadIdPrefix)) continue;
    return { key, item, inDone: false };
  }
  for (const [key, item] of Object.entries(done)) {
    if (item.url !== url) continue;
    if (downloadIdPrefix && item.filename && !item.filename.startsWith(downloadIdPrefix)) continue;
    return { key, item, inDone: true };
  }
  return null;
}

export async function metubeDeleteFromQueue(keys: string[]) {
  try {
    await fetch(`${METUBE_URL}/queue`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: keys }),
    });
  } catch {
    // ignore
  }
}
