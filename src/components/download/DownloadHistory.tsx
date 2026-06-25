"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RefreshCw, Download, Loader2, AlertCircle, Clock, Search, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface DownloadRecord {
  id: string;
  url: string;
  title: string | null;
  format: string;
  status: string;
  fileSize: number | null;
  expiresAt: string | null;
  createdAt: string;
  token?: string | null;
  duration?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  width?: number | null;
  height?: number | null;
}

interface Props {
  initialDownloads: DownloadRecord[];
}

function fmtDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  const time = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  if (isToday) return `Bugün, ${time}`;
  if (isYesterday) return `Dün, ${time}`;
  return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" }) + `, ${time}`;
}

const VCODEC_NAMES: Record<string, string> = { av01: "AV1", vp09: "VP9", avc1: "H.264", hev1: "HEVC", vp08: "VP8" };

function formatLabel(id: string): string {
  const match = id.match(/^(\d+|best)_(mp4|mp3|mkv|webm)(?:_(av01|vp09|avc1|hev1|vp08))?(?:_(aac|opus))?$/);
  if (!match) return id;
  const [, quality, ext, vcodec, acodec] = match;
  if (ext === "mp3") return "MP3";
  const parts: string[] = [quality === "best" ? "Best" : `${quality}p`, ext.toUpperCase()];
  if (vcodec) parts.push(VCODEC_NAMES[vcodec] ?? vcodec.toUpperCase());
  if (acodec) parts.push(acodec.toUpperCase());
  return parts.join(" · ");
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url.slice(0, 40); }
}

const STATUS_FILTER_KEYS = ["all", "completed", "error", "cancelled", "expired"] as const;

type StatusFilter = (typeof STATUS_FILTER_KEYS)[number];

export function DownloadHistory({ initialDownloads }: Props) {
  const t = useTranslations("history");
  const [downloads, setDownloads] = useState<DownloadRecord[]>(initialDownloads);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch("/api/downloads");
      if (res.ok) setDownloads(await res.json() as DownloadRecord[]);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => { void refresh(true); }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  const filtered = useMemo(() => {
    return downloads.filter((dl) => {
      const effectiveStatus =
        dl.status === "completed" && dl.expiresAt && new Date(dl.expiresAt) <= new Date()
          ? "expired"
          : dl.status;

      if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        (dl.title ?? "").toLowerCase().includes(q) ||
        dl.url.toLowerCase().includes(q)
      );
    });
  }, [downloads, query, statusFilter]);

  if (downloads.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {t("title")}
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => void refresh()}
          disabled={isRefreshing}
          aria-label={t("refresh")}
        >
          <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Arama + filtre */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-sm"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTER_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                statusFilter === key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t(`filter${key.charAt(0).toUpperCase() + key.slice(1)}` as Parameters<typeof t>[0])}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">{t("noResults")}</p>
      ) : (
      <ul className="space-y-1.5">
        {filtered.map((dl) => {
          const isActive = dl.status === "downloading" || dl.status === "pending";
          const isExpired = dl.status === "expired" ||
            (dl.status === "completed" && dl.expiresAt && new Date(dl.expiresAt) <= new Date());
          const canDownload = dl.status === "completed" && !!dl.token && !isExpired;

          return (
            <li
              key={dl.id}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-muted/40 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[0.8125rem]">
                  {dl.title ?? hostOf(dl.url)}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium">{formatLabel(dl.format)}</span>
                  {dl.fileSize && (
                    <>
                      <span className="opacity-40">·</span>
                      <span>{fileSize(dl.fileSize)}</span>
                    </>
                  )}
                  <span className="opacity-40">·</span>
                  <a
                    href={dl.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 hover:text-foreground transition-colors"
                  >
                    {hostOf(dl.url)}
                    <ExternalLink className="size-2.5 opacity-60" />
                  </a>
                  <span className="opacity-40">·</span>
                  <span>{fmtDateTime(dl.createdAt)}</span>
                </p>
                {(dl.width || dl.duration || dl.videoCodec) && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1.5 flex-wrap">
                    {dl.width && dl.height && <span>{dl.width}×{dl.height}</span>}
                    {dl.duration && (
                      <>
                        {(dl.width || dl.height) && <span className="opacity-40">·</span>}
                        <span>{fmtDuration(dl.duration)}</span>
                      </>
                    )}
                    {dl.videoCodec && (
                      <>
                        {(dl.width || dl.duration) && <span className="opacity-40">·</span>}
                        <span>{dl.videoCodec.toUpperCase()}</span>
                      </>
                    )}
                    {dl.audioCodec && (
                      <>
                        <span className="opacity-40">·</span>
                        <span>{dl.audioCodec.toUpperCase()}</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="shrink-0">
                {isActive ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    {t("downloading")}
                  </span>
                ) : canDownload ? (
                  <a href={`/api/downloads/${dl.id}/file?token=${dl.token}`}>
                    <Button size="icon-sm" variant="outline" aria-label="İndir">
                      <Download className="size-3.5" />
                    </Button>
                  </a>
                ) : dl.status === "error" ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <AlertCircle className="size-3.5" />
                    {t("error")}
                  </span>
                ) : dl.status === "cancelled" ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <X className="size-3.5" />
                    {t("cancelled")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Clock className="size-3.5" />
                    {t("expired")}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      )}
    </div>
  );
}
