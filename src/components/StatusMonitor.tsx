"use client";

import { useEffect } from "react";

export function StatusMonitor() {
  useEffect(() => {
    async function check() {
      try {
        const res = await fetch("/api/me/status");
        if (!res.ok) return;
        const data = await res.json() as { status: string };
        if (data.status === "blocked") {
          window.location.href = "/blocked";
        } else if (data.status === "unknown") {
          window.location.href = "/force-signout";
        }
      } catch {
        // ağ hatalarını yoksay
      }
    }

    const interval = setInterval(check, 10_000);
    return () => clearInterval(interval);
  }, []);

  return null;
}
