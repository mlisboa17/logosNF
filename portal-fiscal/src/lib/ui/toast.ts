/**
 * Sistema de notificações/toasts para feedback ao usuário
 * Tipos: success, error, warning, info, loading
 */

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 = permanent
  action?: {
    label: string;
    onClick: () => void;
  };
}

// Store global de toasts (usar com Context API em produção)
let toasts: Toast[] = [];
let listeners: ((toasts: Toast[]) => void)[] = [];

export function subscribe(listener: (toasts: Toast[]) => void) {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notify(toasts: Toast[]) {
  listeners.forEach((listener) => listener(toasts));
}

export function showToast(options: Omit<Toast, "id">): string {
  const id = Math.random().toString(36).substr(2, 9);
  const toast: Toast = { ...options, id };

  toasts = [...toasts, toast];
  notify(toasts);

  // Auto-remove se tiver duração
  if (options.duration !== 0) {
    setTimeout(() => {
      removeToast(id);
    }, options.duration || 3000);
  }

  return id;
}

export function removeToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  notify(toasts);
}

export function clearToasts() {
  toasts = [];
  notify(toasts);
}

// Helpers para tipos comuns
export const toast = {
  success: (title: string, message?: string) =>
    showToast({ type: "success", title, message, duration: 3000 }),

  error: (title: string, message?: string) =>
    showToast({ type: "error", title, message, duration: 5000 }),

  warning: (title: string, message?: string) =>
    showToast({ type: "warning", title, message, duration: 4000 }),

  info: (title: string, message?: string) =>
    showToast({ type: "info", title, message, duration: 3000 }),

  loading: (title: string, message?: string) =>
    showToast({ type: "loading", title, message, duration: 0 }),
};
