'use client';

import React from 'react';
import { Users, User, UserPlus, Trash2, Download, Upload, FileJson } from 'lucide-react';
import { Employee } from '@/db/database';

interface BackupTabProps {
  handleAddEmployee: (e: React.FormEvent) => void;
  newEmployeeName: string;
  setNewEmployeeName: (name: string) => void;
  employees: Employee[];
  handleDeleteEmployee: (id: number | undefined, name: string) => void;

  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleExportBackup: () => void;

  pointsCount: number;
  savedUserRoutesCount: number;
  savedRoutesCount: number;
}

export default function BackupTab({
  handleAddEmployee,
  newEmployeeName,
  setNewEmployeeName,
  employees,
  handleDeleteEmployee,

  fileInputRef,
  handleFileChange,
  handleExportBackup,

  pointsCount,
  savedUserRoutesCount,
  savedRoutesCount,
}: BackupTabProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block px-1">
        Ustawienia i Kopia Zapasowa
      </span>

      {/* Card 0: Zarządzanie Pracownikami */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-3 text-left">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg flex-shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Zarządzanie Pracownikami
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Dodawaj imiona pracowników, które będzie można przypisywać do zapisywanych tras.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddEmployee} className="flex gap-2">
          <input
            type="text"
            placeholder="Imię pracownika (np. Jan Kowalski)..."
            value={newEmployeeName}
            onChange={e => setNewEmployeeName(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text"
          />
          <button
            type="submit"
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Dodaj</span>
          </button>
        </form>

        {/* List of employees */}
        <div className="space-y-1.5 pt-1 max-h-[160px] overflow-y-auto pr-1">
          {employees.length === 0 ? (
            <p className="text-xs text-zinc-400 italic">Brak dodanych pracowników.</p>
          ) : (
            employees.map(emp => (
              <div
                key={emp.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs font-medium"
              >
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-zinc-800 dark:text-zinc-200 font-bold">{emp.name}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteEmployee(emp.id, emp.name)}
                  title="Usuń pracownika"
                  className="p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Card 1: Export Backup */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-3 text-left">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-lg flex-shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Pobierz Kopię Zapasową (.json)
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Zapisz plik kopii ze wszystkimi punktami ({pointsCount}), grupami tras ({savedUserRoutesCount}) oraz
              historią tras ({savedRoutesCount}) na swój komputer.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExportBackup}
          className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Pobierz plik JSON na komputer</span>
        </button>
      </div>

      {/* Card 2: Restore Backup */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 space-y-3 text-left">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg flex-shrink-0">
            <Upload className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
              Przywróć dane z pliku JSON
            </h4>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Wczytaj wcześniej pobrany plik .json, aby przywrócić zapamiętane punkty i trasy (z możliwością
              scalenia lub zastąpienia).
            </p>
          </div>
        </div>

        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-400 rounded-xl p-4 text-center cursor-pointer transition bg-white/50 dark:bg-zinc-900/50 space-y-1.5 group"
        >
          <FileJson className="w-7 h-7 mx-auto text-zinc-400 group-hover:text-amber-500 transition-colors" />
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
            Kliknij, aby wybrać plik .json z komputera
          </p>
          <p className="text-[10px] text-zinc-400">
            Obsługiwany format: transport_backup_*.json
          </p>
        </div>
      </div>
    </div>
  );
}
