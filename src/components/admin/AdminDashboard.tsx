"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  Download,
  HardDrive,
  Clock,
  RefreshCw,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
  AlertCircle,
  ShieldCheck,
  BarChart2,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status: string;
  role: string;
  createdAt: string;
  todayCount: number;
  dailyLimit: number;
}

export interface AdminDownload {
  id: string;
  url: string;
  title: string | null;
  format: string;
  status: string;
  fileSize: number | null;
  expiresAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  token?: string | null;
  duration?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  width?: number | null;
  height?: number | null;
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  activeDownloads: number;
  diskUsage: number | null;
  totalDownloadedBytes: number;
  platformStats: { domain: string; count: number; bytes: number }[];
}

export interface AdminSettings {
  daily_download_limit: string;
  whitelist_domains: string;
  download_expiry_hours: string;
}

interface Props {
  initialStats: AdminStats;
  initialUsers: AdminUser[];
  initialDownloads: AdminDownload[];
  initialSettings: AdminSettings;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

type TFn = ReturnType<typeof useTranslations<"admin">>;

function timeAgo(dateStr: string, t: TFn): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return t("timeNow");
  if (m < 60) return t("timeMin", { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("timeHour", { count: h });
  return t("timeDay", { count: Math.floor(h / 24) });
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

function StatusBadge({ status }: { status: string }) {
  const t = useTranslations("admin");
  const map: Record<string, string> = {
    pending: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
    approved: "bg-green-500/15 text-green-600 dark:text-green-400",
    blocked: "bg-destructive/15 text-destructive",
    downloading: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    completed: "bg-green-500/15 text-green-600 dark:text-green-400",
    error: "bg-destructive/15 text-destructive",
    expired: "bg-muted text-muted-foreground",
  };
  const labels: Record<string, string> = {
    pending: t("statusPending"),
    approved: t("statusApproved"),
    blocked: t("statusBlocked"),
    downloading: t("statusDownloading"),
    completed: t("statusCompleted"),
    error: t("statusError"),
    expired: t("statusExpired"),
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[0.7rem] font-medium",
        map[status] ?? "bg-muted text-muted-foreground"
      )}
    >
      {labels[status] ?? status}
    </span>
  );
}

export function AdminDashboard({ initialStats, initialUsers, initialDownloads, initialSettings }: Props) {
  const t = useTranslations("admin");
  const [stats, setStats] = useState<AdminStats>(initialStats);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [dlList, setDlList] = useState<AdminDownload[]>(initialDownloads);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [settingsForm, setSettingsForm] = useState<AdminSettings>(initialSettings);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"7d" | "30d" | "all">("all");

  function setItemLoading(key: string, val: boolean) {
    setLoading((prev) => ({ ...prev, [key]: val }));
  }

  const refresh = useCallback(async (period?: string, silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const p = period ?? statsPeriod;
      const [usersRes, dlRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/downloads"),
        fetch(`/api/admin/stats?period=${p}`),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json() as AdminUser[]);
      if (dlRes.ok) setDlList(await dlRes.json() as AdminDownload[]);
      if (statsRes.ok) setStats(await statsRes.json() as AdminStats);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statsPeriod]);

  useEffect(() => {
    const id = setInterval(() => { void refresh(undefined, true); }, 30_000);
    return () => clearInterval(id);
  }, [refresh]);

  async function changePeriod(period: "7d" | "30d" | "all") {
    setStatsPeriod(period);
    const statsRes = await fetch(`/api/admin/stats?period=${period}`);
    if (statsRes.ok) setStats(await statsRes.json() as AdminStats);
  }

  async function saveSettings() {
    setSettingsSaving(true);
    setSettingsSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm),
      });
      if (res.ok) setSettingsSaved(true);
    } finally {
      setSettingsSaving(false);
    }
  }

  useEffect(() => {
    function handleNotification() { void refresh(); }
    window.addEventListener("dlhub:notification", handleNotification);
    return () => window.removeEventListener("dlhub:notification", handleNotification);
  }, [refresh]);

  async function runCron() {
    setItemLoading("cron", true);
    setCronResult(null);
    try {
      const res = await fetch("/api/admin/cron/run", { method: "POST" });
      const data = await res.json() as { ok?: boolean; expiredRemoved?: number; stuckReset?: number; errors?: string[]; error?: string };
      if (res.ok) {
        setCronResult(
          t("cronDone", { expired: data.expiredRemoved ?? 0, stuck: data.stuckReset ?? 0 }) +
            (data.errors?.length ? t("cronErrors", { errors: data.errors.join(", ") }) : "")
        );
        await refresh();
      } else {
        setCronResult(t("cronError", { error: data.error ?? "unknown" }));
      }
    } finally {
      setItemLoading("cron", false);
    }
  }

  async function updateUserStatus(userId: string, status: string) {
    const key = `user-${userId}-${status}`;
    setItemLoading(key, true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, status } : u))
        );
        setStats((prev) => ({
          ...prev,
          pendingUsers: prev.pendingUsers + (status === "approved" ? -1 : 0),
        }));
      }
    } finally {
      setItemLoading(key, false);
    }
  }

  async function deleteUser(userId: string) {
    if (!confirm(t("deleteUserConfirm"))) return;
    const key = `user-delete-${userId}`;
    setItemLoading(key, true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.id !== userId));
        setStats((prev) => ({ ...prev, totalUsers: prev.totalUsers - 1 }));
      }
    } finally {
      setItemLoading(key, false);
    }
  }

  async function deleteDownload(dlId: string) {
    if (!confirm(t("deleteDownloadConfirm"))) return;
    const key = `dl-delete-${dlId}`;
    setItemLoading(key, true);
    try {
      const res = await fetch(`/api/admin/downloads/${dlId}`, { method: "DELETE" });
      if (res.ok) {
        setDlList((prev) =>
          prev.map((dl) => (dl.id === dlId ? { ...dl, status: "expired" } : dl))
        );
      }
    } finally {
      setItemLoading(key, false);
    }
  }

  const pendingUsers = users.filter((u) => u.status === "pending");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runCron}
            disabled={!!loading["cron"]}
            className="gap-1.5"
          >
            {loading["cron"] ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Clock className="size-3.5" />
            )}
            {t("cleanup")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {cronResult && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
          {cronResult}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="size-4" />}
          label={t("statUsers")}
          value={stats.totalUsers}
        />
        <StatCard
          icon={<Clock className="size-4 text-yellow-500" />}
          label={t("statPending")}
          value={stats.pendingUsers}
          highlight={stats.pendingUsers > 0}
        />
        <StatCard
          icon={<Download className="size-4 text-blue-500" />}
          label={t("statActive")}
          value={stats.activeDownloads}
        />
        <StatCard
          icon={<HardDrive className="size-4" />}
          label={t("statDisk")}
          value={stats.diskUsage !== null ? fmtBytes(stats.diskUsage) : "—"}
        />
      </div>

      {/* Bekleyen Kullanıcılar */}
      {pendingUsers.length > 0 && (
        <section className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {t("pendingSection")} ({pendingUsers.length})
          </h2>
          <ul className="space-y-2">
            {pendingUsers.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-lg bg-background border border-border px-4 py-3"
              >
                {u.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.image} alt="" className="size-8 rounded-full shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{u.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => updateUserStatus(u.id, "approved")}
                    disabled={!!loading[`user-${u.id}-approved`]}
                    className="gap-1"
                  >
                    {loading[`user-${u.id}-approved`] ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <CheckCircle className="size-3.5" />
                    )}
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateUserStatus(u.id, "blocked")}
                    disabled={!!loading[`user-${u.id}-blocked`]}
                    className="gap-1"
                  >
                    {loading[`user-${u.id}-blocked`] ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <XCircle className="size-3.5" />
                    )}
                    {t("reject")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Tüm Kullanıcılar */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Users className="size-3.5" />
          {t("allUsers")} ({users.length})
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noUsers")}</p>
        ) : (
          <ul className="space-y-1.5">
            {users.map((u) => (
              <li
                key={u.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-muted/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{u.name ?? u.email}</span>
                    {u.role === "admin" && (
                      <ShieldCheck className="size-3.5 text-primary shrink-0" />
                    )}
                    <StatusBadge status={u.status} />
                    {u.dailyLimit > 0 && (
                      <span
                        className={cn(
                          "text-[0.65rem] px-1.5 py-0.5 rounded font-medium",
                          u.todayCount >= u.dailyLimit
                            ? "bg-destructive/15 text-destructive"
                            : u.todayCount >= Math.ceil(u.dailyLimit * 0.8)
                            ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {u.todayCount}/{u.dailyLimit}
                      </span>
                    )}
                  </div>
                  {u.dailyLimit > 0 && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-[width]",
                            u.todayCount >= u.dailyLimit
                              ? "bg-destructive"
                              : u.todayCount >= Math.ceil(u.dailyLimit * 0.8)
                              ? "bg-yellow-500"
                              : "bg-primary"
                          )}
                          style={{ width: `${Math.min(100, (u.todayCount / u.dailyLimit) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {u.status === "pending" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => updateUserStatus(u.id, "approved")}
                      disabled={!!loading[`user-${u.id}-approved`]}
                      title={t("approve")}
                    >
                      {loading[`user-${u.id}-approved`] ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="size-3.5 text-green-500" />
                      )}
                    </Button>
                  )}
                  {u.status === "approved" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => updateUserStatus(u.id, "blocked")}
                      disabled={!!loading[`user-${u.id}-blocked`]}
                      title={t("titleBlock")}
                    >
                      {loading[`user-${u.id}-blocked`] ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <XCircle className="size-3.5 text-muted-foreground hover:text-destructive" />
                      )}
                    </Button>
                  )}
                  {u.status === "blocked" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => updateUserStatus(u.id, "approved")}
                      disabled={!!loading[`user-${u.id}-approved`]}
                      title={t("titleUnblock")}
                    >
                      {loading[`user-${u.id}-approved`] ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <CheckCircle className="size-3.5 text-muted-foreground hover:text-green-500" />
                      )}
                    </Button>
                  )}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => deleteUser(u.id)}
                    disabled={!!loading[`user-delete-${u.id}`]}
                    title={t("titleDelete")}
                  >
                    {loading[`user-delete-${u.id}`] ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    )}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* İstatistikler */}
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
                  onClick={() => void changePeriod(p)}
                  className={cn(
                    "text-[0.65rem] px-2 py-0.5 rounded font-medium transition-colors",
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
                        style={{
                          width: `${Math.round((p.count / (stats.platformStats[0]?.count || 1)) * 100)}%`,
                        }}
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

      {/* İndirmeler */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Download className="size-3.5" />
          {t("downloadsSection")} ({dlList.length})
        </h2>
        {dlList.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noDownloads")}</p>
        ) : (
          <ul className="space-y-1.5">
            {dlList.map((dl) => {
              const isActive = dl.status === "downloading" || dl.status === "pending";
              const canDelete = dl.status !== "expired";
              const canDownload = dl.status === "completed" && !!dl.token &&
                dl.expiresAt && new Date(dl.expiresAt) > new Date();
              return (
                <li
                  key={dl.id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-muted/40 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[0.8125rem] font-medium truncate">
                        {dl.title ?? hostOf(dl.url)}
                      </span>
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
                      <span>{timeAgo(dl.createdAt, t)}</span>
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
                  <div className="shrink-0 flex items-center gap-1">
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
                        onClick={() => deleteDownload(dl.id)}
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
        )}
      </section>

      {/* Ayarlar */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Settings className="size-3.5" />
          {t("settingsSection")}
        </h2>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("dailyLimitLabel")}
            </label>
            <Input
              type="number"
              min="0"
              value={settingsForm.daily_download_limit}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, daily_download_limit: e.target.value }))
              }
              className="h-8 w-32 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("whitelistLabel")}
            </label>
            <Input
              placeholder="youtube.com, twitter.com, tiktok.com"
              value={settingsForm.whitelist_domains}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, whitelist_domains: e.target.value }))
              }
              className="h-8 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("expiryHoursLabel")}
            </label>
            <Input
              type="number"
              min="1"
              value={settingsForm.download_expiry_hours}
              onChange={(e) =>
                setSettingsForm((prev) => ({ ...prev, download_expiry_hours: e.target.value }))
              }
              className="h-8 w-32 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={saveSettings} disabled={settingsSaving}>
              {settingsSaving ? <Loader2 className="size-3.5 animate-spin" /> : t("save")}
            </Button>
            {settingsSaved && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle className="size-3.5" />
                {t("saved")}
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 space-y-2",
        highlight ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"
      )}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p
        className={cn(
          "text-2xl font-bold tabular-nums",
          highlight && "text-yellow-600 dark:text-yellow-400"
        )}
      >
        {value}
      </p>
    </div>
  );
}
