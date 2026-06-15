"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function ForceSignoutPage() {
  useEffect(() => {
    document.cookie = "dlhub-pending=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    void signOut({ callbackUrl: "/login" });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Çıkış yapılıyor...</p>
    </div>
  );
}
