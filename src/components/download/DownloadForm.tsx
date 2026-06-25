"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, CheckCircle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportedSites } from "./SupportedSites";
import { useTranslations } from "next-intl";

interface FormatVariant {
  codec: string;
  codecId: string;
  filesize: number | null;
  tbr: number | null;
}

interface VideoFormat {
  id: string;
  label: string;
  quality: string;
  format: string;
  height: number | null;
  variants: FormatVariant[];
}

interface VideoInfo {
  title: string;
  thumbnail: string | null;
  duration: number | null;
  formats: VideoFormat[];
}

type Phase =
  | { type: "idle" }
  | { type: "fetching" }
  | { type: "ready"; url: string; info: VideoInfo }
  | { type: "downloading"; downloadId: string; title: string | null; percent: number; speed: string | null; eta: string | null }
  | { type: "completed"; downloadId: string; title: string | null; token: string }
  | { type: "cancelled" }
  | { type: "error"; message: string };

interface Props {
  activeDownloadId?: string | null;
  activeDownloadTitle?: string | null;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DownloadForm({ activeDownloadId, activeDownloadTitle }: Props) {
  const t = useTranslations("download");
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const [selectedQuality, setSelectedQuality] = useState<string | null>(null);
  const [selectedContainer, setSelectedContainer] = useState<"mp4" | "mkv" | "webm">("mp4");
  const [selectedVcodec, setSelectedVcodec] = useState<string | null>(null);
  const [selectedAcodec, setSelectedAcodec] = useState<"auto" | "aac" | "opus">("auto");
  const [isStarting, setIsStarting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const titleRef = useRef<string | null>(null);
  const isFetching = phase.type === "fetching";

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!activeDownloadId) return;
    setPhase({
      type: "downloading",
      downloadId: activeDownloadId,
      title: activeDownloadTitle ?? null,
      percent: 0,
      speed: null,
      eta: null,
    });
    startSSE(activeDownloadId);
    return () => esRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDownloadId]);

  function startSSE(downloadId: string) {
    esRef.current?.close();
    const es = new EventSource(`/api/downloads/${downloadId}/progress`);
    esRef.current = es;

    es.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as {
        status: string;
        percent?: number;
        speed?: string;
        eta?: string;
        title?: string;
        token?: string;
        error?: string;
      };

      if (data.status === "downloading") {
        if (data.title) titleRef.current = data.title;
        setPhase({
          type: "downloading",
          downloadId,
          title: data.title ?? null,
          percent: data.percent ?? 0,
          speed: data.speed ?? null,
          eta: data.eta ?? null,
        });
      } else if (data.status === "completed") {
        es.close();
        if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
          new Notification(t("notificationTitle"), {
            body: titleRef.current ?? t("notificationBody"),
          });
        }
        setPhase((prev) => ({
          type: "completed",
          downloadId,
          title: prev.type === "downloading" ? prev.title : null,
          token: data.token ?? "",
        }));
      } else if (data.status === "error") {
        es.close();
        setPhase({ type: "error", message: data.error ?? t("errors.failed") });
      }
    };

    es.onerror = () => {
      es.close();
      setPhase((prev) => {
        if (prev.type === "completed" || prev.type === "error") return prev;
        return { type: "error", message: t("errors.serverDisconnected") };
      });
    };
  }

  async function handleFetchFormats() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhase({ type: "fetching" });
    setSelectedQuality(null);
    setSelectedVcodec(null);

    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json() as VideoInfo & { error?: string };
      if (!res.ok) {
        setPhase({ type: "error", message: data.error ?? t("errors.formatFailed") });
        return;
      }
      setPhase({ type: "ready", url: trimmed, info: data });
    } catch {
      setPhase({ type: "error", message: t("errors.connectionFailed") });
    }
  }

  async function handleDownload() {
    if (phase.type !== "ready" || !selectedQuality || isStarting) return;
    setIsStarting(true);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: phase.url,
          quality: selectedQuality,
          container: selectedQuality === "0" ? "mp3" : selectedContainer,
          vcodec: selectedVcodec ?? undefined,
          acodec: selectedAcodec === "auto" ? undefined : selectedAcodec,
        }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setPhase({
          type: "error",
          message:
            res.status === 429
              ? (data.error ?? t("errors.dailyLimit"))
              : res.status === 403
              ? (data.error ?? t("errors.domainBlocked"))
              : (data.error ?? t("errors.startFailed")),
        });
        return;
      }
      setPhase({ type: "downloading", downloadId: data.id!, title: phase.info.title, percent: 0, speed: null, eta: null });
      startSSE(data.id!);
    } catch {
      setPhase({ type: "error", message: t("errors.connectionFailed") });
    } finally {
      setIsStarting(false);
    }
  }

  async function handleCancel() {
    if (phase.type !== "downloading" || isCancelling) return;
    const downloadId = phase.downloadId;
    setIsCancelling(true);
    esRef.current?.close();
    try {
      await fetch(`/api/downloads/${downloadId}`, { method: "DELETE" });
    } catch { /* hata sessizce geçilir */ }
    setIsCancelling(false);
    setPhase({ type: "cancelled" });
  }

  function handleReset() {
    esRef.current?.close();
    setPhase({ type: "idle" });
    setUrl("");
    setSelectedQuality(null);
    setSelectedVcodec(null);
    setSelectedContainer("mp4");
    setSelectedAcodec("auto");
    setIsCancelling(false);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {t("title")}
      </h2>

      {/* URL girişi */}
      {(phase.type === "idle" || phase.type === "error" || phase.type === "ready") && (
        <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder="youtube.com, instagram.com, tiktok.com…"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (phase.type === "ready" || phase.type === "error") setPhase({ type: "idle" });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleFetchFormats(); }}
            className="h-12 text-sm"
          />
          <Button onClick={handleFetchFormats} disabled={!url.trim() || isFetching} className="h-12 px-5">
            {t("fetch")}
          </Button>
        </div>
        <SupportedSites />
        </div>
      )}

      {/* Format yükleniyor */}
      {phase.type === "fetching" && (
        <div className="flex items-center gap-3 py-2 text-muted-foreground animate-in fade-in-0 duration-200">
          <Loader2 className="size-4 animate-spin shrink-0" />
          <div className="min-w-0 flex-1">
            <span className="text-sm">{t("loading")}</span>
            <p className="text-xs text-muted-foreground/60 truncate mt-0.5 font-mono">{url}</p>
          </div>
        </div>
      )}

      {/* Format seçimi */}
      {phase.type === "ready" && (
        <div className="space-y-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          {phase.info.thumbnail && (
            <div className="flex gap-3 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/proxy/thumbnail?url=${encodeURIComponent(phase.info.thumbnail)}`}
                alt=""
                className="w-24 h-14 object-cover rounded-md shrink-0 bg-muted"
              />
              <div className="min-w-0 flex-1">
                <p className="font-heading text-sm font-semibold leading-snug line-clamp-2">{phase.info.title}</p>
                {phase.info.duration && (
                  <p className="text-xs text-muted-foreground font-mono mt-1">{fmtDuration(phase.info.duration)}</p>
                )}
              </div>
            </div>
          )}

          {/* Çözünürlük seçimi */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {phase.info.formats.map((fmt, i) => {
              const isSelected = selectedQuality === fmt.quality;
              return (
                <button
                  key={fmt.id}
                  onClick={() => {
                    setSelectedQuality(isSelected ? null : fmt.quality);
                    setSelectedVcodec(null);
                  }}
                  style={{ animationDelay: `${i * 35}ms` }}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer animate-in fade-in-0 slide-in-from-bottom-2 duration-200 [animation-fill-mode:backwards]",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background hover:border-primary/30 hover:bg-primary/5"
                  )}
                >
                  <span className="text-sm font-medium block">{fmt.label.split(" — ")[0]}</span>
                  {fmt.variants.length > 0 && (
                    <span className="mt-1.5 flex flex-wrap gap-1">
                      {fmt.variants.map((v) => (
                        <span
                          key={v.codec}
                          className={cn(
                            "text-[0.62rem] px-1.5 py-0.5 rounded font-mono font-medium",
                            isSelected ? "bg-background/20 text-primary-foreground" : "bg-muted/80 text-muted-foreground"
                          )}
                        >
                          {v.codec}
                        </span>
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Format seçenekleri — çözünürlük seçilince göster */}
          {selectedQuality && selectedQuality !== "0" && (() => {
            const fmt = phase.info.formats.find(f => f.quality === selectedQuality);
            return (
              <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 space-y-3 text-sm">
                {/* Container */}
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-24 shrink-0">Container</span>
                  <div className="flex gap-1.5">
                    {(["mp4", "mkv", "webm"] as const).map(c => (
                      <button key={c} type="button"
                        onClick={() => setSelectedContainer(c)}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer",
                          selectedContainer === c
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >{c.toUpperCase()}</button>
                    ))}
                  </div>
                </div>

                {/* Video codec */}
                {fmt && fmt.variants.length > 0 && (
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground w-24 shrink-0">Video</span>
                    <div className="flex gap-1.5 flex-wrap">
                      <button type="button"
                        onClick={() => setSelectedVcodec(null)}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer",
                          selectedVcodec === null
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >Auto</button>
                      {fmt.variants.map(v => (
                        <button key={v.codecId} type="button"
                          onClick={() => setSelectedVcodec(selectedVcodec === v.codecId ? null : v.codecId)}
                          className={cn(
                            "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer",
                            selectedVcodec === v.codecId
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border bg-background hover:bg-muted"
                          )}
                        >
                          {v.codec}
                          {v.filesize ? ` · ${fmtBytes(v.filesize)}` : ""}
                          {v.tbr ? ` · ${v.tbr < 1000 ? `${Math.round(v.tbr)} kbps` : `${(v.tbr / 1000).toFixed(1)} Mbps`}` : ""}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Audio codec */}
                <div className="flex items-center gap-3">
                  <span className="text-muted-foreground w-24 shrink-0">Audio</span>
                  <div className="flex gap-1.5">
                    {(["auto", "aac", "opus"] as const).map(a => (
                      <button key={a} type="button"
                        onClick={() => setSelectedAcodec(a)}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border transition-colors cursor-pointer",
                          selectedAcodec === a
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-background hover:bg-muted"
                        )}
                      >{a === "auto" ? "Auto" : a.toUpperCase()}</button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          <Button
            onClick={handleDownload}
            disabled={!selectedQuality || isStarting}
            className="w-full"
            size="lg"
          >
            {isStarting ? (
              <><Loader2 className="size-4 animate-spin" /> {t("starting")}</>
            ) : (
              <><Download className="size-4" /> {t("download")}</>
            )}
          </Button>
        </div>
      )}

      {/* Progress */}
      {phase.type === "downloading" && (
        <div className="space-y-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <div className="flex items-center gap-2">
            <p className="font-heading text-sm font-semibold truncate flex-1">
              {phase.title ?? ""}
            </p>
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              aria-label={t("cancel")}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isCancelling ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <X className="size-4" />
              )}
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-ring rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(2, phase.percent)}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span className="font-mono">{phase.percent.toFixed(1)}%</span>
              <span className="font-mono">
                {[
                  phase.speed,
                  phase.eta ? t("etaLeft", { eta: phase.eta }) : null,
                ]
                  .filter(Boolean)
                  .join(" — ")}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tamamlandı */}
      {phase.type === "completed" && (
        <div className="space-y-3 animate-in fade-in-0 zoom-in-95 duration-300">
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3.5 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <CheckCircle className="size-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-sm font-semibold truncate">{phase.title ?? t("download")}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t("validFor24h")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/downloads/${phase.downloadId}/file?token=${phase.token}`}
              className="flex-1"
            >
              <Button className="w-full" size="lg">
                <Download className="size-4" />
                {t("downloadFile")}
              </Button>
            </a>
            <Button variant="outline" size="lg" onClick={handleReset}>
              {t("new")}
            </Button>
          </div>
          {isIOS && (
            <p className="text-xs text-muted-foreground text-center">
              {t("iosNote")}
            </p>
          )}
        </div>
      )}

      {/* İptal edildi */}
      {phase.type === "cancelled" && (
        <div className="space-y-3 animate-in fade-in-0 duration-200">
          <p className="text-sm text-muted-foreground">{t("cancelled")}</p>
          <Button variant="outline" size="lg" onClick={handleReset} className="w-full">
            {t("new")}
          </Button>
        </div>
      )}

      {/* Hata */}
      {phase.type === "error" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 space-y-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{phase.message}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-destructive/70 hover:text-destructive underline underline-offset-2 cursor-pointer"
          >
            {t("retry")}
          </button>
        </div>
      )}
    </div>
  );
}
