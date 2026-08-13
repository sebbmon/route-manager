'use client';

import React from 'react';
import { Route, Edit3, Trash2, X } from 'lucide-react';
import { SavedRoute } from '@/db/database';

interface RouteFolderModalsProps {
  isAddRouteModalOpen: boolean;
  setIsAddRouteModalOpen: (open: boolean) => void;
  newRouteName: string;
  setNewRouteName: (name: string) => void;
  handleCreateRoute: (e: React.FormEvent) => void;

  editingFolderRoute: SavedRoute | null;
  setEditingFolderRoute: (route: SavedRoute | null) => void;
  editFolderRouteName: string;
  setEditFolderRouteName: (name: string) => void;
  handleUpdateRouteName: (e: React.FormEvent) => void;

  deletingFolderRoute: SavedRoute | null;
  setDeletingFolderRoute: (route: SavedRoute | null) => void;
  handleDeleteRoute: () => void;
}

export default function RouteFolderModals({
  isAddRouteModalOpen,
  setIsAddRouteModalOpen,
  newRouteName,
  setNewRouteName,
  handleCreateRoute,

  editingFolderRoute,
  setEditingFolderRoute,
  editFolderRouteName,
  setEditFolderRouteName,
  handleUpdateRouteName,

  deletingFolderRoute,
  setDeletingFolderRoute,
  handleDeleteRoute,
}: RouteFolderModalsProps) {
  return (
    <>
      {/* CREATE FOLDER ROUTE MODAL */}
      {isAddRouteModalOpen && (
        <div
          onClick={() => setIsAddRouteModalOpen(false)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
                <Route className="w-5 h-5 text-emerald-500" />
                Nowa Trasa
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRouteModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRoute} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Nazwa Trasy
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="np. Trasa 1, Dostawy Środa..."
                  value={newRouteName}
                  onChange={e => setNewRouteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddRouteModalOpen(false)}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition cursor-pointer"
                >
                  Utwórz Trasę
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT FOLDER ROUTE MODAL */}
      {editingFolderRoute && (
        <div
          onClick={() => setEditingFolderRoute(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                Zmień Nazwę Trasy
              </h3>
              <button
                type="button"
                onClick={() => setEditingFolderRoute(null)}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateRouteName} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Nowa Nazwa Trasy
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={editFolderRouteName}
                  onChange={e => setEditFolderRouteName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFolderRoute(null)}
                  className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition cursor-pointer"
                >
                  Zapisz Zmiany
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE FOLDER ROUTE CONFIRMATION MODAL */}
      {deletingFolderRoute && (
        <div
          onClick={() => setDeletingFolderRoute(null)}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
          >
            <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Usuń Trasę
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
              Czy na pewno chcesz usunąć trasę{' '}
              <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{deletingFolderRoute.name}</strong> oraz
              przypisane do niej punkty?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingFolderRoute(null)}
                className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleDeleteRoute}
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
