// Dinamik format ID'sini çözer: "1080_mp4" → {quality: "1080", format: "mp4"}
// Kabul edilen pattern: (rakam|"best")_(mp4|mp3|mkv|webm)
export function parseFormatId(id: string): { quality: string; format: string } | null {
  const match = id.match(/^(\d+|best)_(mp4|mp3|mkv|webm)$/);
  if (!match) return null;
  return { quality: match[1], format: match[2] };
}
