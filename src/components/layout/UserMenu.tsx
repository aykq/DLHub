"use client";

import { useState } from "react";
import { Menu } from "@base-ui/react/menu";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { LanguageToggle } from "@/components/layout/LanguageToggle";
import { cn } from "@/lib/utils";

interface Props {
  user: {
    name: string | null | undefined;
    email: string | null | undefined;
    image: string | null | undefined;
  };
  isAdmin: boolean;
}

function Avatar({
  image,
  initials,
  className,
}: {
  image: string | null | undefined;
  initials: string;
  className?: string;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt="" className={cn("rounded-full object-cover", className)} />;
  }
  return (
    <div
      className={cn(
        "rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary select-none",
        className
      )}
    >
      {initials}
    </div>
  );
}

export function UserMenu({ user, isAdmin }: Props) {
  const t = useTranslations("profile");
  const [isSigningOut, setIsSigningOut] = useState(false);

  const displayName = user.name ?? user.email ?? "";
  const initials =
    displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  async function handleSignOut() {
    setIsSigningOut(true);
    await signOut({ callbackUrl: "/login" });
  }

  const itemClass =
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm cursor-pointer outline-none select-none transition-colors data-[highlighted]:bg-muted data-[highlighted]:text-foreground";

  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={displayName || "Account"}
        className="group rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <Avatar
          image={user.image}
          initials={initials}
          className="size-8 text-xs ring-2 ring-border transition-all group-hover:ring-primary group-aria-expanded:ring-primary"
        />
      </Menu.Trigger>

      <Menu.Portal>
        <Menu.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
          <Menu.Popup
            className={cn(
              "min-w-60 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg",
              "transition-[transform,opacity] duration-150 motion-reduce:transition-none",
              "data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            {/* Hesap başlığı */}
            <div className="flex items-center gap-3 px-2.5 py-2">
              <Avatar image={user.image} initials={initials} className="size-9 text-sm shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold leading-tight">{user.name ?? "—"}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <Menu.Separator className="my-1 h-px bg-border" />

            {/* Tema & Dil — tıklayınca menü kapanmasın diye Menu.Item değil */}
            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
              <span className="text-sm">{t("theme")}</span>
              <ThemeToggle full />
            </div>
            <div className="flex items-center justify-between gap-3 px-2.5 py-1.5">
              <span className="text-sm">{t("language")}</span>
              <LanguageToggle />
            </div>

            <Menu.Separator className="my-1 h-px bg-border" />

            {isAdmin && (
              <Menu.LinkItem render={<Link href="/admin" />} className={itemClass}>
                <LayoutDashboard className="size-4 shrink-0 text-muted-foreground" />
                {t("adminPanel")}
              </Menu.LinkItem>
            )}

            <Menu.Item
              onClick={handleSignOut}
              disabled={isSigningOut}
              className={cn(
                itemClass,
                "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",
                isSigningOut && "opacity-50"
              )}
            >
              <LogOut className="size-4 shrink-0" />
              {t("signOut")}
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
