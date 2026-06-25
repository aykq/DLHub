"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Users, Clock, Loader2, CheckCircle, XCircle, Trash2, ShieldCheck, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { StatusBadge } from "./admin-utils";
import type { AdminUser, AdminStats } from "./AdminDashboard";

type AskConfirm = (opts: {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive";
}) => Promise<boolean>;

interface Props {
  users: AdminUser[];
  setUsers: React.Dispatch<React.SetStateAction<AdminUser[]>>;
  setStats: React.Dispatch<React.SetStateAction<AdminStats>>;
  askConfirm: AskConfirm;
}

export function AdminUsersTab({ users, setUsers, setStats, askConfirm }: Props) {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pendingUsers = users.filter((u) => u.status === "pending");

  function setItemLoading(key: string, val: boolean) {
    setLoading((prev) => ({ ...prev, [key]: val }));
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
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, status } : u)));
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
    if (!(await askConfirm({
      message: t("deleteUserConfirm"),
      confirmLabel: t("titleDelete"),
      cancelLabel: t("selectCancel"),
      variant: "destructive",
    }))) return;
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

  async function deleteSelected() {
    if (selected.size === 0) return;
    if (!(await askConfirm({
      message: t("deleteSelectedConfirm", { count: selected.size }),
      confirmLabel: t("titleDelete"),
      cancelLabel: t("selectCancel"),
      variant: "destructive",
    }))) return;
    const ids = Array.from(selected);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => !ids.includes(u.id)));
      setStats((prev) => ({ ...prev, totalUsers: prev.totalUsers - ids.length }));
      exitSelectMode();
    }
  }

  return (
    <>
      {pendingUsers.length > 0 && (
        <section className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-5 space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-600 dark:text-yellow-400 flex items-center gap-1.5">
            <Clock className="size-3.5" />
            {t("pendingSection")} ({pendingUsers.length})
          </h2>
          <ul className="space-y-2">
            {pendingUsers.map((u) => (
              <li key={u.id} className="flex items-center gap-3 rounded-lg bg-background border border-border px-4 py-3">
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
                    {loading[`user-${u.id}-approved`] ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5" />}
                    {t("approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => updateUserStatus(u.id, "blocked")}
                    disabled={!!loading[`user-${u.id}-blocked`]}
                    className="gap-1"
                  >
                    {loading[`user-${u.id}-blocked`] ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5" />}
                    {t("reject")}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5 shrink-0">
            <Users className="size-3.5" />
            {t("allUsers")} ({users.length})
          </h2>
          <div className="relative flex items-center gap-1.5 shrink-0">
            <div className={cn(
              "flex items-center gap-1.5 transition-all duration-200",
              selectMode ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
            )}>
              <Button size="sm" variant="ghost" onClick={() => setSelectMode(true)} className="h-7 px-2.5 text-xs">
                {t("selectMode")}
              </Button>
            </div>
            <div className={cn(
              "absolute right-0 flex items-center gap-1.5 transition-all duration-200",
              selectMode ? "opacity-100 scale-100" : "opacity-0 pointer-events-none scale-95"
            )}>
              <Button size="sm" variant="ghost" onClick={exitSelectMode} className="h-7 px-2.5 text-xs">
                {t("selectCancel")}
              </Button>
              <Button size="sm" variant="destructive" onClick={() => void deleteSelected()} disabled={selected.size === 0} className="h-7 px-2.5 text-xs">
                {t("deleteSelected", { count: selected.size })}
              </Button>
            </div>
          </div>
        </div>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noUsers")}</p>
        ) : (
          <ul className="space-y-1.5">
            {users.map((u) => {
              const isSelected = selected.has(u.id);
              return (
                <li
                  key={u.id}
                  onClick={selectMode ? () => toggleSelect(u.id) : undefined}
                  style={{ gap: selectMode ? "0.75rem" : "0px" }}
                  className={cn(
                    "flex items-center rounded-lg px-3 py-2.5 bg-muted/40",
                    "transition-[gap,background-color,box-shadow] duration-200",
                    selectMode && "cursor-pointer",
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
                      <span className="text-sm font-medium truncate">{u.name ?? u.email}</span>
                      {u.role === "admin" && <ShieldCheck className="size-3.5 text-primary shrink-0" />}
                      <StatusBadge status={u.status} />
                      {u.dailyLimit > 0 && (
                        <span className={cn(
                          "text-[0.65rem] px-1.5 py-0.5 rounded font-medium",
                          u.todayCount >= u.dailyLimit
                            ? "bg-destructive/15 text-destructive"
                            : u.todayCount >= Math.ceil(u.dailyLimit * 0.8)
                            ? "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {u.todayCount}/{u.dailyLimit}
                        </span>
                      )}
                    </div>
                    {u.dailyLimit > 0 && (
                      <div className="mt-1.5">
                        <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-[width]",
                              u.todayCount >= u.dailyLimit ? "bg-destructive"
                                : u.todayCount >= Math.ceil(u.dailyLimit * 0.8) ? "bg-yellow-500"
                                : "bg-primary"
                            )}
                            style={{ width: `${Math.min(100, (u.todayCount / u.dailyLimit) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{u.email}</p>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 shrink-0 transition-opacity duration-150",
                    selectMode ? "opacity-0 pointer-events-none" : "opacity-100"
                  )}>
                    {u.status === "pending" && (
                      <Button size="icon-sm" variant="ghost" onClick={() => updateUserStatus(u.id, "approved")} disabled={!!loading[`user-${u.id}-approved`]} title={t("approve")}>
                        {loading[`user-${u.id}-approved`] ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5 text-green-500" />}
                      </Button>
                    )}
                    {u.status === "approved" && (
                      <Button size="icon-sm" variant="ghost" onClick={() => updateUserStatus(u.id, "blocked")} disabled={!!loading[`user-${u.id}-blocked`]} title={t("titleBlock")}>
                        {loading[`user-${u.id}-blocked`] ? <Loader2 className="size-3.5 animate-spin" /> : <XCircle className="size-3.5 text-muted-foreground hover:text-destructive" />}
                      </Button>
                    )}
                    {u.status === "blocked" && (
                      <Button size="icon-sm" variant="ghost" onClick={() => updateUserStatus(u.id, "approved")} disabled={!!loading[`user-${u.id}-approved`]} title={t("titleUnblock")}>
                        {loading[`user-${u.id}-approved`] ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle className="size-3.5 text-muted-foreground hover:text-green-500" />}
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={(e) => { e.stopPropagation(); void deleteUser(u.id); }} disabled={!!loading[`user-delete-${u.id}`]} title={t("titleDelete")}>
                      {loading[`user-delete-${u.id}`] ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
