"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Loader2 } from "lucide-react";

export function MagicLinkForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/send-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        setError(true);
      } else {
        setSent(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="rounded-full bg-green-500/10 p-3">
          <CheckCircle2 className="h-6 w-6 text-green-500" />
        </div>
        <div className="text-center space-y-0.5">
          <p className="text-sm font-medium">Giriş linki gönderildi</p>
          <p className="text-xs text-muted-foreground">{email}</p>
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
        disabled={loading}
      />
      {error && (
        <p className="text-xs text-destructive text-center">
          Bir hata oluştu. Lütfen tekrar deneyin.
        </p>
      )}
      <Button type="submit" className="w-full" disabled={loading || !email}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Magic Link Gönder"}
      </Button>
    </form>
  );
}
