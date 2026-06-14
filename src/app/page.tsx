import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true, role: true },
  });

  if (!dbUser || dbUser.status === "pending") redirect("/pending");
  if (dbUser.status === "blocked") redirect("/login?error=AccessDenied");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold">DLHub</h1>
      <p className="mt-2 text-muted-foreground">İndirme arayüzü yakında...</p>
    </main>
  );
}
