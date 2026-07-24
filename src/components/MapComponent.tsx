'use client';

import { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Point } from '@/db/database';
import { Loader2, Sliders, RotateCcw, Trash2 } from 'lucide-react';

// Helper to create custom SVG pins for main points
const createSvgIcon = (color: string, label: string, isHighlighted: boolean) => {
  const size = isHighlighted ? 36 : 30;
  const anchorX = size / 2;
  const anchorY = size;

  const html = `
    <svg width="${size}" height="${size * 1.4}" viewBox="0 0 30 42" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-md transition-all duration-300">
      <path d="M15 0C6.71573 0 0 6.71573 0 15C0 26.25 15 42 15 42C15 42 30 26.25 30 15C30 6.71573 23.2843 0 15 0ZM15 20.25C12.1005 20.25 9.75 17.8995 9.75 15C9.75 12.1005 12.1005 9.75 15 9.75C17.8995 9.75 20.25 12.1005 20.25 15C20.25 17.8995 17.8995 20.25 15 20.25Z" 
            fill="${color}" 
            stroke="${isHighlighted ? '#ffffff' : 'none'}" 
            stroke-width="1.5"/>
      ${label
      ? `<text x="15" y="16" fill="white" font-size="10" font-family="system-ui, sans-serif" font-weight="800" text-anchor="middle" dominant-baseline="middle">${label}</text>`
      : `<circle cx="15" cy="15" r="4" fill="white" />`
    }
    </svg>
  `;

  return L.divIcon({
    html,
    className: 'custom-leaflet-icon',
    iconSize: [size, size * 1.4],
    iconAnchor: [anchorX, anchorY],
    popupAnchor: [0, -anchorY],
  });
};

// Helper to create via-point (route correction) marker icons
const createViaIcon = (index: number) => {
  const html = `
    <div class="relative flex items-center justify-center animate-scale-up">
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg" class="drop-shadow-lg">
        <circle cx="13" cy="13" r="11" fill="#f59e0b" stroke="#ffffff" stroke-width="2.5"/>
        <text x="13" y="14" fill="white" font-size="10" font-family="system-ui, sans-serif" font-weight="900" text-anchor="middle" dominant-baseline="middle">K${index + 1}</text>
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-via-icon',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -13],
  });
};

// Component to handle map clicks
function MapEvents({
  onMapClick,
  isRouteEditMode,
  onAddViaPoint,
}: {
  onMapClick: (lat: number, lng: number) => void;
  isRouteEditMode?: boolean;
  onAddViaPoint?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (isRouteEditMode && onAddViaPoint) {
        onAddViaPoint(e.latlng.lat, e.latlng.lng);
      } else {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to handle automatic fit bounds for active points
function MapFitBounds({ activePoints, isDragging }: { activePoints: Point[]; isDragging?: boolean }) {
  const map = useMap();

  const validActivePoints = useMemo(() => {
    return (activePoints || []).filter(
      p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng)
    );
  }, [activePoints]);

  const activeSetKey = useMemo(() => {
    return validActivePoints
      .map(p => p.id)
      .filter((id): id is number => id !== undefined)
      .sort((a, b) => a - b)
      .join(',');
  }, [validActivePoints]);

  useEffect(() => {
    if (isDragging) return;
    if (validActivePoints.length > 0 && map && (map as any)._container) {
      try {
        const bounds = L.latLngBounds(validActivePoints.map(p => [p.lat, p.lng]));
        if (bounds.isValid()) {
          map.fitBounds(bounds, {
            padding: [50, 50],
            maxZoom: 14,
            animate: true,
            duration: 1,
          });
        }
      } catch (err) {
        console.error('Leaflet fitBounds error:', err);
      }
    }
  }, [activeSetKey, map, isDragging, validActivePoints]);

  return null;
}

// Helper component to fix Leaflet map tile rendering glitch
function MapInvalidateSize({ isMapMaximized }: { isMapMaximized?: boolean }) {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        if (map && (map as any)._container) {
          map.invalidateSize();
        }
      } catch (err) {
        console.error('Leaflet invalidateSize error:', err);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [map, isMapMaximized]);
  return null;
}

interface MapComponentProps {
  points: Point[];
  activePoints: Point[];
  routeCoordinates: [number, number][];
  onMapClick: (lat: number, lng: number) => void;
  isMapMaximized?: boolean;
  isDragging?: boolean;
  isRouteEditMode?: boolean;
  onToggleRouteEditMode?: () => void;
  viaPoints?: [number, number][];
  onAddViaPoint?: (lat: number, lng: number) => void;
  onUpdateViaPoint?: (index: number, lat: number, lng: number) => void;
  onRemoveViaPoint?: (index: number) => void;
  onClearViaPoints?: () => void;
}

function CustomMarker({
  point,
  isActive,
  label,
}: {
  point: Point;
  isActive: boolean;
  label: string;
}) {
  const pinColor = isActive ? '#10b981' : '#6366f1';

  const icon = useMemo(() => {
    return createSvgIcon(pinColor, label, isActive);
  }, [pinColor, label, isActive]);

  if (!point || typeof point.lat !== 'number' || isNaN(point.lat) || typeof point.lng !== 'number' || isNaN(point.lng)) {
    return null;
  }

  return (
    <Marker position={[point.lat, point.lng]} icon={icon}>
      <Popup>
        <div className="max-w-[195px] text-left pr-5">
          <p className="font-bold text-sm text-zinc-900 dark:text-zinc-50 leading-tight mb-1">
            {point.name}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            {point.address || `Lat: ${point.lat.toFixed(4)}, Lng: ${point.lng.toFixed(4)}`}
          </p>
        </div>
      </Popup>
    </Marker>
  );
}

export default function MapComponent({
  points = [],
  activePoints = [],
  routeCoordinates = [],
  onMapClick,
  isMapMaximized = false,
  isDragging = false,
  isRouteEditMode = false,
  onToggleRouteEditMode,
  viaPoints = [],
  onAddViaPoint,
  onUpdateViaPoint,
  onRemoveViaPoint,
  onClearViaPoints,
}: MapComponentProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const defaultCenter: [number, number] = [52.0693, 19.4803];
  const defaultZoom = 7;

  const validPoints = useMemo(() => {
    return (points || []).filter(p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng));
  }, [points]);

  const validActivePoints = useMemo(() => {
    return (activePoints || []).filter(p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng));
  }, [activePoints]);

  const validRouteCoordinates = useMemo(() => {
    return (routeCoordinates || []).filter(
      c => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && !isNaN(c[0]) && typeof c[1] === 'number' && !isNaN(c[1])
    );
  }, [routeCoordinates]);

  const validViaPoints = useMemo(() => {
    return (viaPoints || []).filter(
      v => Array.isArray(v) && v.length === 2 && typeof v[0] === 'number' && !isNaN(v[0]) && typeof v[1] === 'number' && !isNaN(v[1])
    );
  }, [viaPoints]);

  const getActiveIndex = (pointId: number) => {
    return validActivePoints.findIndex(p => p.id === pointId);
  };

  if (!isMounted) {
    return (
      <div className="w-full h-full min-h-[450px] bg-zinc-150 dark:bg-zinc-900 animate-pulse rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-3 border border-zinc-200 dark:border-zinc-800">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
        <span className="text-sm font-medium">Inicjalizacja mapy Leaflet...</span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {/* Floating Route Edit Controls Header on Map (Bottom-Left Corner) */}
      {validActivePoints.length >= 2 && onToggleRouteEditMode && (
        <div className="absolute bottom-6 left-6 z-[1000] flex items-center gap-2 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl select-none">
          <button
            type="button"
            onClick={onToggleRouteEditMode}
            className={`px-3 py-2 rounded-lg text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${isRouteEditMode
                ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-400/60'
                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{isRouteEditMode ? 'Tryb edycji: WŁĄCZONY (klikaj na mapie/linii)' : 'Koryguj trasę na mapie'}</span>
          </button>
          {validViaPoints.length > 0 && onClearViaPoints && (
            <button
              type="button"
              onClick={onClearViaPoints}
              title="Resetuj korekty trasy"
              className="px-2.5 py-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset ({validViaPoints.length})</span>
            </button>
          )}
        </div>
      )}

      <MapContainer
        key="route-planner-map"
        center={defaultCenter}
        zoom={defaultZoom}
        style={{ height: '100%', width: '100%', zIndex: 0 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapInvalidateSize isMapMaximized={isMapMaximized} />
        <MapEvents
          onMapClick={onMapClick}
          isRouteEditMode={isRouteEditMode}
          onAddViaPoint={onAddViaPoint}
        />
        <MapFitBounds activePoints={validActivePoints} isDragging={isDragging} />

        {/* All Points Markers */}
        {validPoints.map(point => {
          if (point.id === undefined) return null;
          const activeIndex = getActiveIndex(point.id);
          const isActive = activeIndex !== -1;
          const label = isActive ? (activeIndex + 1).toString() : '';

          return (
            <CustomMarker
              key={point.id}
              point={point}
              isActive={isActive}
              label={label}
            />
          );
        })}

        {/* Draggable Route Via-Points (Corrections) */}
        {validViaPoints.map((via, idx) => (
          <Marker
            key={`via-${idx}-${via[0]}-${via[1]}`}
            position={[via[0], via[1]]}
            icon={createViaIcon(idx)}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const marker = e.target;
                const { lat, lng } = marker.getLatLng();
                if (onUpdateViaPoint) {
                  onUpdateViaPoint(idx, lat, lng);
                }
              },
            }}
          >
            <Popup>
              <div className="p-1 space-y-2 text-center min-w-[140px]">
                <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
                  Korekta trasowania #{idx + 1}
                </p>
                <p className="text-[10px] text-zinc-500">
                  Możesz przeciągać ten punkt po mapie
                </p>
                {onRemoveViaPoint && (
                  <button
                    type="button"
                    onClick={() => onRemoveViaPoint(idx)}
                    className="w-full py-1 px-2 bg-rose-500 text-white rounded text-[11px] font-bold hover:bg-rose-600 transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Usuń tę korektę</span>
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Driving Route Polyline */}
        {validRouteCoordinates.length > 0 ? (
          <>
            <Polyline
              positions={validRouteCoordinates}
              color={isRouteEditMode ? "#d97706" : "#1e3a8a"}
              weight={10}
              opacity={0.5}
              lineCap="round"
              lineJoin="round"
              eventHandlers={{
                click: (e) => {
                  if (onAddViaPoint) {
                    onAddViaPoint(e.latlng.lat, e.latlng.lng);
                  }
                },
              }}
            />
            <Polyline
              positions={validRouteCoordinates}
              color={isRouteEditMode ? "#f59e0b" : "#4285f4"}
              weight={6}
              opacity={1.0}
              lineCap="round"
              lineJoin="round"
              eventHandlers={{
                click: (e) => {
                  if (onAddViaPoint) {
                    onAddViaPoint(e.latlng.lat, e.latlng.lng);
                  }
                },
              }}
            />
          </>
        ) : (
          validActivePoints.length >= 2 && (
            <>
              <Polyline
                positions={validActivePoints.map(p => [p.lat, p.lng])}
                color="#1e3a8a"
                weight={8}
                opacity={0.4}
                lineCap="round"
                lineJoin="round"
              />
              <Polyline
                positions={validActivePoints.map(p => [p.lat, p.lng])}
                color="#60a5fa"
                weight={4}
                dashArray="8, 10"
                opacity={0.95}
                lineCap="round"
                lineJoin="round"
              />
            </>
          )
        )}
      </MapContainer>
    </div>
  );
}
