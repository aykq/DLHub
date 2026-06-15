import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { Navbar } from "@/components/layout/Navbar";
import { NotificationBell } from "@/components/admin/NotificationBell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { role: true },
  });

  if (dbUser?.role !== "admin") redirect("/");

  return (
    <>
      <Navbar maxWidth="max-w-3xl" extraActions={<NotificationBell />} />
      {children}
    </>
  );
}
