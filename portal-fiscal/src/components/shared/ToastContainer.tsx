"use client";

import { useEffect, useState } from "react";
import { subscribe, removeToast, type Toast } from "@/lib/ui/toast";

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const unsubscribe = subscribe(setToasts);
    return unsubscribe;
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-md">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`rounded-lg p-4 shadow-lg animate-in fade-in slide-in-from-right-4 transition-all ${getToastStyles(toast.type)}`}
          role="alert"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-semibold">{toast.title}</p>
              {toast.message && <p className="text-sm opacity-90 mt-1">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-xl leading-none hover:opacity-70 transition-opacity"
              aria-label="Fechar notificação"
            >
              ×
            </button>
          </div>

          {toast.action && (
            <button
              onClick={() => {
                toast.action!.onClick();
                removeToast(toast.id);
              }}
              className="mt-3 text-sm font-semibold underline hover:opacity-80 transition-opacity"
            >
              {toast.action.label}
            </button>
          )}

          {toast.type === "loading" && (
            <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
              <div className="h-full bg-white/80 animate-pulse" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function getToastStyles(type: Toast["type"]): string {
  switch (type) {
    case "success":
      return "bg-emerald-100 text-emerald-900 border border-emerald-300";
    case "error":
      return "bg-red-100 text-red-900 border border-red-300";
    case "warning":
      return "bg-amber-100 text-amber-900 border border-amber-300";
    case "info":
      return "bg-blue-100 text-blue-900 border border-blue-300";
    case "loading":
      return "bg-slate-100 text-slate-900 border border-slate-300";
  }
}
