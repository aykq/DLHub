"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type TFn = ReturnType<typeof useTranslations<"admin">>;

export function fmtDownloadTime(dateStr: string, t: TFn): { display: string; full: string } {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const m = Math.floor(diff / 60000);
  const full = date.toLocaleString(undefined, {
    day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  if (m < 1) return { display: t("timeNow"), full };
  if (m < 60) return { display: t("timeMin", { count: m }), full };
  const h = Math.floor(m / 60);
  if (h < 24) return { display: t("timeHour", { count: h }), full };
  const display = date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
  return { display, full };
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
    return url.slice(0, 30);
  }
}

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("admin");
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    approved: "bg-green-500/15 text-green-600 dark:text-green-400",
    blocked: "bg-destructive/15 text-destructive",
    downloading: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    completed: "bg-green-500/15 text-green-600 dark:text-green-400",
    error: "bg-destructive/15 text-destructive",
    expired: "bg-muted text-muted-foreground",
    cancelled: "bg-muted text-muted-foreground",
  };
  const labelMap: Record<string, string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    blocked: t("statusBlocked"),
    downloading: t("statusDownloading"),
    completed: t("statusCompleted"),
    error: t("statusError"),
    expired: t("statusExpired"),
    cancelled: t("statusCancelled"),
  };
  return (
    <span className={cn(
      "inline-flex items-center px-1.5 py-0.5 rounded text-[0.7rem] font-medium",
      colorMap[status] ?? "bg-muted text-muted-foreground"
    )}>
      {labelMap[status] ?? status}
    </span>
  );
}
