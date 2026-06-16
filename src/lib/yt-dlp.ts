import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface RawFormat {
  ext: string;
  height: number | null;
  vcodec: string;
  acodec: string;
  filesize?: number | null;
  filesize_approx?: number | null;
  tbr?: number | null;
}

interface RawInfo {
  title: string;
  duration: number | null;
  thumbnail: string | null;
  formats: RawFormat[];
}

export interface FormatVariant {
  codec: string;
  codecId: string;
  filesize: number | null;
  tbr: number | null;
}

export interface VideoFormat {
  id: string;
  label: string;
  quality: string;
  format: string;
  height: number | null;
  variants: FormatVariant[];
}

const HEIGHT_LABELS: Record<number, string> = {
  4320: "8K (4320p)",
  2160: "4K (2160p)",
  1440: "2K (1440p)",
  1080: "1080p (Full HD)",
  720: "720p (HD)",
  480: "480p",
  360: "360p",
  240: "240p",
  144: "144p",
};

const CODEC_ORDER = ["AV1", "VP9", "AVC", "HEVC", "VP8"];

function codecName(vcodec: string): string {
  if (!vcodec || vcodec === "none") return "Other";
  if (vcodec.startsWith("av01")) return "AV1";
  if (vcodec.startsWith("vp09") || vcodec.startsWith("vp9")) return "VP9";
  if (vcodec.startsWith("avc1") || vcodec.startsWith("h264")) return "AVC";
  if (vcodec.startsWith("hev1") || vcodec.startsWith("hvc1")) return "HEVC";
  if (vcodec.startsWith("vp08") || vcodec.startsWith("vp8")) return "VP8";
  return vcodec.split(".")[0].toUpperCase();
}

function codecId(vcodec: string): string {
  if (vcodec.startsWith("av01")) return "av01";
  if (vcodec.startsWith("vp09") || vcodec.startsWith("vp9")) return "vp09";
  if (vcodec.startsWith("avc1") || vcodec.startsWith("h264")) return "avc1";
  if (vcodec.startsWith("hev1") || vcodec.startsWith("hvc1")) return "hev1";
  if (vcodec.startsWith("vp08") || vcodec.startsWith("vp8")) return "vp08";
  return vcodec.split(".")[0].toLowerCase();
}

export async function getVideoInfo(url: string): Promise<{
  formats: VideoFormat[];
  title: string;
  thumbnail: string | null;
  duration: number | null;
}> {
  const { stdout } = await execFileAsync(
    "yt-dlp",
    ["-j", "--no-playlist", "--socket-timeout", "30", url],
    { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 }
  );

  const info = JSON.parse(stdout) as RawInfo;

  // height → codec → en iyi (en büyük boyutlu) varyant
  const heightMap = new Map<number, Map<string, FormatVariant>>();

  for (const fmt of info.formats ?? []) {
    if (!fmt.vcodec || fmt.vcodec === "none") continue;
    if (!fmt.height || fmt.height <= 0) continue;

    const name = codecName(fmt.vcodec);
    const cid = codecId(fmt.vcodec);
    const filesize = fmt.filesize ?? fmt.filesize_approx ?? null;
    const tbr = fmt.tbr ?? null;

    if (!heightMap.has(fmt.height)) heightMap.set(fmt.height, new Map());
    const codecMap = heightMap.get(fmt.height)!;

    const existing = codecMap.get(name);
    if (!existing || (filesize && (!existing.filesize || filesize > existing.filesize))) {
      codecMap.set(name, { codec: name, codecId: cid, filesize, tbr });
    }
  }

  const sorted = Array.from(heightMap.keys()).sort((a, b) => b - a);

  const formats: VideoFormat[] = sorted.map((h) => {
    const codecMap = heightMap.get(h)!;
    const variants = Array.from(codecMap.values()).sort(
      (a, b) =>
        (CODEC_ORDER.indexOf(a.codec) + 1 || 99) -
        (CODEC_ORDER.indexOf(b.codec) + 1 || 99)
    );
    return {
      id: `${h}_mp4`,
      label: HEIGHT_LABELS[h] ? `${HEIGHT_LABELS[h]} — MP4` : `${h}p — MP4`,
      quality: String(h),
      format: "mp4",
      height: h,
      variants,
    };
  });

  formats.push({
    id: "0_mp3",
    label: "MP3 (Ses Sadece)",
    quality: "0",
    format: "mp3",
    height: null,
    variants: [],
  });

  return {
    formats,
    title: info.title,
    thumbnail: info.thumbnail ?? null,
    duration: info.duration ?? null,
  };
}
