'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Point } from '@/db/database';

interface DeletePointModalProps {
  deletingPoint: Point | null;
  onClose: () => void;
  onConfirm: () => void;
  isUpdatingMatrix: boolean;
}

export default function DeletePointModal({
  deletingPoint,
  onClose,
  onConfirm,
  isUpdatingMatrix,
}: DeletePointModalProps) {
  if (!deletingPoint) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
      >
        <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
          <Trash2 className="w-6 h-6 text-rose-500" />
          Usuń Lokalizację
        </h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
          Czy na pewno chcesz usunąć punkt{' '}
          <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{deletingPoint.name}</strong> z bazy danych?
        </p>
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
          >
            Anuluj
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isUpdatingMatrix}
            className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-500 transition cursor-pointer disabled:opacity-50"
          >
            {isUpdatingMatrix ? 'Usuwanie...' : 'Usuń Punkt'}
          </button>
        </div>
      </div>
    </div>
  );
}
