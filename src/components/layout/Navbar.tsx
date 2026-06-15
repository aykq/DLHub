import { auth, signOut } from "@/lib/auth";
import { ThemeToggle } from "./ThemeToggle";
import { Download } from "lucide-react";
import Link from "next/link";

export async function Navbar() {
  const session = await auth();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-base select-none">
          <Download className="size-4" />
          DLHub
        </Link>

        <div className="flex items-center gap-1">
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
