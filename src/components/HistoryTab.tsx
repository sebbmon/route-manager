'use client';

import React from 'react';
import { User, Edit3, Trash2 } from 'lucide-react';
import { RouteHistory } from '@/db/database';

interface HistoryTabProps {
  savedRoutes: RouteHistory[];
  getRouteNameForHistoryItem: (route: RouteHistory) => string;
  handleLoadRoute: (route: RouteHistory) => void;
  handleStartEditRoute: (route: RouteHistory, e: React.MouseEvent) => void;
  setDeletingRoute: (route: RouteHistory | null) => void;
}

export default function HistoryTab({
  savedRoutes,
  getRouteNameForHistoryItem,
  handleLoadRoute,
  handleStartEditRoute,
  setDeletingRoute,
}: HistoryTabProps) {
  return (
    <div className="space-y-3.5 animate-fade-in">
      <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block px-1">
        Zapisane Trasy w Bazie
      </span>

      <div className="space-y-2.5 max-h-[calc(100vh-220px)] overflow-y-auto pr-1">
        {savedRoutes.length === 0 ? (
          <div className="text-center py-12 text-zinc-400 text-sm font-medium">
            Brak zapamiętanych tras w historii.
          </div>
        ) : (
          [...savedRoutes].reverse().map(route => {
            if (route.id === undefined) return null;
            const parentRouteName = getRouteNameForHistoryItem(route);
            return (
              <div
                key={route.id}
                onClick={() => handleLoadRoute(route)}
                className="px-3.5 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:hover:bg-zinc-850 transition cursor-pointer group flex items-center justify-between gap-3 min-h-[64px]"
              >
                <div className="min-w-0 text-left flex-1 flex flex-col justify-center">
                  <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-500 transition-colors truncate leading-tight">
                    {route.routeName}
                  </p>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5 font-medium flex items-center gap-1.5 flex-nowrap min-w-0 leading-none">
                    {route.employeeName && (
                      <>
                        <span
                          className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-500/10 px-1.5 py-0.5 rounded text-[11px] leading-none flex-shrink-0"
                          title={`Pracownik: ${route.employeeName}`}
                        >
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[110px]">{route.employeeName}</span>
                        </span>
                        <span className="text-zinc-300 dark:text-zinc-700 flex-shrink-0">•</span>
                      </>
                    )}
                    <span className="truncate max-w-[130px]" title={parentRouteName}>
                      {parentRouteName}
                    </span>
                    <span className="text-zinc-300 dark:text-zinc-700 flex-shrink-0">•</span>
                    <span className="flex-shrink-0">{route.pointsOrder.length} pkt</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 flex-shrink-0">
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1.5 rounded-xl border border-emerald-500/20 leading-none">
                    {route.totalDistance.toFixed(1)} km
                  </span>

                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={e => handleStartEditRoute(route, e)}
                      title="Edytuj nazwę trasy"
                      className="p-1.5 text-zinc-400 hover:text-indigo-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        setDeletingRoute(route);
                      }}
                      title="Usuń z historii"
                      className="p-1.5 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
