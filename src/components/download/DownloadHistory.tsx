"use client";

import { useState, useMemo } from "react";
import { RefreshCw, Download, Loader2, AlertCircle, Clock, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
}

interface Props {
  initialDownloads: DownloadRecord[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "az önce";
  if (m < 60) return `${m}dk`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

function formatLabel(id: string): string {
  const match = id.match(/^(\d+|best)_(mp4|mp3|mkv|webm)$/);
  if (!match) return id;
  const [, quality, ext] = match;
  if (ext === "mp3") return "MP3";
  if (quality === "best") return "MP4";
  return `${quality}p`;
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

const STATUS_FILTERS = [
  { value: "all", label: "Tümü" },
  { value: "completed", label: "Tamamlandı" },
  { value: "error", label: "Hatalı" },
  { value: "expired", label: "Süresi Doldu" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

export function DownloadHistory({ initialDownloads }: Props) {
  const [downloads, setDownloads] = useState<DownloadRecord[]>(initialDownloads);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  async function refresh() {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/downloads");
      if (res.ok) setDownloads(await res.json() as DownloadRecord[]);
    } finally {
      setIsRefreshing(false);
    }
  }

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
          Geçmiş
        </h2>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={refresh}
          disabled={isRefreshing}
          aria-label="Yenile"
        >
          <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
        </Button>
      </div>

      {/* Arama + filtre */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Başlık veya URL ara…"
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
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-3">Sonuç bulunamadı</p>
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
                  <span>{timeAgo(dl.createdAt)}</span>
                </p>
              </div>

              <div className="shrink-0">
                {isActive ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="size-3.5 animate-spin" />
                    İndiriliyor
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
                    Hata
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground/60">
                    <Clock className="size-3.5" />
                    Süresi doldu
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
