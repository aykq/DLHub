import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

interface RawFormat {
  ext: string;
  height: number | null;
  vcodec: string;
  acodec: string;
}

interface RawInfo {
  title: string;
  duration: number | null;
  thumbnail: string | null;
  formats: RawFormat[];
}

export interface VideoFormat {
  id: string;
  label: string;
  quality: string;
  format: string;
  height: number | null;
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

  const heights = new Set<number>();
  for (const fmt of info.formats ?? []) {
    if (fmt.vcodec && fmt.vcodec !== "none" && fmt.height && fmt.height > 0) {
      heights.add(fmt.height);
    }
  }

  const sorted = Array.from(heights).sort((a, b) => b - a);

  const formats: VideoFormat[] = sorted.map((h) => ({
    id: `${h}_mp4`,
    label: HEIGHT_LABELS[h] ? `${HEIGHT_LABELS[h]} — MP4` : `${h}p — MP4`,
    quality: String(h),
    format: "mp4",
    height: h,
  }));

  formats.push({
    id: "0_mp3",
    label: "MP3 (Ses Sadece)",
    quality: "0",
    format: "mp3",
    height: null,
  });

  return {
    formats,
    title: info.title,
    thumbnail: info.thumbnail ?? null,
    duration: info.duration ?? null,
  };
}
