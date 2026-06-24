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
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className={`mx-auto ${maxWidth} px-4 h-14 flex items-center justify-between`}>
        <Link href="/" className="flex items-center gap-2 font-bold text-base select-none">
          <Download className="size-4" />
          DLHub
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
