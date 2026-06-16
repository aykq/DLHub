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

interface MetubeHistoryResponse {
  done: MetubeItem[];
  queue: MetubeItem[];
  pending: MetubeItem[];
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
    const data = await res.json() as { status?: string; added?: boolean; error?: string };
    if (data.status === "ok" || data.added === true) return { added: true };
    return { added: false, error: data.error ?? "metube yanıt hatası" };
  } catch (err) {
    return { added: false, error: String(err) };
  }
}

async function metubeHistory(): Promise<MetubeHistoryResponse> {
  try {
    const res = await fetch(`${METUBE_URL}/history`, { cache: "no-store" });
    if (!res.ok) return { done: [], queue: [], pending: [] };
    return res.json() as Promise<MetubeHistoryResponse>;
  } catch {
    return { done: [], queue: [], pending: [] };
  }
}

export async function metubeFindByUrl(
  url: string,
  downloadIdPrefix?: string
): Promise<{ key: string; item: MetubeItem; inDone: boolean } | null> {
  const history = await metubeHistory();

  const toList = (v: unknown): MetubeItem[] =>
    Array.isArray(v) ? (v as MetubeItem[]) : Object.values((v ?? {}) as Record<string, MetubeItem>);

  const candidates: Array<{ item: MetubeItem; inDone: boolean }> = [
    ...toList(history.queue).map(item => ({ item, inDone: false })),
    ...toList(history.pending).map(item => ({ item, inDone: false })),
    ...toList(history.done).map(item => ({ item, inDone: true })),
  ];

  for (const { item, inDone } of candidates) {
    if (item.url !== url) continue;
    if (downloadIdPrefix && item.filename && !item.filename.startsWith(downloadIdPrefix)) continue;
    return { key: item.url, item, inDone };
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
