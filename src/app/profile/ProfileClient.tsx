"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { ShieldCheck, LogOut, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

interface Props {
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    image: string | null | undefined;
  };
  isAdmin: boolean;
}

export function ProfileClient({ user, isAdmin }: Props) {
  const t = useTranslations("profile");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const initials =
    (user.name ?? user.email ?? "?")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
      >
        <ArrowLeft className="size-3.5" />
        {t("back")}
      </Link>

      {/* Kullanıcı bilgisi */}
      <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-14 rounded-full shrink-0" />
        ) : (
          <div className="size-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0 select-none">
            {initials}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-base truncate">{user.name ?? "—"}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>

      {/* Tema & Dil */}
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium">{t("theme")}</span>
          <ThemeToggle full />
        </div>
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-medium">{t("language")}</span>
          <LanguageToggle />
        </div>
      </div>

      {/* Admin paneli */}
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-5 py-4 hover:bg-muted/40 transition-colors"
        >
          <ShieldCheck className="size-4 text-primary shrink-0" />
          <span className="text-sm font-medium">{t("adminPanel")}</span>
        </Link>
      )}

      {/* Çıkış */}
      <Button
        variant="outline"
        className="w-full gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        onClick={handleSignOut}
        disabled={isSigningOut}
      >
        <LogOut className="size-4" />
        {t("signOut")}
      </Button>
    </div>
  );
}
