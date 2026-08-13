'use client';

import React from 'react';
import { Edit3, Trash2, User, ChevronDown, Check } from 'lucide-react';
import { RouteHistory, Employee } from '@/db/database';

interface HistoryRouteModalsProps {
  editingRoute: RouteHistory | null;
  setEditingRoute: (route: RouteHistory | null) => void;
  editRouteName: string;
  setEditRouteName: (name: string) => void;
  editEmployeeName: string;
  setEditEmployeeName: (name: string) => void;
  employees: Employee[];
  isEditRouteEmployeeSelectOpen: boolean;
  setIsEditRouteEmployeeSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleUpdateRoute: (e: React.FormEvent) => void;

  deletingRoute: RouteHistory | null;
  setDeletingRoute: (route: RouteHistory | null) => void;
  handleConfirmDeleteRoute: () => void;
}

export default function HistoryRouteModals({
  editingRoute,
  setEditingRoute,
  editRouteName,
  setEditRouteName,
  editEmployeeName,
  setEditEmployeeName,
  employees,
  isEditRouteEmployeeSelectOpen,
  setIsEditRouteEmployeeSelectOpen,
  handleUpdateRoute,

  deletingRoute,
  setDeletingRoute,
  handleConfirmDeleteRoute,
}: HistoryRouteModalsProps) {
  return (
    <>
      {/* EDIT ROUTE MODAL */}
      {editingRoute && (
        <div
          onClick={() => setEditingRoute(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
          >
            <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              Edycja Trasy w Historii
            </h3>

            <form onSubmit={handleUpdateRoute} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Nazwa Trasy
                </label>
                <input
                  type="text"
                  required
                  value={editRouteName}
                  onChange={e => setEditRouteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
                />
              </div>

              <div className="space-y-1.5 relative">
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5 flex items-center justify-between gap-2 h-5">
                  <span className="truncate">Pracownik (opcjonalnie)</span>
                  {editEmployeeName && (
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold px-2 py-0.5 rounded-full border border-indigo-500/20 flex-shrink-0">
                      Wybrano
                    </span>
                  )}
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsEditRouteEmployeeSelectOpen(prev => !prev)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 transition flex items-center justify-between cursor-pointer text-zinc-800 dark:text-zinc-200 hover:border-indigo-500/50"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <User
                        className={`w-4 h-4 flex-shrink-0 ${
                          editEmployeeName ? 'text-indigo-500' : 'text-zinc-400'
                        }`}
                      />
                      <span className="truncate font-bold">
                        {editEmployeeName || '-- Brak pracownika --'}
                      </span>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
                        isEditRouteEmployeeSelectOpen ? 'rotate-180 text-indigo-500' : ''
                      }`}
                    />
                  </button>

                  {isEditRouteEmployeeSelectOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setIsEditRouteEmployeeSelectOpen(false)}
                      />

                      <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[200px] overflow-y-auto animate-scale-up p-1 space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditEmployeeName('');
                            setIsEditRouteEmployeeSelectOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${
                            !editEmployeeName
                              ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                          }`}
                        >
                          <span className="italic">-- Brak pracownika --</span>
                          {!editEmployeeName && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                        </button>

                        {employees.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-zinc-400 italic">
                            Brak pracowników w Ustawieniach.
                          </div>
                        ) : (
                          employees.map(emp => {
                            const isSelected = editEmployeeName === emp.name;
                            return (
                              <button
                                key={emp.id}
                                type="button"
                                onClick={() => {
                                  setEditEmployeeName(emp.name);
                                  setIsEditRouteEmployeeSelectOpen(false);
                                }}
                                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold border border-indigo-500/30'
                                    : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 pr-1">
                                  <User
                                    className={`w-3.5 h-3.5 flex-shrink-0 ${
                                      isSelected ? 'text-indigo-500' : 'text-zinc-400'
                                    }`}
                                  />
                                  <span className="truncate">{emp.name}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRoute(null)}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition cursor-pointer"
                >
                  Zapisz
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE ROUTE MODAL */}
      {deletingRoute && (
        <div
          onClick={() => setDeletingRoute(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
          >
            <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Usuń Trasę z Historii
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
              Czy na pewno chcesz usunąć trasę{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{deletingRoute.routeName}</strong>?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRoute(null)}
                className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteRoute}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-500 transition cursor-pointer"
              >
                Usuń Trasę
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
