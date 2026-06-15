"use client";

import { useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const SITES = [
  { name: "YouTube", domain: "youtube.com" },
  { name: "YouTube Music", domain: "music.youtube.com" },
  { name: "YouTube Shorts", domain: "youtube.com/shorts" },
  { name: "Instagram", domain: "instagram.com" },
  { name: "Twitter / X", domain: "x.com" },
  { name: "TikTok", domain: "tiktok.com" },
  { name: "Reddit", domain: "reddit.com" },
  { name: "Twitch", domain: "twitch.tv" },
  { name: "Kick", domain: "kick.com" },
  { name: "Vimeo", domain: "vimeo.com" },
  { name: "Dailymotion", domain: "dailymotion.com" },
  { name: "Facebook", domain: "facebook.com" },
  { name: "Snapchat", domain: "snapchat.com" },
  { name: "LinkedIn", domain: "linkedin.com" },
  { name: "Pinterest", domain: "pinterest.com" },
  { name: "Tumblr", domain: "tumblr.com" },
  { name: "9GAG", domain: "9gag.com" },
  { name: "Imgur", domain: "imgur.com" },
  { name: "Coub", domain: "coub.com" },
  { name: "Streamable", domain: "streamable.com" },
  { name: "Rumble", domain: "rumble.com" },
  { name: "Odysee", domain: "odysee.com" },
  { name: "Bilibili", domain: "bilibili.com" },
  { name: "Youku", domain: "youku.com" },
  { name: "iQIYI", domain: "iqiyi.com" },
  { name: "Weibo", domain: "weibo.com" },
  { name: "Niconico", domain: "nicovideo.jp" },
  { name: "Naver TV", domain: "tv.naver.com" },
  { name: "VK", domain: "vk.com" },
  { name: "OK.ru", domain: "ok.ru" },
  { name: "Rutube", domain: "rutube.ru" },
  { name: "SoundCloud", domain: "soundcloud.com" },
  { name: "Bandcamp", domain: "bandcamp.com" },
  { name: "Mixcloud", domain: "mixcloud.com" },
  { name: "Audiomack", domain: "audiomack.com" },
  { name: "Crunchyroll", domain: "crunchyroll.com" },
  { name: "Nebula", domain: "nebula.tv" },
  { name: "Floatplane", domain: "floatplane.com" },
  { name: "Dropout", domain: "dropout.tv" },
  { name: "BBC iPlayer", domain: "bbc.co.uk" },
  { name: "Arte", domain: "arte.tv" },
  { name: "ESPN", domain: "espn.com" },
  { name: "Hotstar", domain: "hotstar.com" },
  { name: "TED", domain: "ted.com" },
  { name: "Veoh", domain: "veoh.com" },
] as const;

export function SupportedSites() {
  const t = useTranslations("sites");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!query.trim()) return SITES;
    const q = query.toLowerCase();
    return SITES.filter(
      (s) => s.name.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q)
    );
  }, [query]);

  return (
    <div className="text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
      >
        <ChevronDown
          className={cn("size-3.5 transition-transform duration-200", open && "rotate-180")}
        />
        {t("title")}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder={t("search")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
              autoFocus
            />
          </div>

          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">{t("noResults")}</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {filtered.map((s) => (
                <span
                  key={s.domain}
                  className="inline-flex items-center px-2.5 py-1 rounded-full bg-muted text-xs text-muted-foreground"
                >
                  {s.name}
                </span>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground/60">{t("ytdlpNote")}</p>
        </div>
      )}
    </div>
  );
}
