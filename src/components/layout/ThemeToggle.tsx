"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, Monitor } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", icon: Sun },
  { value: "system", icon: Monitor },
  { value: "dark", icon: Moon },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const currentIndex = THEMES.findIndex((t) => t.value === theme);
  const CurrentIcon = THEMES[currentIndex]?.icon ?? Monitor;
  const nextValue = THEMES[(currentIndex + 1) % THEMES.length]!.value;

  return (
    <>
      {/* Mobile: single cycling button */}
      <button
        className="sm:hidden p-1.5 rounded-md transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
        onClick={() => setTheme(nextValue)}
        aria-label={theme ?? "system"}
      >
        <CurrentIcon className="size-3.5" />
      </button>

      {/* Desktop: 3-way selector */}
      <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-border p-0.5">
        {THEMES.map(({ value, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={cn(
              "p-1.5 rounded-md transition-colors cursor-pointer",
              theme === value
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-label={value}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>
    </>
  );
}
