import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyApprovalToken } from "@/lib/admin-token";
import { broadcastUserStatus, broadcastNotification } from "@/lib/notifications";
import { signIn } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export default async function ApprovePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token, approved, blocked } = await searchParams as { token?: string; approved?: string; blocked?: string };

  if (approved) return <SuccessPage message="User approved." />;
  if (blocked) return <SuccessPage message="User blocked." />;

  if (!token) {
    return <ErrorPage message="Invalid link." />;
  }

  const payload = verifyApprovalToken(token);
  if (!payload) {
    return <ErrorPage message="Link is invalid or has expired." />;
  }

  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.userId),
    columns: { id: true, name: true, email: true, image: true, status: true },
  });

  if (!user) {
    return <ErrorPage message="User not found." />;
  }

  if (user.status === "approved") {
    return <SuccessPage message={`${user.name ?? user.email} is already approved.`} />;
  }

  async function approve() {
    "use server";
    if (!payload || !user) return;
    await db.update(users).set({ status: "approved" }).where(eq(users.id, payload.userId));
    broadcastUserStatus(payload.userId, { status: "approved" });
    broadcastNotification({
      type: "user_approved",
      message: `User approved: ${user.email ?? user.name ?? "—"}`,
      userId: payload.userId,
      createdAt: new Date().toISOString(),
    });
    if (user.email) {
      try {
        await signIn("nodemailer", { email: user.email, redirect: false, callbackUrl: "/" });
      } catch {}
    }
    redirect("/admin/approve?approved=1");
  }

  async function block() {
    "use server";
    if (!payload || !user) return;
    await db.update(users).set({ status: "blocked" }).where(eq(users.id, payload.userId));
    broadcastUserStatus(payload.userId, { status: "blocked" });
    broadcastNotification({
      type: "user_blocked",
      message: `User blocked: ${user.email ?? user.name ?? "—"}`,
      userId: payload.userId,
      createdAt: new Date().toISOString(),
    });
    redirect("/admin/approve?blocked=1");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <h1 className="text-2xl font-bold">User Approval</h1>

        <div className="rounded-lg border bg-card p-4 text-left space-y-2 text-sm">
          {user.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className="w-12 h-12 rounded-full mx-auto mb-3" />
          )}
          <p><span className="text-muted-foreground">Name:</span> {user.name ?? "—"}</p>
          <p><span className="text-muted-foreground">Email:</span> {user.email ?? "—"}</p>
          <p><span className="text-muted-foreground">Status:</span> {user.status}</p>
        </div>

        <div className="flex gap-3">
          <form action={approve} className="flex-1">
            <Button type="submit" className="w-full">Approve</Button>
          </form>
          <form action={block} className="flex-1">
            <Button type="submit" variant="destructive" className="w-full">Block</Button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ErrorPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-destructive">{message}</p>
    </div>
  );
}

function SuccessPage({ message }: { message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-green-600 font-medium">{message}</p>
    </div>
  );
}
