export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export const VCODEC_NAMES: Record<string, string> = {
  av01: "AV1", vp09: "VP9", avc1: "H.264", hev1: "HEVC", vp08: "VP8",
};

export function formatLabel(id: string): string {
  const match = id.match(/^(\d+|best)_(mp4|mp3|mkv|webm)(?:_(av01|vp09|avc1|hev1|vp08))?(?:_(aac|opus))?$/);
  if (!match) return id;
  const [, quality, ext, vcodec, acodec] = match;
  if (ext === "mp3") return "MP3";
  const parts: string[] = [quality === "best" ? "Best" : `${quality}p`, ext.toUpperCase()];
  if (vcodec) parts.push(VCODEC_NAMES[vcodec] ?? vcodec.toUpperCase());
  if (acodec) parts.push(acodec.toUpperCase());
  return parts.join(" · ");
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 40);
  }
}
