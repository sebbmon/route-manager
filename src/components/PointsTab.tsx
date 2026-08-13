'use client';

import React from 'react';
import {
  MapPin,
  Search,
  Loader2,
  X,
  Plus,
  Route,
  Edit3,
  Trash2,
  GripVertical,
  CheckSquare,
  Square,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';
import { Point, SavedRoute } from '@/db/database';

export interface PointFormData {
  id?: number;
  name: string;
  lat: string;
  lng: string;
  address: string;
}

interface PointsTabProps {
  addressQuery: string;
  setAddressQuery: (query: string) => void;
  handleSearchAddress: (e: React.FormEvent) => void;
  isGeocoding: boolean;
  geocodingResults: Array<{ display_name: string; name: string; address: string; lat: number; lng: number }>;
  setGeocodingResults: (results: Array<{ display_name: string; name: string; address: string; lat: number; lng: number }>) => void;
  handleSelectAddress: (result: { display_name: string; name: string; address: string; lat: number; lng: number }) => void;

  formData: PointFormData;
  setFormData: React.Dispatch<React.SetStateAction<PointFormData>>;
  handleSavePoint: (e: React.FormEvent) => void;
  isUpdatingMatrix: boolean;

  savedUserRoutes: SavedRoute[];
  activeRouteId: number | null;
  setActiveRouteId: (id: number) => void;
  rawPoints: Point[];
  setIsAddRouteModalOpen: (open: boolean) => void;
  setEditingFolderRoute: (route: SavedRoute | null) => void;
  setEditFolderRouteName: (name: string) => void;
  setDeletingFolderRoute: (route: SavedRoute | null) => void;

  activeRoute: SavedRoute | undefined;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredPoints: Point[];
  activePointIds: number[];
  activeSavedDragId: number | null;

  handlePointerEnterSavedHover: (pointId: number) => void;
  handleToggleActive: (pointId: number) => void;
  handlePointerDownSavedDrag: (e: React.PointerEvent, pointId: number) => void;
  handleMoveSavedPointUp: (index: number) => void;
  handleMoveSavedPointDown: (index: number) => void;
  handleStartEdit: (point: Point) => void;
  setDeletingPoint: (point: Point | null) => void;
}

export default function PointsTab({
  addressQuery,
  setAddressQuery,
  handleSearchAddress,
  isGeocoding,
  geocodingResults,
  setGeocodingResults,
  handleSelectAddress,

  formData,
  setFormData,
  handleSavePoint,
  isUpdatingMatrix,

  savedUserRoutes,
  activeRouteId,
  setActiveRouteId,
  rawPoints,
  setIsAddRouteModalOpen,
  setEditingFolderRoute,
  setEditFolderRouteName,
  setDeletingFolderRoute,

  activeRoute,
  searchQuery,
  setSearchQuery,
  filteredPoints,
  activePointIds,
  activeSavedDragId,

  handlePointerEnterSavedHover,
  handleToggleActive,
  handlePointerDownSavedDrag,
  handleMoveSavedPointUp,
  handleMoveSavedPointDown,
  handleStartEdit,
  setDeletingPoint,
}: PointsTabProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Card 1: Add New Location */}
      <div className="bg-zinc-50/60 dark:bg-zinc-950/40 border border-zinc-200/80 dark:border-zinc-800/80 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
          <MapPin className="w-4 h-4 text-indigo-500" />
          Wyszukaj & Dodaj Punkt
        </h3>

        {/* Search Address Input */}
        <div className="relative main-search-container">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                id="desktop-main-search-input"
                type="text"
                placeholder="Szukaj adresu (np. Marszałkowska 10)..."
                value={addressQuery}
                onChange={e => setAddressQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSearchAddress(e);
                  }
                }}
                className="w-full pl-3 pr-8 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text"
              />
              {addressQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setAddressQuery('');
                    setGeocodingResults([]);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={handleSearchAddress}
              disabled={isGeocoding}
              className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isGeocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              <span>Szukaj</span>
            </button>
          </div>

          {/* Suggestions Dropdown */}
          {geocodingResults.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[200px] overflow-y-auto">
              {geocodingResults.map((result, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectAddress(result)}
                  className="w-full text-left px-3 py-2.5 text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-start gap-2 cursor-pointer transition-colors"
                >
                  <MapPin className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                  <span className="truncate">{result.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Manual Coordinates Collapsible / Inline Form */}
        <form onSubmit={handleSavePoint} className="space-y-2.5 pt-1">
          <div>
            <input
              type="text"
              required
              placeholder="Nazwa punktu (np. Magazyn A)..."
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              step="any"
              required
              placeholder="Szer (lat)"
              value={formData.lat}
              onChange={e => setFormData(prev => ({ ...prev, lat: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text"
            />
            <input
              type="number"
              step="any"
              required
              placeholder="Dł (lng)"
              value={formData.lng}
              onChange={e => setFormData(prev => ({ ...prev, lng: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text"
            />
          </div>

          <button
            type="submit"
            disabled={isUpdatingMatrix}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-lg font-bold text-xs shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isUpdatingMatrix ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Zapisywanie w OSRM...</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>Zapisz w Bazie</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Card 1.5: Saved Routes (Zapisane Trasy) */}
      <div className="space-y-2.5 p-3 bg-zinc-50 dark:bg-zinc-950/40 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Route className="w-4 h-4 text-emerald-500" />
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Zapisane Trasy
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddRouteModalOpen(true)}
            className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 px-2.5 py-1 rounded-lg transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Dodaj trasę</span>
          </button>
        </div>

        {/* Routes 2-Column Grid */}
        <div className="grid grid-cols-2 gap-2 pt-0.5">
          {savedUserRoutes.length === 0 ? (
            <span className="col-span-2 text-xs text-zinc-400 italic py-1">
              Brak zapisanych tras. Kliknij &quot;Dodaj trasę&quot;.
            </span>
          ) : (
            savedUserRoutes.map(route => {
              if (!route.id) return null;
              const isActive = activeRouteId === route.id;
              const pointCount = rawPoints.filter(p => p.routeId === route.id).length;

              return (
                <div
                  key={route.id}
                  onClick={() => setActiveRouteId(route.id!)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition group min-w-0 ${
                    isActive
                      ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500/50'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 pr-1">
                    <span className="font-bold truncate" title={route.name}>
                      {route.name}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold flex-shrink-0 ${
                        isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                      }`}
                    >
                      {pointCount} pkt
                    </span>
                  </div>

                  <div
                    className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setEditingFolderRoute(route);
                        setEditFolderRouteName(route.name);
                      }}
                      title="Zmień nazwę"
                      className={`p-1 rounded transition ${
                        isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    {savedUserRoutes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeletingFolderRoute(route)}
                        title="Usuń trasę"
                        className={`p-1 rounded transition ${
                          isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-500/10 text-rose-500'
                        }`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Card 2: Points List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Zapisane Lokalizacje
            </span>
            {activeRoute && (
              <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-2 py-0.5 rounded-full border border-emerald-500/20 truncate max-w-[130px]">
                {activeRoute.name}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-400">Kliknij punkt aby dodać do trasy</span>
        </div>

        {/* Search Filter Bar */}
        <input
          type="text"
          placeholder="Filtruj listę..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text"
        />

        {/* List Rows */}
        <div className="space-y-2 max-h-[calc(100vh-420px)] overflow-y-auto pr-1">
          {filteredPoints.length === 0 ? (
            <div className="text-center py-8 text-zinc-400 text-xs">
              {searchQuery ? 'Brak wyników.' : 'Baza jest pusta. Wyszukaj i dodaj punkty powyżej.'}
            </div>
          ) : (
            filteredPoints.map((point, index) => {
              if (point.id === undefined) return null;
              const isChecked = activePointIds.includes(point.id);
              const isFirst = index === 0;
              const isLast = index === filteredPoints.length - 1;
              const isBeingDragged = activeSavedDragId === point.id;

              return (
                <div
                  key={point.id}
                  onPointerEnter={() => handlePointerEnterSavedHover(point.id!)}
                  onClick={() => handleToggleActive(point.id!)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ease-out cursor-pointer group select-none ${
                    isBeingDragged
                      ? 'relative z-20 ring-2 ring-emerald-500/90 shadow-lg bg-emerald-500/10 dark:bg-emerald-950/50'
                      : isChecked
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
                      : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    {/* Drag Handle */}
                    <div
                      onPointerDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        handlePointerDownSavedDrag(e, point.id!);
                      }}
                      title="Przytrzymaj i przeciągnij myszą w górę/dół"
                      className="p-1 text-zinc-400 hover:text-emerald-500 cursor-grab active:cursor-grabbing touch-none select-none transition-colors"
                    >
                      <GripVertical className="w-4 h-4 flex-shrink-0" />
                    </div>

                    <div
                      className={`transition-colors ${
                        isChecked ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-700'
                      }`}
                    >
                      {isChecked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </div>

                    <div className="min-w-0 text-left">
                      <p className="text-sm font-bold truncate group-hover:text-indigo-500 transition-colors">
                        {point.name}
                      </p>
                      <p className="text-xs text-zinc-400 truncate max-w-[280px]" title={point.address}>
                        {point.address || `Lat: ${point.lat.toFixed(4)}, Lng: ${point.lng.toFixed(4)}`}
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleMoveSavedPointUp(index)}
                      disabled={isFirst}
                      title="Przesuń w górę"
                      className="p-1 text-zinc-500 hover:text-emerald-500 disabled:opacity-20 rounded transition cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleMoveSavedPointDown(index)}
                      disabled={isLast}
                      title="Przesuń w dół"
                      className="p-1 text-zinc-500 hover:text-emerald-500 disabled:opacity-20 rounded transition cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleStartEdit(point)}
                      title="Edytuj punkt"
                      className="p-1 text-zinc-500 hover:text-indigo-500 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingPoint(point)}
                      title="Usuń punkt"
                      className="p-1 text-zinc-500 hover:text-rose-500 hover:bg-rose-500/10 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
