import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Download } from "lucide-react";
import Link from "next/link";
import { UserMenu } from "@/components/layout/UserMenu";

interface NavbarProps {
  maxWidth?: string;
  extraActions?: React.ReactNode;
}

export async function Navbar({ maxWidth = "max-w-2xl", extraActions }: NavbarProps) {
  const session = await auth();

  const userImage = session?.user?.image;

  let isAdmin = false;
  if (session?.user?.id) {
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { role: true },
    });
    isAdmin = dbUser?.role === "admin";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className={`mx-auto ${maxWidth} px-4 h-14 flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2 select-none group">
          <div className="flex size-7 items-center justify-center rounded-lg bg-foreground text-background transition-transform group-hover:scale-105">
            <Download className="size-3.5" />
          </div>
          <span className="font-heading font-extrabold text-base tracking-tight">DLHub</span>
        </Link>

        <div className="flex items-center gap-2">
          {extraActions}
          {session?.user && (
            <UserMenu
              user={{
                name: session.user.name,
                email: session.user.email,
                image: userImage,
              }}
              isAdmin={isAdmin}
            />
          )}
        </div>
      </div>
    </header>
  );
}
