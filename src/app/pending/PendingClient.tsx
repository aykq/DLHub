"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
const PENDING_COOKIE_NAME = "dlhub-pending";

interface PendingClientProps {
  userName: string | null;
  userEmail: string | null;
  userId: string;
  hasSession: boolean;
}

function clearPendingCookie() {
  document.cookie = `${PENDING_COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

export function PendingClient({ userName, userEmail, userId, hasSession }: PendingClientProps) {
  const router = useRouter();
  const t = useTranslations("pending");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const es = new EventSource("/api/me/approval-stream");
    es.onmessage = async (event) => {
      const data = JSON.parse(event.data as string) as { status: string };

      if (data.status === "approved") {
        es.close();
        clearInterval(intervalRef.current);
        if (hasSession) {
          router.push("/");
        } else {
          const result = await signIn("pending-approval", { userId, redirect: false });
          if (result && !result.error) {
            clearPendingCookie();
            router.push("/");
          }
        }
      }

      if (data.status === "blocked") {
        es.close();
        clearInterval(intervalRef.current);
        if (hasSession) {
          router.push("/blocked");
        } else {
          clearPendingCookie();
          window.location.href = "/login?error=AccessDenied";
        }
      }

      if (data.status === "deleted") {
        es.close();
        clearInterval(intervalRef.current);
        clearPendingCookie();
        window.location.href = hasSession ? "/force-signout" : "/login";
      }
    };
    es.onerror = () => es.close();

    // Polling fallback — SSE kopunca devreye girer
    async function checkStatus() {
      try {
        const res = await fetch("/api/me/status");
        const data = await res.json() as { status: string };
        if (data.status === "approved") {
          clearInterval(intervalRef.current);
          if (hasSession) {
            router.push("/");
          } else {
            const result = await signIn("pending-approval", { userId, redirect: false });
            if (result && !result.error) {
              clearPendingCookie();
              router.push("/");
            }
          }
        }
        if (data.status === "blocked") {
          clearInterval(intervalRef.current);
          if (hasSession) {
            router.push("/blocked");
          } else {
            clearPendingCookie();
            window.location.href = "/login?error=AccessDenied";
          }
        }
        if (data.status === "unknown") {
          clearInterval(intervalRef.current);
          clearPendingCookie();
          window.location.href = hasSession ? "/force-signout" : "/login";
        }
      } catch {
        // ignore
      }
    }
    intervalRef.current = setInterval(checkStatus, 5000);

    return () => {
      es.close();
      clearInterval(intervalRef.current);
    };
  }, [router, hasSession, userId]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8 text-center">
        <h1 className="text-4xl font-black tracking-tight">DLHub</h1>

        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="rounded-full bg-muted p-4">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          {(userName || userEmail) && (
            <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm space-y-0.5">
              {userName && <p className="font-medium">{userName}</p>}
              {userEmail && <p className="text-muted-foreground">{userEmail}</p>}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={() => {
            clearPendingCookie();
            if (hasSession) {
              void signOut({ callbackUrl: "/login" });
            } else {
              window.location.href = "/login";
            }
          }}
        >
          {t("signOut")}
        </Button>
      </div>
    </div>
  );
}
