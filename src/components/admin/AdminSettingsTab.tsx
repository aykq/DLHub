"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Loader2, Settings, Upload, CircleDot, Circle } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { AdminSettings } from "./AdminDashboard";

interface Props {
  initialSettings: AdminSettings;
}

interface CookieStatus {
  exists: boolean;
  lastModified: string | null;
}

function fmtRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export function AdminSettingsTab({ initialSettings }: Props) {
  const t = useTranslations("admin");
  const [form, setForm] = useState<AdminSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [cookieStatus, setCookieStatus] = useState<CookieStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadDone, setUploadDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/admin/cookies/vk")
      .then((r) => r.json())
      .then((data: CookieStatus) => setCookieStatus(data))
      .catch(() => setCookieStatus({ exists: false, lastModified: null }));
  }, []);

  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleCookieFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadDone(false);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/cookies/vk", { method: "POST", body: fd });
      if (res.ok) {
        setCookieStatus({ exists: true, lastModified: new Date().toISOString() });
        setUploadDone(true);
        setTimeout(() => setUploadDone(false), 3000);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4 animate-in fade-in-0 duration-200">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
        <Settings className="size-3.5" />
        {t("settingsSection")}
      </h2>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("dailyLimitLabel")}</label>
          <Input
            type="number"
            min="0"
            value={form.daily_download_limit}
            onChange={(e) => setForm((prev) => ({ ...prev, daily_download_limit: e.target.value }))}
            className="h-8 w-32 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("whitelistLabel")}</label>
          <Input
            placeholder="youtube.com, twitter.com, tiktok.com"
            value={form.whitelist_domains}
            onChange={(e) => setForm((prev) => ({ ...prev, whitelist_domains: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">{t("expiryHoursLabel")}</label>
          <Input
            type="number"
            min="1"
            value={form.download_expiry_hours}
            onChange={(e) => setForm((prev) => ({ ...prev, download_expiry_hours: e.target.value }))}
            className="h-8 w-32 text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={saveSettings} disabled={saving}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : t("save")}
          </Button>
          {saved && (
            <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
              <CheckCircle className="size-3.5" />
              {t("saved")}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-border pt-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          VK Authentication
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            {cookieStatus === null ? (
              <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
            ) : cookieStatus.exists ? (
              <>
                <CircleDot className="size-3.5 text-green-500" />
                <span className="text-muted-foreground text-xs">
                  Active
                  {cookieStatus.lastModified && (
                    <> · updated {fmtRelative(cookieStatus.lastModified)}</>
                  )}
                </span>
              </>
            ) : (
              <>
                <Circle className="size-3.5 text-muted-foreground/50" />
                <span className="text-muted-foreground/60 text-xs">Not configured</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {uploadDone && (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1 animate-in fade-in-0 duration-150">
                <CheckCircle className="size-3.5" />
                Uploaded
              </span>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              className="hidden"
              onChange={(e) => void handleCookieFile(e)}
            />
            <Button
              size="sm"
              variant="outline"
              className={cn("h-7 px-2.5 text-xs gap-1.5", uploading && "pointer-events-none")}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading
                ? <Loader2 className="size-3 animate-spin" />
                : <Upload className="size-3" />}
              {cookieStatus?.exists ? "Replace cookies" : "Upload cookies"}
            </Button>
          </div>
        </div>
        <p className="text-[0.7rem] text-muted-foreground/60">
          Export from VK using the <span className="font-medium">"Get cookies.txt LOCALLY"</span> browser extension. Cookies typically stay valid for a few months.
        </p>
      </div>
    </section>
  );
}
