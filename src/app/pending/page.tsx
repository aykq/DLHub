import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getPendingUserId } from "@/lib/pending-cookie";
import { PendingClient } from "./PendingClient";

export default async function PendingPage() {
  // 1. JWT session kontrolü (Google OAuth veya onaylı magic link kullanıcısı)
  const session = await auth();
  if (session?.user?.id) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { status: true },
    });
    if (!user) redirect("/force-signout");
    if (user.status === "approved") redirect("/");
    if (user.status === "blocked") redirect("/blocked");

    return (
      <PendingClient
        userName={session.user.name ?? null}
        userEmail={session.user.email ?? null}
        userId={session.user.id}
        hasSession={true}
      />
    );
  }

  // 2. Pending cookie kontrolü (magic link yeni kullanıcı)
  const pendingUserId = await getPendingUserId();
  if (pendingUserId) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, pendingUserId),
      columns: { status: true, name: true, email: true },
    });
    if (!user) redirect("/login");
    if (user.status === "approved") redirect("/");
    if (user.status === "blocked") redirect("/login?error=AccessDenied");

    return (
      <PendingClient
        userName={user.name ?? null}
        userEmail={user.email ?? null}
        userId={pendingUserId}
        hasSession={false}
      />
    );
  }

  redirect("/login");
}
