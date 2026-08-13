'use client';

import React from 'react';
import {
  Route,
  RotateCcw,
  Sliders,
  Trash2,
  GripVertical,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  QrCode,
  ExternalLink,
  History,
  Save,
  Plus,
  User,
  ChevronDown,
  Check,
} from 'lucide-react';
import { Point, Employee, ViaPoint } from '@/db/database';
import { GmapsSegment } from '@/components/GmapsExportModal';

interface RoutePlanTabProps {
  totalDistance: number;
  activePointIds: number[];
  setActiveTab: (tab: 'points' | 'route' | 'history' | 'backup') => void;

  handleToggleReturnToStart: () => void;
  isHasReturnLeg: boolean;
  handleToggleRouteEditMode: () => void;
  isRouteEditMode: boolean;
  handleClearActiveRoute: () => void;

  activePoints: Point[];
  viaPoints: ViaPoint[];
  stepDistances: Record<string, number>;
  activeDragIndex: number | null;

  handlePointerEnterHover: (index: number) => void;
  handlePointerDownDrag: (e: React.PointerEvent, index: number) => void;
  handleMoveUp: (index: number) => void;
  handleMoveDown: (index: number) => void;
  handleToggleActive: (pointId: number) => void;

  setIsGmapsExportModalOpen: (open: boolean) => void;
  gmapsSegments: GmapsSegment[];

  loadedRouteId: number | null;
  setLoadedRouteId: (id: number | null) => void;
  handleUpdateLoadedRoute: (e: React.FormEvent) => void;
  handleSaveRoute: (e: React.FormEvent) => void;

  routeName: string;
  setRouteName: (name: string) => void;
  selectedEmployeeName: string;
  setSelectedEmployeeName: (name: string) => void;
  isPlanEmployeeSelectOpen: boolean;
  setIsPlanEmployeeSelectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  employees: Employee[];
}

export default function RoutePlanTab({
  totalDistance,
  activePointIds,
  setActiveTab,

  handleToggleReturnToStart,
  isHasReturnLeg,
  handleToggleRouteEditMode,
  isRouteEditMode,
  handleClearActiveRoute,

  activePoints,
  viaPoints,
  stepDistances,
  activeDragIndex,

  handlePointerEnterHover,
  handlePointerDownDrag,
  handleMoveUp,
  handleMoveDown,
  handleToggleActive,

  setIsGmapsExportModalOpen,
  gmapsSegments,

  loadedRouteId,
  setLoadedRouteId,
  handleUpdateLoadedRoute,
  handleSaveRoute,

  routeName,
  setRouteName,
  selectedEmployeeName,
  setSelectedEmployeeName,
  isPlanEmployeeSelectOpen,
  setIsPlanEmployeeSelectOpen,
  employees,
}: RoutePlanTabProps) {
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Route Header Telemetry Card */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-800 text-white rounded-xl p-4 shadow-md space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase font-extrabold tracking-wider text-emerald-100/70">
            Podsumowanie Dzisiejszej Trasy
          </span>
          <span className="text-[10px] bg-emerald-500/30 px-2 py-0.5 rounded-full font-bold text-emerald-100 border border-emerald-400/20">
            OSRM Live
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight">{totalDistance}</span>
          <span className="text-sm font-bold text-emerald-200">km łącznego dystansu</span>
        </div>
        <p className="text-xs text-emerald-100/80">
          Liczba wybranych lokalizacji: <strong className="text-white">{activePointIds.length}</strong>
        </p>
      </div>

      {/* Route Points List */}
      {activePointIds.length === 0 ? (
        <div className="text-center py-12 text-zinc-400 text-xs space-y-2">
          <Route className="w-8 h-8 mx-auto text-zinc-300 dark:text-zinc-700" />
          <p className="font-semibold text-zinc-500">Brak wybranych punktów w trasie.</p>
          <p>Przejdź do zakładki &quot;Stacje&quot; i zaznacz lokalizacje.</p>
          <button
            onClick={() => setActiveTab('points')}
            className="mt-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition cursor-pointer"
          >
            Otwórz Bazę Stacji
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-1.5">
            <div className="w-[155px] flex-shrink-0">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                Kolejność Przejazdu
              </span>
              <span className="text-[10px] text-zinc-400 font-medium leading-tight block pt-0.5 max-w-[145px]">
                Przeciągnij elementy myszką, aby zmienić kolejność
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={handleToggleReturnToStart}
                title="Dodaj lub usuń powrót do punktu startowego na końcu trasy"
                className={`text-[11px] font-bold h-7 w-[88px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer flex-shrink-0 ${
                  isHasReturnLeg
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20'
                }`}
              >
                <RotateCcw className={`w-3 h-3 flex-shrink-0 ${isHasReturnLeg ? 'rotate-180 transition-transform' : ''}`} />
                <span>{isHasReturnLeg ? 'Pętla: WŁ' : 'Pętla: WYŁ'}</span>
              </button>
              <button
                type="button"
                onClick={handleToggleRouteEditMode}
                disabled={activePointIds.length < 2}
                title={
                  activePointIds.length < 2
                    ? 'Korekta trasy jest możliwa dopiero przy co najmniej 2 punktach'
                    : 'Włącz lub wyłącz tryb edycji/korekty trasy na mapie'
                }
                className={`text-[11px] font-bold h-7 w-[92px] rounded-lg transition flex items-center justify-center gap-1 flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRouteEditMode
                    ? 'bg-amber-500 text-white shadow-md cursor-pointer'
                    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 cursor-pointer disabled:hover:bg-amber-500/10'
                }`}
              >
                <Sliders className="w-3 h-3 flex-shrink-0" />
                <span>{isRouteEditMode ? 'Korekta: WŁ' : 'Koryguj'}</span>
              </button>
              <button
                type="button"
                onClick={handleClearActiveRoute}
                title="Wyczyść cały plan trasy"
                className="text-[11px] font-bold h-7 w-[98px] text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-600 hover:text-white rounded-lg transition flex items-center justify-center gap-1 cursor-pointer shadow-sm flex-shrink-0"
              >
                <Trash2 className="w-3 h-3 flex-shrink-0" />
                <span>Wyczyść Plan</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-scroll px-2 py-1 pb-8">
            {activePoints.map((point, index) => {
              if (point.id === undefined) return null;
              const isFirst = index === 0;
              const isLast = index === activePointIds.length - 1;
              const isReturnStop = index > 0 && point.id === activePointIds[0] && isLast;
              const isLockedInLoop = isHasReturnLeg && (isFirst || isLast);

              const isMoveUpDisabled = isFirst || (isHasReturnLeg && (index === 1 || isLast));
              const isMoveDownDisabled = isLast || (isHasReturnLeg && (isFirst || index === activePointIds.length - 2));

              const segViaCount = viaPoints.filter(v => v.segmentIndex === index).length;
              const hasWaypointsOnSeg = segViaCount > 0;

              let nextStepKm: number | undefined = undefined;
              if (!isLast) {
                const nextPointId = activePointIds[index + 1];
                nextStepKm = stepDistances[`seg-${index}`] ?? stepDistances[`${point.id}-${nextPointId}`];
              }

              const isBeingDragged = activeDragIndex === index;

              return (
                <div
                  key={`active-${index}-${point.id}`}
                  onPointerEnter={() => handlePointerEnterHover(index)}
                  className={`space-y-1 transition-all duration-150 ease-out rounded-xl select-none ${
                    isBeingDragged ? 'relative z-20 ring-2 ring-emerald-500/90 shadow-lg bg-emerald-500/10 dark:bg-emerald-950/50' : ''
                  }`}
                >
                  <div
                    className={`flex items-center justify-between border rounded-xl p-2.5 transition-colors ${
                      isReturnStop
                        ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/30'
                        : isBeingDragged
                        ? 'bg-emerald-500/15 border-emerald-500 dark:border-emerald-500/80'
                        : 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {/* Drag Handle */}
                      <div
                        onPointerDown={e => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!isLockedInLoop) {
                            handlePointerDownDrag(e, index);
                          }
                        }}
                        title={isLockedInLoop ? 'Przystanek zablokowany w trybie pętli' : 'Przytrzymaj i przeciągnij myszą w górę/dół'}
                        className={`p-1 select-none transition-colors ${
                          isLockedInLoop
                            ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-40'
                            : 'text-zinc-400 hover:text-emerald-500 cursor-grab active:cursor-grabbing touch-none'
                        }`}
                      >
                        <GripVertical className="w-4 h-4 flex-shrink-0" />
                      </div>

                      <span
                        className={`w-5 h-5 rounded-full text-white text-xs font-black flex items-center justify-center flex-shrink-0 transition-colors ${
                          isReturnStop ? 'bg-emerald-600 ring-2 ring-emerald-400/40' : isBeingDragged ? 'bg-emerald-600' : 'bg-emerald-500'
                        }`}
                      >
                        {index + 1}
                      </span>
                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">{point.name}</span>
                      {isReturnStop && (
                        <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold px-1.5 py-0.2 rounded border border-emerald-500/20 flex-shrink-0">
                          🔄 Powrót
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => handleMoveUp(index)}
                        disabled={isMoveUpDisabled}
                        title={isMoveUpDisabled ? 'Przesuwanie w górę zablokowane' : 'Przesuń wyżej'}
                        className="p-1 text-zinc-400 hover:text-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed rounded transition cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveDown(index)}
                        disabled={isMoveDownDisabled}
                        title={isMoveDownDisabled ? 'Przesuwanie w dół zablokowane' : 'Przesuń niżej'}
                        className="p-1 text-zinc-400 hover:text-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed rounded transition cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(point.id!)}
                        title="Usuń z trasy"
                        className="p-1 text-zinc-400 hover:text-rose-500 rounded transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {!isLast && (
                    <div
                      className={`flex items-center justify-between pl-7 pr-1 h-7 my-0.5 text-xs font-semibold ${
                        hasWaypointsOnSeg ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      <div className="flex items-center">
                        <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700 mr-2"></div>
                        <ChevronRight className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
                        {nextStepKm !== undefined ? (
                          <span className={hasWaypointsOnSeg ? 'font-bold text-amber-600 dark:text-amber-400' : ''}>
                            + {nextStepKm.toFixed(1)} km (odcinek)
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">Odcinek {index + 1}</span>
                        )}
                      </div>
                      {hasWaypointsOnSeg ? (
                        <span
                          title={`Dodano ${segViaCount} waypoint(y) na tym odcinku`}
                          className="text-[10px] leading-tight bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 select-none flex-shrink-0"
                        >
                          <span>📍</span>
                          <span>
                            {segViaCount} {segViaCount === 1 ? 'waypoint' : segViaCount < 5 ? 'waypointy' : 'waypointów'}
                          </span>
                        </span>
                      ) : (
                        <div className="h-5 w-1"></div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Export to Google Maps Navigation Button */}
          {activePointIds.length >= 2 && (
            <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsGmapsExportModalOpen(true)}
                className="w-full py-2.5 px-3 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 shadow-md cursor-pointer group"
              >
                <QrCode className="w-4 h-4 text-blue-200 group-hover:scale-110 transition-transform" />
                <span>Nawigacja Google Maps & Kody QR</span>
                {gmapsSegments.length > 1 && (
                  <span className="text-[10px] bg-white/20 text-white px-1.5 py-0.5 rounded-full font-bold">
                    {gmapsSegments.length} segmenty
                  </span>
                )}
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </button>
            </div>
          )}

          {/* Save / Update Route in History Form */}
          {activePointIds.length >= 2 && (
            <form
              onSubmit={loadedRouteId ? handleUpdateLoadedRoute : handleSaveRoute}
              className="pt-3 space-y-2 border-t border-zinc-200 dark:border-zinc-800"
            >
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                  {loadedRouteId ? 'Zapisywanie Zmian w Trasie' : 'Zapisz Trasę w Historii'}
                </label>
                {loadedRouteId && (
                  <button
                    type="button"
                    onClick={() => setLoadedRouteId(null)}
                    title="Odłącz tę trasę od zapisanego oryginału w historii"
                    className="text-[10px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                  >
                    Odłącz od oryginału
                  </button>
                )}
              </div>

              {loadedRouteId && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-[11px] font-medium flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <History className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                    <span className="truncate">Edytujesz wczytaną trasę</span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 font-bold px-1.5 py-0.5 rounded text-amber-800 dark:text-amber-200 flex-shrink-0">
                    Wczytana
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Nazwa trasy (np. Poniedziałek Północ)..."
                    value={routeName}
                    onChange={e => setRouteName(e.target.value)}
                    className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text font-medium"
                  />
                  <div className="relative w-44 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsPlanEmployeeSelectOpen(prev => !prev)}
                      className={`w-full px-2.5 py-2 rounded-lg border text-xs font-bold transition flex items-center justify-between gap-1 cursor-pointer ${
                        selectedEmployeeName
                          ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-700 dark:text-indigo-300'
                          : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600'
                      }`}
                      title="Wybierz pracownika przypisanego do trasy (opcjonalnie)"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 pr-1">
                        <User className={`w-3.5 h-3.5 flex-shrink-0 ${selectedEmployeeName ? 'text-indigo-500' : 'text-zinc-400'}`} />
                        <span className="truncate">{selectedEmployeeName || 'Pracownik'}</span>
                      </div>
                      <ChevronDown
                        className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
                          isPlanEmployeeSelectOpen ? 'rotate-180 text-indigo-500' : ''
                        }`}
                      />
                    </button>

                    {isPlanEmployeeSelectOpen && (
                      <>
                        <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsPlanEmployeeSelectOpen(false)} />

                        <div className="absolute left-0 right-0 top-full mt-1.5 w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/60 max-h-[220px] overflow-y-auto animate-scale-up p-1 space-y-0.5 text-left">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedEmployeeName('');
                              setIsPlanEmployeeSelectOpen(false);
                            }}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${
                              !selectedEmployeeName
                                ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                            }`}
                          >
                            <span className="italic">-- Brak pracownika --</span>
                            {!selectedEmployeeName && <Check className="w-3.5 h-3.5 text-zinc-400" />}
                          </button>

                          {employees.length === 0 ? (
                            <div className="px-2.5 py-2 text-[11px] text-zinc-400 italic">Brak pracowników w Ustawieniach.</div>
                          ) : (
                            employees.map(emp => {
                              const isSelected = selectedEmployeeName === emp.name;
                              return (
                                <button
                                  key={emp.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployeeName(emp.name);
                                    setIsPlanEmployeeSelectOpen(false);
                                  }}
                                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                      ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 font-bold border border-indigo-500/30'
                                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 min-w-0 pr-1">
                                    <User className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-500' : 'text-zinc-400'}`} />
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

                <div className="flex gap-2">
                  {loadedRouteId ? (
                    <>
                      <button
                        type="submit"
                        className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Aktualizuj tę trasę</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveRoute}
                        className="flex-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Zapisz jako nową</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="submit"
                      className="w-full px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Zapisz w historii</span>
                    </button>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
