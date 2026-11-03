'use client';

import React from 'react';
import { ToastItem } from '@/types/ui';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 md:top-6 right-0 left-0 md:left-auto md:right-8 z-50 flex flex-col items-center md:items-end gap-2 px-4 pointer-events-none"
    >
      {toasts.map((toast) => {
        const type = toast.type || 'info';

        const iconMap = {
          success: <CheckCircle2 className="w-4 h-4 text-success shrink-0" />,
          error: <AlertCircle className="w-4 h-4 text-danger shrink-0" />,
          warning: <AlertTriangle className="w-4 h-4 text-accent shrink-0" />,
          info: <Info className="w-4 h-4 text-ink-2 shrink-0" />,
        }[type];

        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-control shadow-float bg-surface border border-line text-sm max-w-md w-full md:w-auto animate-in slide-in-from-top-3 duration-200'
            )}
          >
            {iconMap}
            <span className="flex-1 text-xs md:text-sm text-ink font-medium">
              {toast.message}
            </span>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="text-xs font-semibold text-accent hover:underline cursor-pointer shrink-0"
              >
                {toast.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="text-ink-3 hover:text-ink cursor-pointer shrink-0 p-0.5"
              aria-label="關閉通知"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
