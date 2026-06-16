import { auth } from "@/lib/auth";
import { Download } from "lucide-react";
import Link from "next/link";

interface NavbarProps {
  maxWidth?: string;
  extraActions?: React.ReactNode;
}

export async function Navbar({ maxWidth = "max-w-3xl", extraActions }: NavbarProps) {
  const session = await auth();

  const userImage = session?.user?.image;
  const displayName = session?.user?.name ?? session?.user?.email ?? "";
  const initials =
    displayName
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={`mx-auto ${maxWidth} px-4 h-14 flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2 font-bold text-base select-none">
          <Download className="size-4" />
          DLHub
        </Link>

        <div className="flex items-center gap-2">
          {extraActions}
          {session?.user && (
            <Link href="/profile" aria-label="Profil">
              {userImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={userImage}
                  alt=""
                  className="size-8 rounded-full ring-2 ring-border hover:ring-primary transition-all"
                />
              ) : (
                <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-border hover:ring-primary transition-all select-none">
                  {initials}
                </div>
              )}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
