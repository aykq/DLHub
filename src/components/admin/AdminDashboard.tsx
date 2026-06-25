"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Users, Download, HardDrive, Clock, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { fmtBytes } from "@/lib/format";
import { AdminUsersTab } from "./AdminUsersTab";
import { AdminDownloadsTab } from "./AdminDownloadsTab";
import { AdminSettingsTab } from "./AdminSettingsTab";

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

export function AdminDashboard({ initialStats, initialUsers, initialDownloads, initialSettings }: Props) {
  const t = useTranslations("admin");
  const { confirm: askConfirm, ConfirmDialog } = useConfirm();
  const [stats, setStats] = useState<AdminStats>(initialStats);
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [dlList, setDlList] = useState<AdminDownload[]>(initialDownloads);
  const [cronLoading, setCronLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cronResult, setCronResult] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<"7d" | "30d" | "all">("all");
  const [activeTab, setActiveTab] = useState<"users" | "downloads" | "settings">("users");

  const pendingUsers = users.filter((u) => u.status === "pending");

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

  useEffect(() => {
    function handleNotification() { void refresh(); }
    window.addEventListener("dlhub:notification", handleNotification);
    return () => window.removeEventListener("dlhub:notification", handleNotification);
  }, [refresh]);

  async function changePeriod(period: "7d" | "30d" | "all") {
    setStatsPeriod(period);
    const statsRes = await fetch(`/api/admin/stats?period=${period}`);
    if (statsRes.ok) setStats(await statsRes.json() as AdminStats);
  }

  async function runCron() {
    setCronLoading(true);
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
      setCronLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {ConfirmDialog}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={runCron} disabled={cronLoading} className="gap-1.5">
            {cronLoading ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
            {t("cleanup")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={isRefreshing} className="gap-1.5">
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Users className="size-4" />} label={t("statUsers")} value={stats.totalUsers} />
        <StatCard icon={<Clock className="size-4 text-yellow-500" />} label={t("statPending")} value={stats.pendingUsers} highlight={stats.pendingUsers > 0} />
        <StatCard icon={<Download className="size-4 text-blue-500" />} label={t("statActive")} value={stats.activeDownloads} />
        <StatCard icon={<HardDrive className="size-4" />} label={t("statDisk")} value={stats.diskUsage !== null ? fmtBytes(stats.diskUsage) : "—"} />
      </div>

      <div role="tablist" className="flex gap-1.5">
        {(
          [
            { key: "users", label: t("tabUsers"), badge: pendingUsers.length },
            { key: "downloads", label: t("tabDownloads"), badge: 0 },
            { key: "settings", label: t("tabSettings"), badge: 0 },
          ] as const
        ).map(({ key, label, badge }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => setActiveTab(key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
              activeTab === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {label}
            {badge > 0 && (
              <span className={cn(
                "inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] rounded-full text-[0.6rem] font-bold px-1",
                activeTab === key ? "bg-white/20 text-primary-foreground" : "bg-yellow-500 text-white"
              )}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </div>

      <div key={activeTab} className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
        {activeTab === "users" && (
          <AdminUsersTab
            users={users}
            setUsers={setUsers}
            setStats={setStats}
            askConfirm={askConfirm}
          />
        )}
        {activeTab === "downloads" && (
          <AdminDownloadsTab
            dlList={dlList}
            setDlList={setDlList}
            stats={stats}
            statsPeriod={statsPeriod}
            changePeriod={changePeriod}
            askConfirm={askConfirm}
          />
        )}
        {activeTab === "settings" && (
          <AdminSettingsTab initialSettings={initialSettings} />
        )}
      </div>
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
    <div className={cn(
      "rounded-xl border p-4 space-y-2",
      highlight ? "border-yellow-500/40 bg-yellow-500/5" : "border-border bg-card"
    )}>
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className={cn("text-2xl font-bold tabular-nums", highlight && "text-yellow-600 dark:text-yellow-400")}>
        {value}
      </p>
    </div>
  );
}
