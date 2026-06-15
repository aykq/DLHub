"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  status: string;
  role: string;
  createdAt: string;
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
}

export interface AdminStats {
  totalUsers: number;
  pendingUsers: number;
  activeDownloads: number;
  diskUsage: number | null;
}

interface Props {
  initialStats: AdminStats;
  initialUsers: AdminUser[];
  initialDownloads: AdminDownload[];
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

function StatusBadge({ status }: { status: string }) {
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
    pending: "Bekliyor",
    approved: "Onaylı",
    blocked: "Engelli",
    downloading: "İndiriliyor",
    completed: "Tamamlandı",
    error: "Hata",
    expired: "Süresi Doldu",
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

export function AdminDashboard({ initialStats, initialUsers, initialDownloads }: Props) {
  const [stats, setStats] = useState<AdminStats>(initialStats);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [dlList, setDlList] = useState<AdminDownload[]>(initialDownloads);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);

  function setItemLoading(key: string, val: boolean) {
    setLoading((prev) => ({ ...prev, [key]: val }));
  }

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [usersRes, dlRes, statsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/downloads"),
        fetch("/api/admin/stats"),
      ]);
      if (usersRes.ok) setUsers(await usersRes.json() as AdminUser[]);
      if (dlRes.ok) setDlList(await dlRes.json() as AdminDownload[]);
      if (statsRes.ok) setStats(await statsRes.json() as AdminStats);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

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
          `Temizlik tamamlandı — süresi dolan: ${data.expiredRemoved ?? 0}, takılı kalan: ${data.stuckReset ?? 0}` +
            (data.errors?.length ? ` | Hatalar: ${data.errors.join(", ")}` : "")
        );
        await refresh();
      } else {
        setCronResult(`Hata: ${data.error ?? "bilinmeyen"}`);
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
    if (!confirm("Bu kullanıcıyı silmek istediğinize emin misiniz?")) return;
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
    if (!confirm("Bu indirmeyi iptal/silmek istediğinize emin misiniz?")) return;
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
          <h1 className="text-xl font-bold">Admin Paneli</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Sistem yönetimi</p>
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
            Temizlik
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={refresh}
            disabled={isRefreshing}
            className="gap-1.5"
          >
            <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
            Yenile
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
          label="Toplam Kullanıcı"
          value={stats.totalUsers}
        />
        <StatCard
          icon={<Clock className="size-4 text-yellow-500" />}
          label="Bekleyen"
          value={stats.pendingUsers}
          highlight={stats.pendingUsers > 0}
        />
        <StatCard
          icon={<Download className="size-4 text-blue-500" />}
          label="Aktif İndirme"
          value={stats.activeDownloads}
        />
        <StatCard
          icon={<HardDrive className="size-4" />}
          label="Disk Kullanımı"
          value={stats.diskUsage !== null ? fmtBytes(stats.diskUsage) : "—"}
        />
      </div>

      {/* Bekleyen Kullanıcılar */}
      {pendingUsers.length > 0 && (
        <section className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
            <Clock className="size-3.5" />
            Bekleyen Kullanıcılar ({pendingUsers.length})
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
                    Onayla
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
                    Reddet
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
          Tüm Kullanıcılar ({users.length})
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Kullanıcı yok</p>
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
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {u.status === "pending" && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => updateUserStatus(u.id, "approved")}
                      disabled={!!loading[`user-${u.id}-approved`]}
                      title="Onayla"
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
                      title="Engelle"
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
                      title="Engeli Kaldır"
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
                    title="Sil"
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

      {/* İndirmeler */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
          <Download className="size-3.5" />
          İndirmeler ({dlList.length})
        </h2>
        {dlList.length === 0 ? (
          <p className="text-sm text-muted-foreground">İndirme yok</p>
        ) : (
          <ul className="space-y-1.5">
            {dlList.map((dl) => {
              const isActive = dl.status === "downloading" || dl.status === "pending";
              const canDelete = dl.status !== "expired";
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
                      <span>{timeAgo(dl.createdAt)}</span>
                    </p>
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
                    {canDelete && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => deleteDownload(dl.id)}
                        disabled={!!loading[`dl-delete-${dl.id}`]}
                        title={isActive ? "İptal Et" : "Sil"}
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
