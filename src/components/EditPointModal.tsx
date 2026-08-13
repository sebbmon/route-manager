'use client';

import React from 'react';
import { Edit3, X, MapPin, Loader2, Route, ChevronDown, Check } from 'lucide-react';
import { Point, SavedRoute } from '@/db/database';

export interface EditPointFormData {
  name: string;
  lat: string;
  lng: string;
  address: string;
  routeId?: number;
}

interface EditPointModalProps {
  editingPoint: Point | null;
  onClose: () => void;
  editFormData: EditPointFormData;
  setEditFormData: React.Dispatch<React.SetStateAction<EditPointFormData>>;
  editAddressQuery: string;
  setEditAddressQuery: React.Dispatch<React.SetStateAction<string>>;
  editIsGeocoding: boolean;
  editGeocodingResults: Array<{ display_name: string; name: string; address: string; lat: number; lng: number }>;
  handleEditSearchAddress: (e: React.FormEvent) => void;
  handleEditSelectAddress: (result: { display_name: string; name: string; address: string; lat: number; lng: number }) => void;
  handleUpdatePoint: (e: React.FormEvent) => void;
  isUpdatingMatrix: boolean;
  savedUserRoutes: SavedRoute[];
  activeRouteId: number | null;
  rawPoints: Point[];
  isRouteSelectOpen: boolean;
  setIsRouteSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function EditPointModal({
  editingPoint,
  onClose,
  editFormData,
  setEditFormData,
  editAddressQuery,
  setEditAddressQuery,
  editIsGeocoding,
  editGeocodingResults,
  handleEditSearchAddress,
  handleEditSelectAddress,
  handleUpdatePoint,
  isUpdatingMatrix,
  savedUserRoutes,
  activeRouteId,
  rawPoints,
  isRouteSelectOpen,
  setIsRouteSelectOpen,
}: EditPointModalProps) {
  if (!editingPoint) return null;

  const currentRouteId = editFormData.routeId ?? editingPoint.routeId;
  const selectedRoute = savedUserRoutes.find(r => r.id === currentRouteId);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Edit3 className="w-5 h-5 text-emerald-500" />
            Edytuj Punkt
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Address Search in Edit Modal */}
        <div className="relative edit-search-container space-y-1.5">
          <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Wyszukaj nowy adres
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Wpisz nową lokalizację..."
              value={editAddressQuery}
              onChange={e => setEditAddressQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleEditSearchAddress(e);
                }
              }}
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
            />
            <button
              type="button"
              onClick={handleEditSearchAddress}
              disabled={editIsGeocoding}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold hover:bg-indigo-500 transition cursor-pointer disabled:opacity-50"
            >
              {editIsGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Szukaj'}
            </button>
          </div>

          {editGeocodingResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[180px] overflow-y-auto">
              {editGeocodingResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleEditSelectAddress(result)}
                  className="w-full text-left px-3.5 py-2.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-start gap-2 cursor-pointer"
                >
                  <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span>{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleUpdatePoint} className="space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
              Nazwa Lokalizacji
            </label>
            <input
              type="text"
              required
              value={editFormData.name}
              onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Szerokość (lat)
              </label>
              <input
                type="number"
                step="any"
                required
                value={editFormData.lat}
                onChange={e => setEditFormData(prev => ({ ...prev, lat: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                Długość (lng)
              </label>
              <input
                type="number"
                step="any"
                required
                value={editFormData.lng}
                onChange={e => setEditFormData(prev => ({ ...prev, lng: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 select-text"
              />
            </div>
          </div>

          {/* Custom UI Route Select Dropdown */}
          <div className="relative space-y-1.5">
            <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5 text-emerald-500" />
                <span>Przenieś do trasy</span>
              </span>
              {editFormData.routeId !== editingPoint.routeId && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 animate-fade-in">
                  Nowa trasa wybrana
                </span>
              )}
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsRouteSelectOpen(prev => !prev)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 transition flex items-center justify-between cursor-pointer text-zinc-800 dark:text-zinc-200 hover:border-emerald-500/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Route className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="truncate font-bold">
                    {selectedRoute?.name || 'Wybierz trasę...'}
                  </span>
                  {selectedRoute?.id === activeRouteId && (
                    <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 flex-shrink-0">
                      Aktywna
                    </span>
                  )}
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
                    isRouteSelectOpen ? 'rotate-180 text-emerald-500' : ''
                  }`}
                />
              </button>

              {isRouteSelectOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setIsRouteSelectOpen(false)}
                  />

                  <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[200px] overflow-y-auto animate-scale-up p-1 space-y-0.5">
                    {savedUserRoutes.map(route => {
                      if (route.id === undefined) return null;
                      const isSelected = (editFormData.routeId ?? editingPoint.routeId) === route.id;
                      const isActive = activeRouteId === route.id;
                      const pointCount = rawPoints.filter(p => p.routeId === route.id).length;

                      return (
                        <button
                          key={route.id}
                          type="button"
                          onClick={() => {
                            setEditFormData(prev => ({ ...prev, routeId: route.id }));
                            setIsRouteSelectOpen(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30'
                              : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <Route
                              className={`w-3.5 h-3.5 flex-shrink-0 ${
                                isSelected ? 'text-emerald-500' : 'text-zinc-400'
                              }`}
                            />
                            <span className="truncate">{route.name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isActive && (
                              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded-full border border-emerald-500/20">
                                Aktywna
                              </span>
                            )}
                            <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-1.5 py-0.2 rounded-full font-bold">
                              {pointCount} pkt
                            </span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-emerald-500 ml-0.5 flex-shrink-0" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isUpdatingMatrix}
              className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-500 transition cursor-pointer disabled:opacity-50"
            >
              Zapisz Zmiany
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
