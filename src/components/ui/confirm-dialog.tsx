"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive";
}

interface ConfirmState extends ConfirmOptions {
  resolve: (v: boolean) => void;
}

export function useConfirm() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setState((prev) => { prev?.resolve(false); return null; });
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [state]);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ ...options, resolve })),
    []
  );

  const close = useCallback((value: boolean) => {
    setState((prev) => { prev?.resolve(value); return null; });
  }, []);

  const ConfirmDialog = state ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-150"
        onClick={() => close(false)}
      />
      <div className="relative z-10 w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-6 space-y-5 animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200">
        <p className="text-sm leading-relaxed">{state.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => close(false)}>
            {state.cancelLabel ?? "İptal"}
          </Button>
          <Button
            variant={state.variant === "destructive" ? "destructive" : "default"}
            size="sm"
            onClick={() => close(true)}
          >
            {state.confirmLabel ?? "Tamam"}
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirm, ConfirmDialog };
}
