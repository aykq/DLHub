// Format ID'sini çözer: "1080_mp4" veya "1080_mp4_av01" → {quality, format, codec?}
export function parseFormatId(id: string): { quality: string; format: string; codec?: string } | null {
  const match = id.match(/^(\d+|best)_(mp4|mp3|mkv|webm)(?:_(av01|vp09|avc1|hev1|vp08))?$/);
  if (!match) return null;
  return { quality: match[1], format: match[2], codec: match[3] };
}
