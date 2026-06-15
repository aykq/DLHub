import { auth, signOut } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Download, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

interface NavbarProps {
  maxWidth?: string;
  extraActions?: React.ReactNode;
}

export async function Navbar({ maxWidth = "max-w-2xl", extraActions }: NavbarProps) {
  const session = await auth();

  const isAdmin =
    session?.user?.id
      ? (await db.query.users.findFirst({
          where: eq(users.id, session.user.id),
          columns: { role: true },
        }))?.role === "admin"
      : false;

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={`mx-auto ${maxWidth} px-4 h-14 flex items-center justify-between gap-4`}>
        <Link href="/" className="flex items-center gap-2 font-bold text-base select-none">
          <Download className="size-4" />
          DLHub
        </Link>

        <div className="flex items-center gap-1">
          {extraActions}
          {isAdmin && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted"
            >
              <ShieldCheck className="size-3.5" />
              Admin
            </Link>
          )}
          <ThemeToggle />
          {session?.user && (
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/login" });
              }}
            >
              <button
                type="submit"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2.5 py-1.5 rounded-md hover:bg-muted cursor-pointer"
              >
                {session.user.name?.split(" ")[0] ?? session.user.email}
                <span className="text-muted-foreground/60 ml-1.5">· Çıkış</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}
