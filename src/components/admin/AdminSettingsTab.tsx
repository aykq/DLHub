"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Loader2, Settings } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AdminSettings } from "./AdminDashboard";

interface Props {
  initialSettings: AdminSettings;
}

export function AdminSettingsTab({ initialSettings }: Props) {
  const t = useTranslations("admin");
  const [form, setForm] = useState<AdminSettings>(initialSettings);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

    </section>
  );
}
