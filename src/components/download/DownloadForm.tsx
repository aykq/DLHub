"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { SupportedSites } from "./SupportedSites";

interface VideoFormat {
  id: string;
  label: string;
  quality: string;
  format: string;
  height: number | null;
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
  | { type: "error"; message: string };

interface Props {
  activeDownloadId?: string | null;
  activeDownloadTitle?: string | null;
}

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function DownloadForm({ activeDownloadId, activeDownloadTitle }: Props) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>({ type: "idle" });
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);
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
          new Notification("DLHub — İndirme Tamamlandı", {
            body: titleRef.current ?? "Dosyanız hazır",
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
        setPhase({ type: "error", message: data.error ?? "İndirme sırasında hata oluştu" });
      }
    };

    es.onerror = () => {
      es.close();
      setPhase((prev) => {
        if (prev.type === "completed" || prev.type === "error") return prev;
        return { type: "error", message: "Sunucu bağlantısı kesildi" };
      });
    };
  }

  async function handleFetchFormats() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhase({ type: "fetching" });
    setSelectedFormat(null);

    try {
      const res = await fetch(`/api/formats?url=${encodeURIComponent(trimmed)}`);
      const data = await res.json() as VideoInfo & { error?: string };
      if (!res.ok) {
        setPhase({ type: "error", message: data.error ?? "Format bilgisi alınamadı" });
        return;
      }
      setPhase({ type: "ready", url: trimmed, info: data });
    } catch {
      setPhase({ type: "error", message: "Sunucuya bağlanılamadı" });
    }
  }

  async function handleDownload() {
    if (phase.type !== "ready" || !selectedFormat || isStarting) return;
    setIsStarting(true);
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    try {
      const res = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: phase.url, formatId: selectedFormat }),
      });
      const data = await res.json() as { id?: string; error?: string };
      if (!res.ok) {
        setPhase({
          type: "error",
          message:
            res.status === 429
              ? (data.error ?? "Günlük indirme limitine ulaştınız")
              : res.status === 403
              ? (data.error ?? "Bu domain indirme için izin verilmiyor")
              : (data.error ?? "İndirme başlatılamadı"),
        });
        return;
      }
      setPhase({ type: "downloading", downloadId: data.id!, title: phase.info.title, percent: 0, speed: null, eta: null });
      startSSE(data.id!);
    } catch {
      setPhase({ type: "error", message: "Sunucuya bağlanılamadı" });
    } finally {
      setIsStarting(false);
    }
  }

  function handleReset() {
    esRef.current?.close();
    setPhase({ type: "idle" });
    setUrl("");
    setSelectedFormat(null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        İndirme
      </h2>

      {/* URL girişi */}
      {(phase.type === "idle" || phase.type === "error" || phase.type === "ready") && (
        <div className="space-y-3">
        <div className="flex gap-2">
          <Input
            placeholder=""
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (phase.type === "ready" || phase.type === "error") setPhase({ type: "idle" });
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleFetchFormats(); }}
          />
          <Button onClick={handleFetchFormats} disabled={!url.trim() || isFetching}>
            Getir
          </Button>
        </div>
        <SupportedSites />
        </div>
      )}

      {/* Format yükleniyor */}
      {phase.type === "fetching" && (
        <div className="flex items-center gap-3 py-3 text-muted-foreground">
          <Loader2 className="size-4 animate-spin shrink-0" />
          <span className="text-sm">Video bilgisi alınıyor…</span>
        </div>
      )}

      {/* Format seçimi */}
      {phase.type === "ready" && (
        <div className="space-y-4">
          {phase.info.thumbnail && (
            <div className="flex gap-3 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={phase.info.thumbnail}
                alt=""
                className="w-24 h-14 object-cover rounded-md shrink-0 bg-muted"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug line-clamp-2">{phase.info.title}</p>
                {phase.info.duration && (
                  <p className="text-xs text-muted-foreground mt-1">{fmtDuration(phase.info.duration)}</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {phase.info.formats.map((fmt) => (
              <button
                key={fmt.id}
                onClick={() => setSelectedFormat(fmt.id === selectedFormat ? null : fmt.id)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left text-sm transition-colors cursor-pointer",
                  selectedFormat === fmt.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-muted"
                )}
              >
                {fmt.label}
              </button>
            ))}
          </div>

          <Button
            onClick={handleDownload}
            disabled={!selectedFormat || isStarting}
            className="w-full"
            size="lg"
          >
            {isStarting ? (
              <><Loader2 className="size-4 animate-spin" /> Başlatılıyor…</>
            ) : (
              <><Download className="size-4" /> İndir</>
            )}
          </Button>
        </div>
      )}

      {/* Progress */}
      {phase.type === "downloading" && (
        <div className="space-y-3">
          {phase.title && (
            <p className="text-sm font-medium truncate">{phase.title}</p>
          )}
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-[width] duration-500"
                style={{ width: `${Math.max(2, phase.percent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{phase.percent.toFixed(1)}%</span>
              <span>
                {[
                  phase.speed,
                  phase.eta ? `${phase.eta} kaldı` : null,
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
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle className="size-4 text-green-500 shrink-0" />
            <span className="font-medium truncate">{phase.title ?? "İndirme tamamlandı"}</span>
          </div>
          <div className="flex gap-2">
            <a
              href={`/api/downloads/${phase.downloadId}/file?token=${phase.token}`}
              className="flex-1"
            >
              <Button className="w-full" size="lg">
                <Download className="size-4" />
                Dosyayı İndir
                <span className="text-xs opacity-70 ml-1">(24 saat geçerli)</span>
              </Button>
            </a>
            <Button variant="outline" size="lg" onClick={handleReset}>
              Yeni
            </Button>
          </div>
          {isIOS && (
            <p className="text-xs text-muted-foreground text-center">
              Dosyanız Files uygulamasına inecektir.
            </p>
          )}
        </div>
      )}

      {/* Hata */}
      {phase.type === "error" && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 space-y-1.5">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span>{phase.message}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-destructive/70 hover:text-destructive underline underline-offset-2 cursor-pointer"
          >
            Tekrar dene
          </button>
        </div>
      )}
    </div>
  );
}
