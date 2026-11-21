import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs: number;
}

@Injectable({ providedIn: 'root' })
export class AdminToastService {
  readonly toasts = signal<ToastMessage[]>([]);

  show(type: ToastType, title: string, message?: string, durationMs = 3500): void {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newToast: ToastMessage = { id, type, title, message, durationMs };

    this.toasts.update((current) => [...current, newToast]);

    if (durationMs > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, durationMs);
    }
  }

  success(title: string, message?: string, durationMs = 3500): void {
    this.show('success', title, message, durationMs);
  }

  error(title: string, message?: string, durationMs = 4500): void {
    this.show('error', title, message, durationMs);
  }

  warning(title: string, message?: string, durationMs = 4000): void {
    this.show('warning', title, message, durationMs);
  }

  info(title: string, message?: string, durationMs = 3500): void {
    this.show('info', title, message, durationMs);
  }

  dismiss(id: string): void {
    this.toasts.update((current) => current.filter((t) => t.id !== id));
  }
}
