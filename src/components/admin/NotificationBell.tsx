"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  message: string;
  userId: string | null;
  read: boolean;
  createdAt: string;
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

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    fetchNotifications();

    const es = new EventSource("/api/admin/notifications/stream");
    es.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as Notification;
      setNotifications((prev) => [{ ...data, read: false }, ...prev].slice(0, 50));
      window.dispatchEvent(new CustomEvent("dlhub:notification", { detail: data }));
    };
    return () => es.close();
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/admin/notifications");
      if (res.ok) setNotifications(await res.json() as Notification[]);
    } catch { /* ignore */ }
  }

  async function markAllRead() {
    try {
      await fetch("/api/admin/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark-all-read" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch { /* ignore */ }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open && unreadCount > 0) markAllRead();
        }}
        className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors cursor-pointer"
        aria-label="Bildirimler"
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[14px] h-[14px] rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground px-0.5">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Bildirimler
            </span>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Bildirim yok</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto divide-y divide-border">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "px-4 py-3 text-sm",
                    !n.read && "bg-muted/40"
                  )}
                >
                  <p className="leading-snug">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
