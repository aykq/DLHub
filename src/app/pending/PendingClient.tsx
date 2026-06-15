"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface PendingClientProps {
  userName: string | null;
  userEmail: string | null;
}

export function PendingClient({ userName, userEmail }: PendingClientProps) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    // SSE for instant notification when admin approves/blocks
    const es = new EventSource("/api/me/approval-stream");
    es.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as { status: string };
      if (data.status === "approved") router.push("/");
      if (data.status === "blocked") signOut({ callbackUrl: "/login?error=AccessDenied" });
    };
    es.onerror = () => es.close();

    // Polling fallback in case SSE fails or connection drops
    async function checkStatus() {
      try {
        const res = await fetch("/api/me/status");
        const data = await res.json() as { status: string };
        if (data.status === "approved") router.push("/");
        if (data.status === "blocked") signOut({ callbackUrl: "/login?error=AccessDenied" });
      } catch {
        // ignore
      }
    }
    intervalRef.current = setInterval(checkStatus, 5000);

    return () => {
      es.close();
      clearInterval(intervalRef.current);
    };
  }, [router]);

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
            <h2 className="text-xl font-semibold">Onay Bekleniyor</h2>
            <p className="text-sm text-muted-foreground">
              Hesabınız inceleniyor. Onaylandığında otomatik olarak yönlendirileceksiniz.
            </p>
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
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Çıkış Yap
        </Button>
      </div>
    </div>
  );
}
