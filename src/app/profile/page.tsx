import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ProfileClient } from "./ProfileClient";
import { PageTransitionWrapper } from "@/components/layout/PageTransitionWrapper";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const dbUser = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { status: true, role: true },
  });

  if (!dbUser) redirect("/force-signout");
  if (dbUser.status === "blocked") redirect("/blocked");

  return (
    <main className="flex-1 w-full">
      <PageTransitionWrapper>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <ProfileClient
            user={{
              name: session.user.name,
              email: session.user.email,
              image: session.user.image,
            }}
            isAdmin={dbUser.role === "admin"}
          />
        </div>
      </PageTransitionWrapper>
    </main>
  );
}
