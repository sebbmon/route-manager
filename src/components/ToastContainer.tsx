'use client';

import React from 'react';
import { CheckCircle2, Info, Loader2, X } from 'lucide-react';

export interface ToastItem {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="fixed bottom-10 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none max-w-md w-full sm:w-auto">
      {toasts.map(toast => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';
        const isInfo = toast.type === 'info';

        const borderClass = isSuccess
          ? 'border-emerald-200 dark:border-emerald-900/60'
          : isError
          ? 'border-rose-200 dark:border-rose-900/60'
          : isWarning
          ? 'border-amber-300 dark:border-amber-700/60'
          : 'border-indigo-200 dark:border-indigo-900/60';

        const textClass = isSuccess
          ? 'text-emerald-700 dark:text-emerald-300'
          : isError
          ? 'text-rose-700 dark:text-rose-300'
          : isWarning
          ? 'text-amber-800 dark:text-amber-200'
          : 'text-indigo-700 dark:text-indigo-300';

        const progressBarColor = isSuccess
          ? 'bg-emerald-500'
          : isError
          ? 'bg-rose-500'
          : isWarning
          ? 'bg-amber-500'
          : 'bg-indigo-500';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto relative overflow-hidden flex items-center gap-3 px-4.5 py-3.5 bg-white dark:bg-zinc-900 border shadow-2xl rounded-2xl text-sm font-bold animate-slide-in max-w-md ${borderClass} ${textClass}`}
          >
            {isSuccess && <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />}
            {isError && <Info className="w-5 h-5 flex-shrink-0 text-rose-500" />}
            {isWarning && <Loader2 className="w-5 h-5 flex-shrink-0 text-amber-500 animate-spin" />}
            {isInfo && <Info className="w-5 h-5 flex-shrink-0 text-indigo-500" />}

            <span className="pr-3 leading-snug flex-1 select-none">{toast.message}</span>

            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Countdown Progress Bar */}
            {toast.duration > 0 && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-200/50 dark:bg-zinc-800/60 overflow-hidden">
                <div
                  className={`h-full w-full ${progressBarColor}`}
                  style={{
                    transformOrigin: 'left',
                    animation: `toastCountdown ${toast.duration}ms linear forwards`,
                  }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
