import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sendSignInDiscordNotification } from "./discord";
import { createNotification, broadcastNotification } from "./notifications";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID ?? "",
      clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      authorization: { params: { prompt: "select_account" } },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY ?? "",
      from: "DLHub <noreply@dlhub.aykq.org.tr>",
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  events: {
    async signIn({ user, account, profile, isNewUser }) {
      // Google profile bilgilerini güncelle
      if (account?.provider === "google" && user.id && profile) {
        const update: { image?: string; name?: string } = {};
        if (profile.picture && user.image !== profile.picture) update.image = profile.picture as string;
        if (profile.name && user.name !== profile.name) update.name = profile.name as string;
        if (Object.keys(update).length > 0) {
          await db.update(users).set(update).where(eq(users.id, user.id));
        }
      }

      // İlk girişte admin emaili ise admin rolü ver
      if (isNewUser && user.email === process.env.ADMIN_EMAIL && user.id) {
        await db
          .update(users)
          .set({ role: "admin", status: "approved" })
          .where(eq(users.id, user.id));
      }

      // Giriş bildirimi — Discord + in-app notification
      if (user.id && account?.provider) {
        const notificationMessage = isNewUser
          ? `Yeni kullanıcı: ${user.name ?? user.email} (${account.provider})`
          : `Giriş yapıldı: ${user.name ?? user.email} (${account.provider})`;

        const notificationType = isNewUser ? "new_user" : "sign_in";

        try {
          await Promise.all([
            sendSignInDiscordNotification({
              userId: user.id,
              name: user.name ?? null,
              email: user.email ?? null,
              provider: account.provider,
              image: user.image ?? null,
              isNewUser: !!isNewUser,
              signedInAt: new Date(),
            }),
            createNotification(notificationType, notificationMessage, user.id),
          ]);

          broadcastNotification({
            type: notificationType,
            message: notificationMessage,
            userId: user.id,
            name: user.name ?? null,
            email: user.email ?? null,
            image: user.image ?? null,
            isNewUser: !!isNewUser,
            createdAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error("Sign-in notification failed:", err);
        }
      }
    },
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.id) return true;
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
        columns: { status: true },
      });
      if (dbUser?.status === "blocked") return false;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
        if (user.image) token.picture = user.image;
        if (user.name) token.name = user.name;
      }
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      if (token.picture) session.user.image = token.picture as string;
      if (token.name) session.user.name = token.name as string;
      return session;
    },
  },
});
