"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Clock, Loader2 } from "lucide-react";

type State = "idle" | "loading" | "pending" | "email-sent" | "error" | "blocked";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setState("loading");
    try {
      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json() as { ok?: boolean; status?: string; error?: string };
      if (!res.ok || !data.ok) {
        setState(data.error === "blocked" ? "blocked" : "error");
        return;
      }
      if (data.status === "pending") {
        router.push("/pending");
      } else {
        setState("email-sent");
      }
    } catch {
      setState("error");
    }
  }

  if (state === "email-sent") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-full bg-green-500/10 p-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-sm font-medium">Giriş linki gönderildi</p>
          <p className="text-xs text-muted-foreground">{email} adresini kontrol edin</p>
        </div>
      </div>
    );
  }

  if (state === "pending") {
    return (
      <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-full bg-muted p-3">
          <Clock className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-sm font-medium">Onay bekleniyor...</p>
          <p className="text-xs text-muted-foreground">Yönlendiriliyorsunuz</p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="email"
        placeholder="E-posta adresiniz"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        disabled={state === "loading"}
      />
      {state === "error" && (
        <p className="text-xs text-destructive text-center">
          Bir hata oluştu. Lütfen tekrar deneyin.
        </p>
      )}
      {state === "blocked" && (
        <p className="text-xs text-destructive text-center">
          Bu hesaba erişim engellendi.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={state === "loading" || !email}>
        {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Magic Link Gönder"}
      </Button>
    </form>
  );
}
