import { signOut } from "@/lib/auth";

export default async function ForceSignoutPage() {
  await signOut({ redirectTo: "/login" });
}
