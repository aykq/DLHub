"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Download, Loader2, Trash2, AlertCircle, BarChart2, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { StatusBadge, formatLabel, hostOf, fmtDownloadTime } from "./admin-utils";
import { fmtBytes, fmtDuration } from "@/lib/format";
import type { AdminDownload, AdminStats } from "./AdminDashboard";

type AskConfirm = (opts: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive";
}) => Promise<boolean>;

interface Props {
  dlList: AdminDownload[];
  setDlList: React.Dispatch<React.SetStateAction<AdminDownload[]>>;
  stats: AdminStats;
  statsPeriod: "7d" | "30d" | "all";
  changePeriod: (p: "7d" | "30d" | "all") => void;
  askConfirm: AskConfirm;
}

const PAGE_SIZE = 7;

export function AdminDownloadsTab({ dlList, setDlList, stats, statsPeriod, changePeriod, askConfirm }: Props) {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const prevVisibleRef = useRef(PAGE_SIZE);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  function setItemLoading(key: string, val: boolean) {
    setLoading((prev) => ({ ...prev, [key]: val }));
  }

  function animateRemove(ids: string[], afterMs = 220) {
    setRemovingIds((prev) => new Set([...prev, ...ids]));
    setTimeout(() => {
      setDlList((prev) => prev.filter((dl) => !ids.includes(dl.id)));
      setRemovingIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
    }, afterMs);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!(await askConfirm({
      message: t("deleteSelectedConfirm", { count: selected.size }),
      confirmLabel: t("titleDelete"),
      cancelLabel: t("selectCancel"),
      variant: "destructive",
    }))) return;
    const ids = Array.from(selected);
    setItemLoading("bulk-delete", true);
    try {
      const res = await fetch("/api/admin/downloads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (res.ok) {
        exitSelectMode();
        animateRemove(ids);
      }
    } finally {
      setItemLoading("bulk-delete", false);
    }
  }

  async function clearAll() {
    const inactiveIds = dlList
      .filter((dl) => dl.status !== "downloading" && dl.status !== "pending")
      .map((dl) => dl.id);
    if (inactiveIds.length === 0) return;
    if (!(await askConfirm({
      message: t("clearAllConfirm"),
      confirmLabel: t("clearAll"),
      cancelLabel: t("selectCancel"),
      variant: "destructive",
    }))) return;
    const res = await fetch("/api/admin/downloads", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: inactiveIds }),
    });
    if (res.ok) {
      animateRemove(inactiveIds);
      setTimeout(() => setVisibleCount(PAGE_SIZE), 220);
    }
  }

  async function deleteDownload(dlId: string) {
    if (!(await askConfirm({
      message: t("deleteDownloadConfirm"),
      confirmLabel: t("titleDelete"),
      cancelLabel: t("selectCancel"),
      variant: "destructive",
    }))) return;
    const key = `dl-delete-${dlId}`;
    setItemLoading(key, true);
    try {
      const res = await fetch(`/api/admin/downloads/${dlId}`, { method: "DELETE" });
      if (res.ok) {
        animateRemove([dlId]);
      }
    } finally {
      setItemLoading(key, false);
    }
  }

  return (
    <>
      {(stats.totalDownloadedBytes > 0 || stats.platformStats.length > 0) && (
        <section className="rounded-xl border border-border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <BarChart2 className="size-3.5" />
              {t("statsSection")}
            </h2>
            <div className="flex items-center gap-1">
              {(["7d", "30d", "all"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => changePeriod(p)}
                  className={cn(
                    "text-[0.65rem] px-2 py-0.5 rounded font-medium transition-colors cursor-pointer",
                    statsPeriod === p
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {p === "7d" ? t("period7d") : p === "30d" ? t("period30d") : t("periodAll")}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("totalDownloaded")}</span>
              <span className="font-medium">{fmtBytes(stats.totalDownloadedBytes)}</span>
            </div>
            {stats.platformStats.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {stats.platformStats.map((p) => (
                  <div key={p.domain} className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground w-36 truncate">{p.domain}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${Math.round((p.count / (stats.platformStats[0]?.count || 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-8 text-right">{p.count}</span>
                    <span className="text-muted-foreground w-16 text-right">{fmtBytes(p.bytes)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Download className="size-3.5" />
            {t("downloadsSection")} ({dlList.length})
          </h2>
          <div className="relative flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "flex items-center gap-1.5 transition-all duration-200",
              selectMode ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
            )}>
              <Button size="sm" variant="ghost" onClick={() => setSelectMode(true)} className="h-7 px-2.5 text-xs">
                {t("selectMode")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void clearAll()} className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive">
                {t("clearAll")}
              </Button>
            </div>
            <div className={cn(
              "absolute right-0 flex items-center gap-1.5 transition-all duration-200",
              selectMode ? "opacity-100 scale-100" : "opacity-0 pointer-events-none scale-95"
            )}>
              <Button size="sm" variant="ghost" onClick={exitSelectMode} className="h-7 px-2.5 text-xs">
                {t("selectCancel")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void deleteSelected()} disabled={selected.size === 0 || !!loading["bulk-delete"]} className="h-7 px-2.5 text-xs gap-1.5">
                {loading["bulk-delete"] && <Loader2 className="size-3 animate-spin" />}
                {t("deleteSelected", { count: selected.size })}
              </Button>
            </div>
          </div>
        </div>
        {dlList.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noDownloads")}</p>
        ) : (
          <>
            <ul className="space-y-1.5">
              {dlList.slice(0, visibleCount).map((dl, i) => {
                const isActive = dl.status === "downloading" || dl.status === "pending";
                const canDelete = dl.status !== "expired";
                const canDownload = dl.status === "completed" && !!dl.token &&
                  dl.expiresAt && new Date(dl.expiresAt) > new Date();
                const isSelected = selected.has(dl.id);
                const isNew = i >= prevVisibleRef.current;
                const isRemoving = removingIds.has(dl.id);
                return (
                  <li
                    key={dl.id}
                    onClick={selectMode && !isRemoving ? () => toggleSelect(dl.id) : undefined}
                    style={{
                      gap: selectMode ? "0.75rem" : "0px",
                      ...(isNew && !isRemoving ? { animationDelay: `${(i - prevVisibleRef.current) * 40}ms` } : {}),
                    }}
                    className={cn(
                      "flex items-center rounded-lg px-3 py-2.5 bg-muted/40 text-sm",
                      "transition-[gap,background-color,box-shadow] duration-200",
                      isNew && !isRemoving && "animate-in fade-in-0 slide-in-from-bottom-2 [animation-fill-mode:backwards]",
                      isRemoving && "animate-out fade-out-0 zoom-out-95 duration-200 pointer-events-none [animation-fill-mode:forwards]",
                      selectMode && !isRemoving && "cursor-pointer",
                      selectMode && isSelected && "bg-primary/5 ring-1 ring-primary/20"
                    )}
                  >
                    <div
                      style={{ width: selectMode ? "1rem" : "0px", transition: "width 200ms ease-out" }}
                      className="shrink-0 overflow-hidden"
                    >
                      <div className={cn(
                        "size-4 rounded border-2 flex items-center justify-center transition-colors duration-150",
                        isSelected ? "bg-ring border-ring" : "border-border"
                      )}>
                        {isSelected && <Check className="size-2.5 text-white animate-in zoom-in-50 duration-100" />}
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={dl.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => selectMode && e.preventDefault()}
                          className="text-[0.8125rem] font-medium truncate hover:underline"
                        >
                          {dl.title ?? hostOf(dl.url)}
                        </a>
                        <StatusBadge status={dl.status} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span>{dl.userEmail ?? dl.userId.slice(0, 8)}</span>
                        <span className="opacity-40">·</span>
                        <span>{formatLabel(dl.format)}</span>
                        {dl.fileSize && (
                          <>
                            <span className="opacity-40">·</span>
                            <span>{fmtBytes(dl.fileSize)}</span>
                          </>
                        )}
                        <span className="opacity-40">·</span>
                        {(() => {
                          const { display, full } = fmtDownloadTime(dl.createdAt, t);
                          return <span title={full} className="cursor-default">{display}</span>;
                        })()}
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
                      {dl.status === "error" && dl.errorMessage && (
                        <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                          <AlertCircle className="size-3 shrink-0" />
                          {dl.errorMessage.slice(0, 80)}
                        </p>
                      )}
                    </div>
                    <div className={cn(
                      "shrink-0 flex items-center gap-1 transition-opacity duration-150",
                      selectMode ? "opacity-0 pointer-events-none" : "opacity-100"
                    )}>
                      {isActive && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground mr-1">
                          <Loader2 className="size-3.5 animate-spin" />
                        </span>
                      )}
                      {canDownload && (
                        <a href={`/api/downloads/${dl.id}/file?token=${dl.token}`}>
                          <Button size="icon-sm" variant="ghost" title={t("titleDownload")}>
                            <Download className="size-3.5 text-muted-foreground hover:text-primary" />
                          </Button>
                        </a>
                      )}
                      {canDelete && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); void deleteDownload(dl.id); }}
                          disabled={!!loading[`dl-delete-${dl.id}`]}
                          title={isActive ? t("titleCancel") : t("titleDelete")}
                        >
                          {loading[`dl-delete-${dl.id}`] ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                          )}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {dlList.length > visibleCount && (
              <button
                onClick={() => { prevVisibleRef.current = visibleCount; setVisibleCount((c) => c + PAGE_SIZE); }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-2 border border-border/60 rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
              >
                {t("loadMore", { count: dlList.length - visibleCount })}
              </button>
            )}
          </>
        )}
      </section>
    </>
  );
}
