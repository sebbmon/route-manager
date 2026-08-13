'use client';

import React from 'react';
import { Upload } from 'lucide-react';
import { DatabaseBackupData } from '@/db/database';

interface ImportBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  importBackupData: DatabaseBackupData | null;
  onConfirmImport: (mode: 'overwrite' | 'merge') => void;
}

export default function ImportBackupModal({
  isOpen,
  onClose,
  importBackupData,
  onConfirmImport,
}: ImportBackupModalProps) {
  if (!isOpen || !importBackupData) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
      >
        <h3 className="text-lg font-extrabold text-amber-600 dark:text-amber-400 flex items-center gap-2.5">
          <Upload className="w-6 h-6 text-amber-500" />
          Przywróć dane z pliku kopii
        </h3>

        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
          <div className="flex justify-between text-zinc-500">
            <span>Data utworzenia kopii:</span>
            <span className="font-bold text-zinc-800 dark:text-zinc-200">
              {importBackupData.exportedAt ? new Date(importBackupData.exportedAt).toLocaleString('pl-PL') : 'Nieznana'}
            </span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Punkty w pliku:</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {importBackupData.points?.length || 0} punktów
            </span>
          </div>
          <div className="flex justify-between text-zinc-500">
            <span>Trasy w historii:</span>
            <span className="font-bold text-amber-600 dark:text-amber-400">
              {importBackupData.routes_history?.length || 0} tras
            </span>
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Wybierz sposób wczytania danych z wybranego pliku JSON:
        </p>

        <div className="space-y-2.5 pt-1">
          <button
            type="button"
            onClick={() => onConfirmImport('merge')}
            className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <span>Scal z obecną bazą (Dopisz dane)</span>
          </button>

          <button
            type="button"
            onClick={() => onConfirmImport('overwrite')}
            className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <span>Zastąp całą bazę (Nadpisz obecne dane)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-bold transition cursor-pointer"
          >
            Anuluj
          </button>
        </div>
      </div>
    </div>
  );
}
