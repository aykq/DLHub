import { spawn, execFile, type ChildProcess } from "child_process";
import { readdir, stat } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const DOWNLOADS_PATH = process.env.DOWNLOADS_PATH ?? "/downloads";

export interface DownloadProgress {
  status: "pending" | "downloading" | "finished" | "error";
  percent: number;
  speed: string | null;
  eta: string | null;
  title: string | null;
  filename: string | null;
  error: string | null;
  duration: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width: number | null;
  height: number | null;
}

interface DownloadEntry extends DownloadProgress {
  process: ChildProcess | null;
}

const progressStore = new Map<string, DownloadEntry>();

function buildFormatArgs(quality: string, ext: string, vcodec?: string, acodec?: string): string[] {
  if (quality === "0" || ext === "mp3") {
    return [
      "--format", "bestaudio/best",
      "--extract-audio",
      "--audio-format", "mp3",
      "--audio-quality", "0",
    ];
  }

  const vf = vcodec ? `[vcodec^=${vcodec}]` : "";
  // YouTube: AAC = mp4a.*, Opus = opus
  const af = acodec === "aac" ? "[acodec^=mp4a]" : acodec === "opus" ? "[acodec=opus]" : "";
  const mergeFormat = ext === "webm" ? "webm" : ext === "mkv" ? "mkv" : "mp4";

  let selector: string;
  if (quality === "best") {
    selector = [
      `bestvideo${vf}+bestaudio${af}`,
      `bestvideo${vf}+bestaudio`,
      "bestvideo+bestaudio",
      "best",
    ].join("/");
  } else {
    const h = quality;
    selector = [
      `bestvideo[height<=${h}]${vf}+bestaudio${af}`,
      `bestvideo[height<=${h}]${vf}+bestaudio`,
      `bestvideo[height<=${h}]+bestaudio`,
      `best[height<=${h}]`,
      "best",
    ].join("/");
  }

  return ["--format", selector, "--merge-output-format", mergeFormat];
}

function titleFromPath(downloadId: string, filePath: string): string | null {
  const base = path.basename(filePath.trim());
  const prefix = `${downloadId}_`;
  if (!base.startsWith(prefix)) return null;
  let name = base.slice(prefix.length);
  const dot = name.lastIndexOf(".");
  if (dot > 0) name = name.slice(0, dot);
  name = name.replace(/\.f\d+$/, ""); // strip yt-dlp format codes like .f399
  return name || null;
}

function parseLine(downloadId: string, line: string): void {
  const entry = progressStore.get(downloadId);
  if (!entry) return;

  // [download] Destination: /downloads/abc_Title.f399.mp4
  if (line.includes("[download]") && line.includes("Destination:")) {
    const m = /Destination:\s+(.+)/.exec(line);
    if (m) {
      const fp = m[1].trim();
      if (!entry.filename) entry.filename = fp;
      if (!entry.title) entry.title = titleFromPath(downloadId, fp);
      entry.status = "downloading";
    }
    return;
  }

  // [Merger] Merging formats into "/downloads/abc_Title.mp4"
  if (line.includes("[Merger]")) {
    const m = /"([^"]+)"/.exec(line);
    if (m) {
      const fp = m[1].trim();
      entry.filename = fp;
      entry.title = titleFromPath(downloadId, fp);
    }
    return;
  }

  // [download]   1.2% of   50.23MiB at    2.50MiB/s ETA 00:19
  if (line.includes("[download]")) {
    const pct = /(\d+\.?\d*)\%\s+of/.exec(line);
    if (pct) {
      entry.status = "downloading";
      entry.percent = parseFloat(pct[1]);
      const spd = /at\s+([\d.]+\s*\S+\/s)/.exec(line);
      entry.speed = spd ? spd[1] : null;
      const eta = /ETA\s+(\d+:\d+(?::\d+)?)/.exec(line);
      entry.eta = eta ? eta[1] : null;
    }
  }
}

interface FfprobeOutput {
  streams?: Array<{
    codec_type?: string;
    codec_name?: string;
    width?: number;
    height?: number;
    duration?: string;
  }>;
  format?: { duration?: string };
}

async function extractMetadata(filePath: string): Promise<Pick<DownloadProgress, "duration" | "videoCodec" | "audioCodec" | "width" | "height">> {
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "quiet",
      "-print_format", "json",
      "-show_streams",
      "-show_format",
      filePath,
    ]);
    const data = JSON.parse(stdout) as FfprobeOutput;
    const videoStream = data.streams?.find((s) => s.codec_type === "video");
    const audioStream = data.streams?.find((s) => s.codec_type === "audio");
    const rawDuration = data.format?.duration ?? videoStream?.duration ?? audioStream?.duration;
    return {
      duration: rawDuration ? Math.round(parseFloat(rawDuration)) : null,
      videoCodec: videoStream?.codec_name ?? null,
      audioCodec: audioStream?.codec_name ?? null,
      width: videoStream?.width ?? null,
      height: videoStream?.height ?? null,
    };
  } catch {
    return { duration: null, videoCodec: null, audioCodec: null, width: null, height: null };
  }
}

export function startDownload(
  downloadId: string,
  url: string,
  quality: string,
  ext: string,
  vcodec?: string,
  acodec?: string,
): void {
  const entry: DownloadEntry = {
    status: "pending",
    percent: 0,
    speed: null,
    eta: null,
    title: null,
    filename: null,
    error: null,
    duration: null,
    videoCodec: null,
    audioCodec: null,
    width: null,
    height: null,
    process: null,
  };
  progressStore.set(downloadId, entry);

  const outputTemplate = path.join(DOWNLOADS_PATH, `${downloadId}_%(title)s.%(ext)s`);
  const formatArgs = buildFormatArgs(quality, ext, vcodec, acodec);

  const args = [
    ...formatArgs,
    "--output", outputTemplate,
    "--progress", "--newline",
    "--no-playlist",
    "--socket-timeout", "30",
    "--js-runtimes", "node",
    url,
  ];

  const proc = spawn("yt-dlp", args);
  entry.process = proc;

  let buf = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buf += chunk.toString();
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) parseLine(downloadId, line.trim());
  });

  proc.stderr.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trim();
    if (text) {
      const e = progressStore.get(downloadId);
      if (e && e.status !== "finished") e.error = text;
    }
  });

  proc.on("exit", async (code) => {
    const e = progressStore.get(downloadId);
    if (!e) return;

    if (code === 0) {
      // Find final file (handles merged output)
      try {
        const files = await readdir(DOWNLOADS_PATH);
        const file = files.find(f => f.startsWith(`${downloadId}_`) && !f.endsWith(".part"));
        if (file) e.filename = path.join(DOWNLOADS_PATH, file);
      } catch { /* ignore */ }
      if (!e.title && e.filename) e.title = titleFromPath(downloadId, e.filename);
      if (e.filename) {
        const meta = await extractMetadata(e.filename);
        e.duration = meta.duration;
        e.videoCodec = meta.videoCodec;
        e.audioCodec = meta.audioCodec;
        e.width = meta.width;
        e.height = meta.height;
      }
      e.status = "finished";
    } else {
      e.status = "error";
      if (!e.error) e.error = `yt-dlp exited with code ${code}`;
    }
    e.process = null;
  });

  proc.on("error", (err) => {
    const e = progressStore.get(downloadId);
    if (e) {
      e.status = "error";
      e.error = err.message;
      e.process = null;
    }
  });
}

export function getProgress(downloadId: string): DownloadProgress | null {
  const entry = progressStore.get(downloadId);
  if (!entry) return null;
  const { process: _proc, ...rest } = entry;
  return rest;
}

export function cancelDownload(downloadId: string): void {
  const entry = progressStore.get(downloadId);
  if (entry?.process) entry.process.kill("SIGTERM");
  progressStore.delete(downloadId);
}

export function removeFromStore(downloadId: string): void {
  progressStore.delete(downloadId);
}

export async function getFileSize(filePath: string): Promise<number | null> {
  try {
    const st = await stat(filePath);
    return st.size;
  } catch {
    return null;
  }
}
