export interface DownloadFormat {
  id: string;
  label: string;
  quality: string;
  format: string;
}

export const DOWNLOAD_FORMATS: DownloadFormat[] = [
  { id: "mp4_best", label: "En İyi Kalite (MP4)", quality: "best", format: "mp4" },
  { id: "mp4_1080", label: "1080p (MP4)", quality: "1080", format: "mp4" },
  { id: "mp4_720", label: "720p (MP4)", quality: "720", format: "mp4" },
  { id: "mp4_480", label: "480p (MP4)", quality: "480", format: "mp4" },
  { id: "mp3_audio", label: "MP3 (Ses)", quality: "0", format: "mp3" },
];

export function getDownloadFormat(id: string): DownloadFormat | undefined {
  return DOWNLOAD_FORMATS.find((f) => f.id === id);
}
