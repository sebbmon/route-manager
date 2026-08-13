'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Point, ViaPoint, normalizeViaPoints, findNearestSegmentIndex, sortViaPointsForSegment } from '@/db/database';
import { Loader2, Sliders, RotateCcw, Trash2, Layers, Globe, Move } from 'lucide-react';

// Helper function to fetch detailed OSRM route geometry dynamically
async function fetchOsrmGeometry(
  activePoints: Point[],
  viaPoints: ViaPoint[],
  signal?: AbortSignal
): Promise<[number, number][] | null> {
  if (activePoints.length < 2) return null;
  const maxSegmentIndex = activePoints.length - 2;
  const normalizedVias = normalizeViaPoints(viaPoints, activePoints).filter(
    v => typeof v.segmentIndex === 'number' && v.segmentIndex <= maxSegmentIndex
  );
  const allCoordsList: string[] = [];

  for (let i = 0; i < activePoints.length - 1; i++) {
    const p1 = activePoints[i];
    const p2 = activePoints[i + 1];
    allCoordsList.push(`${p1.lng},${p1.lat}`);
    const segVias = normalizedVias.filter(v => v.segmentIndex === i);
    const sortedSegVias = sortViaPointsForSegment(segVias, p1, p2);
    for (const v of sortedSegVias) {
      allCoordsList.push(`${v.lng},${v.lat}`);
    }
  }
  const lastP = activePoints[activePoints.length - 1];
  allCoordsList.push(`${lastP.lng},${lastP.lat}`);

  const allCoordsStr = allCoordsList.join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${allCoordsStr}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
      return data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
    }
  } catch (err) {
    // Ignore fetch aborts or network blips
  }
  return null;
}

// Google Maps style hover handle icon on polyline
const createRubberbandHandleIcon = () => {
  const html = `
    <div class="relative flex items-center justify-center pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
      <span class="absolute w-5 h-5 rounded-full bg-blue-500/30 animate-ping"></span>
      <div class="w-4 h-4 bg-white rounded-full border-2 border-blue-600 shadow-xl flex items-center justify-center transition-transform scale-110">
        <div class="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-rubberband-handle',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

// Google Maps style dragging handle icon
const createRubberbandDraggingIcon = () => {
  const html = `
    <div class="relative flex items-center justify-center pointer-events-none transform -translate-x-1/2 -translate-y-1/2">
      <span class="absolute w-7 h-7 rounded-full bg-blue-500/25 animate-pulse"></span>
      <div class="w-5 h-5 bg-blue-600 rounded-full border-2 border-white shadow-2xl ring-2 ring-blue-500/50 flex items-center justify-center">
        <div class="w-1.5 h-1.5 bg-white rounded-full"></div>
      </div>
    </div>
  `;
  return L.divIcon({
    html,
    className: 'custom-rubberband-dragging',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
};

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

// Google Maps style subtle waypoint nodes
const viaIconCache = new Map<number, L.DivIcon>();

const createViaIcon = (index: number) => {
  if (!viaIconCache.has(index)) {
    const html = `
      <div class="relative flex items-center justify-center group cursor-grab">
        <div class="w-4 h-4 rounded-full bg-white border-[2.5px] border-amber-500 shadow-md transition-all duration-200 group-hover:scale-125 group-hover:border-amber-600 flex items-center justify-center">
          <div class="w-1.5 h-1.5 rounded-full bg-amber-500 group-hover:bg-amber-600"></div>
        </div>
      </div>
    `;
    viaIconCache.set(
      index,
      L.divIcon({
        html,
        className: 'custom-via-icon',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
        popupAnchor: [0, -8],
      })
    );
  }
  return viaIconCache.get(index)!;
};

let lastRouteDragTimestamp = 0;

// Component to handle map clicks
function MapEvents({
  onMapClick,
  isRouteEditMode,
  onAddViaPoint,
  activePoints,
  segmentPolylines,
}: {
  onMapClick: (lat: number, lng: number) => void;
  isRouteEditMode?: boolean;
  onAddViaPoint?: (lat: number, lng: number, segmentIndex?: number) => void;
  activePoints: Point[];
  segmentPolylines?: [number, number][][];
}) {
  useMapEvents({
    click(e) {
      if (Date.now() - lastRouteDragTimestamp < 400) {
        return;
      }
      if (isRouteEditMode && onAddViaPoint) {
        const segIdx = findNearestSegmentIndex(e.latlng.lat, e.latlng.lng, activePoints, segmentPolylines);
        onAddViaPoint(e.latlng.lat, e.latlng.lng, segIdx);
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
      const timer = setTimeout(() => {
        try {
          if (
            map &&
            (map as any)._loaded &&
            (map as any)._container &&
            (map as any)._mapPane &&
            (map as any)._mapPane._leaflet_pos !== undefined
          ) {
            const bounds = L.latLngBounds(validActivePoints.map(p => [p.lat, p.lng]));
            if (bounds.isValid()) {
              map.fitBounds(bounds, {
                padding: [50, 50],
                maxZoom: 14,
                animate: false,
              });
            }
          }
        } catch (err) {
          // Ignore fitBounds errors during rapid DOM resize / unmount
        }
      }, 100);
      return () => clearTimeout(timer);
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

// Component for real-time dynamic route dragging (Google Maps style)
function RouteRubberbandHandler({
  isRouteEditMode,
  activePolylineCoords,
  segmentPolylines,
  onAddViaPoint,
  activePoints,
  validViaPoints,
  setLiveDragRouteCoords,
}: {
  isRouteEditMode?: boolean;
  activePolylineCoords: [number, number][];
  segmentPolylines: [number, number][][];
  onAddViaPoint?: (lat: number, lng: number, segmentIndex?: number) => void;
  activePoints: Point[];
  validViaPoints: ViaPoint[];
  setLiveDragRouteCoords: (coords: [number, number][] | null) => void;
}) {
  const map = useMap();
  const [hoverPos, setHoverPos] = useState<[number, number] | null>(null);
  const [dragStartPos, setDragStartPos] = useState<[number, number] | null>(null);
  const [dragCurrentPos, setDragCurrentPos] = useState<[number, number] | null>(null);

  const isDraggingRef = useRef(false);
  const dragSegmentIdxRef = useRef<number>(0);
  const lastOsrmFetchTimeRef = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useMapEvents({
    mousemove(e) {
      if (isDraggingRef.current) {
        const curLat = e.latlng.lat;
        const curLng = e.latlng.lng;
        setDragCurrentPos([curLat, curLng]);

        // Throttled OSRM route fetch during mouse movement (500ms)
        const now = Date.now();
        if (now - lastOsrmFetchTimeRef.current > 500) {
          lastOsrmFetchTimeRef.current = now;

          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          const controller = new AbortController();
          abortControllerRef.current = controller;

          const tempVias: ViaPoint[] = [
            ...validViaPoints,
            { segmentIndex: dragSegmentIdxRef.current, lat: curLat, lng: curLng }
          ];

          fetchOsrmGeometry(activePoints, tempVias, controller.signal).then(coords => {
            if (coords && isDraggingRef.current) {
              setLiveDragRouteCoords(coords);
            }
          });
        }
      }
    },
    mouseup(e) {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        lastRouteDragTimestamp = Date.now();

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }

        try {
          map.dragging.enable();
        } catch (err) {
          console.error(err);
        }

        const dropLat = e.latlng.lat;
        const dropLng = e.latlng.lng;
        const segIdx = dragSegmentIdxRef.current;

        setDragStartPos(null);
        setDragCurrentPos(null);
        setHoverPos(null);
        // Keep liveDragRouteCoords active so there is zero flicker while page.tsx fetches updated routeCoordinates

        if (onAddViaPoint) {
          onAddViaPoint(dropLat, dropLng, segIdx);
        }
      }
    },
  });

  if (!isRouteEditMode || activePolylineCoords.length < 2) return null;

  return (
    <>
      {/* Dedicated Invisible Hitbox Polylines per segment for 100% deterministic segment detection */}
      {segmentPolylines.map((segCoords, segIdx) => (
        <Polyline
          key={`hitbox-segment-${segIdx}`}
          positions={segCoords}
          color="#3b82f6"
          weight={30}
          opacity={0.001}
          eventHandlers={{
            mouseover: (e) => {
              if (!isDraggingRef.current) {
                setHoverPos([e.latlng.lat, e.latlng.lng]);
              }
            },
            mousemove: (e) => {
              if (!isDraggingRef.current) {
                setHoverPos([e.latlng.lat, e.latlng.lng]);
              }
            },
            mouseout: () => {
              if (!isDraggingRef.current) {
                setHoverPos(null);
              }
            },
            mousedown: (e) => {
              if (isRouteEditMode) {
                if (e.originalEvent) {
                  L.DomEvent.stopPropagation(e.originalEvent);
                }
                isDraggingRef.current = true;
                try {
                  map.dragging.disable();
                } catch (err) {
                  console.error(err);
                }
                dragSegmentIdxRef.current = segIdx; // 100% EXACT SEGMENT INDEX!
                const startLat = e.latlng.lat;
                const startLng = e.latlng.lng;
                const start: [number, number] = [startLat, startLng];
                setDragStartPos(start);
                setDragCurrentPos(start);
              }
            },
          }}
        />
      ))}

      {/* Google Maps style Hover Handle Marker on Polyline */}
      {hoverPos && !dragStartPos && (
        <Marker
          key="rubberband-hover-marker"
          position={hoverPos}
          icon={createRubberbandHandleIcon()}
          interactive={false}
        />
      )}

      {/* Live Dragging Handle Node */}
      {dragStartPos && dragCurrentPos && (
        <Marker
          key="rubberband-drag-marker"
          position={dragCurrentPos}
          icon={createRubberbandDraggingIcon()}
          interactive={false}
        />
      )}
    </>
  );
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
  viaPoints?: ViaPoint[] | [number, number][];
  onAddViaPoint?: (lat: number, lng: number, segmentIndex?: number) => void;
  onUpdateViaPoint?: (index: number, lat: number, lng: number, segmentIndex?: number) => void;
  onRemoveViaPoint?: (index: number) => void;
  onClearViaPoints?: () => void;
  isModalOpen?: boolean;
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

function ViaPointMarker({
  via,
  idx,
  isRouteEditMode,
  onUpdateViaPoint,
  onRemoveViaPoint,
  activePoints,
  validViaPoints,
  setLiveDragRouteCoords,
}: {
  via: ViaPoint;
  idx: number;
  isRouteEditMode?: boolean;
  onUpdateViaPoint?: (index: number, lat: number, lng: number, segmentIndex?: number) => void;
  onRemoveViaPoint?: (index: number) => void;
  activePoints: Point[];
  validViaPoints: ViaPoint[];
  setLiveDragRouteCoords: (coords: [number, number][] | null) => void;
}) {
  const map = useMap();
  const lastFetchTimeRef = useRef<number>(0);
  const viaKey = `via-marker-${idx}-${via.segmentIndex}-${via.lat.toFixed(6)}-${via.lng.toFixed(6)}`;

  return (
    <Marker
      key={viaKey}
      position={[via.lat, via.lng]}
      icon={createViaIcon(idx)}
      draggable={isRouteEditMode}
      eventHandlers={{
        drag: (e) => {
          if (!isRouteEditMode) return;
          const { lat, lng } = e.target.getLatLng();
          const now = Date.now();
          if (now - lastFetchTimeRef.current > 500) {
            lastFetchTimeRef.current = now;
            const updatedVias = [...validViaPoints];
            updatedVias[idx] = { segmentIndex: via.segmentIndex, lat, lng };
            fetchOsrmGeometry(activePoints, updatedVias).then(coords => {
              if (coords) setLiveDragRouteCoords(coords);
            });
          }
        },
        dragend: (e) => {
          if (!isRouteEditMode) return;
          const marker = e.target;
          const { lat, lng } = marker.getLatLng();
          if (onUpdateViaPoint) {
            onUpdateViaPoint(idx, lat, lng, via.segmentIndex);
          }
        },
      }}
    >
      <Popup key={`popup-${viaKey}`}>
        <div
          className="p-1 space-y-2 text-center min-w-[140px]"
          onClick={(e) => {
            e.stopPropagation();
            if (e.nativeEvent) {
              e.nativeEvent.stopImmediatePropagation();
              e.nativeEvent.stopPropagation();
            }
          }}
        >
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400">
            Punkt trasowania #{idx + 1} (Odcinek {via.segmentIndex + 1})
          </p>
          <p className="text-[10px] text-zinc-500">
            {isRouteEditMode ? 'Przeciągaj punkt po mapie, aby płynnie zagiąć trasę.' : 'Włącz tryb edycji trasy, aby przesuwać/usuwać.'}
          </p>
          {isRouteEditMode && onRemoveViaPoint && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (e.nativeEvent) {
                  e.nativeEvent.stopImmediatePropagation();
                  e.nativeEvent.stopPropagation();
                }
                try {
                  map.closePopup();
                } catch (err) {
                  // ignore
                }
                onRemoveViaPoint(idx);
              }}
              className="w-full py-1 px-2 bg-rose-500 text-white rounded text-[11px] font-bold hover:bg-rose-600 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
              <span>Usuń ten punkt</span>
            </button>
          )}
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
  isModalOpen = false,
}: MapComponentProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [mapTileStyle, setMapTileStyle] = useState<'streets' | 'satellite'>('streets');
  const [liveDragRouteCoords, setLiveDragRouteCoords] = useState<[number, number][] | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Seamless handoff: Clear live drag preview once main routeCoordinates updates from parent
  useEffect(() => {
    setLiveDragRouteCoords(null);
  }, [routeCoordinates]);

  const defaultCenter: [number, number] = [52.0693, 19.4803];
  const defaultZoom = 7;

  const validPoints = useMemo(() => {
    const pointMap = new Map<number, Point>();
    (points || []).forEach(p => {
      if (p && p.id !== undefined) pointMap.set(p.id, p);
    });
    (activePoints || []).forEach(p => {
      if (p && p.id !== undefined) pointMap.set(p.id, p);
    });
    return Array.from(pointMap.values()).filter(
      p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng)
    );
  }, [points, activePoints]);

  const validActivePoints = useMemo(() => {
    return (activePoints || []).filter(p => p && typeof p.lat === 'number' && !isNaN(p.lat) && typeof p.lng === 'number' && !isNaN(p.lng));
  }, [activePoints]);

  const validRouteCoordinates = useMemo(() => {
    return (routeCoordinates || []).filter(
      c => Array.isArray(c) && c.length === 2 && typeof c[0] === 'number' && !isNaN(c[0]) && typeof c[1] === 'number' && !isNaN(c[1])
    );
  }, [routeCoordinates]);

  const validViaPoints = useMemo<ViaPoint[]>(() => {
    if (validActivePoints.length < 2) return [];
    const maxSegmentIndex = validActivePoints.length - 2;
    return normalizeViaPoints(viaPoints, validActivePoints).filter(
      v => v && typeof v.lat === 'number' && !isNaN(v.lat) && typeof v.lng === 'number' && !isNaN(v.lng) && typeof v.segmentIndex === 'number' && v.segmentIndex <= maxSegmentIndex
    );
  }, [viaPoints, validActivePoints]);

  const activePolylineCoords = useMemo<[number, number][]>(() => {
    if (liveDragRouteCoords && liveDragRouteCoords.length > 0) {
      return liveDragRouteCoords;
    }
    if (validRouteCoordinates.length > 0) {
      return validRouteCoordinates;
    }
    if (validActivePoints.length >= 2) {
      return validActivePoints.map(p => [p.lat, p.lng] as [number, number]);
    }
    return [];
  }, [liveDragRouteCoords, validRouteCoordinates, validActivePoints]);

  const segmentPolylines = useMemo<[number, number][][]>(() => {
    if (validActivePoints.length < 2) return [];

    const baseCoords = liveDragRouteCoords && liveDragRouteCoords.length > 0
      ? liveDragRouteCoords
      : validRouteCoordinates;

    if (baseCoords.length > 0) {
      const splitIndices: number[] = [0];
      for (let i = 1; i < validActivePoints.length - 1; i++) {
        const p = validActivePoints[i];
        let minDist = Infinity;
        let bestIdx = splitIndices[splitIndices.length - 1];
        for (let j = bestIdx; j < baseCoords.length; j++) {
          const c = baseCoords[j];
          const distSq = (c[0] - p.lat) * (c[0] - p.lat) + (c[1] - p.lng) * (c[1] - p.lng);
          if (distSq < minDist) {
            minDist = distSq;
            bestIdx = j;
          }
        }
        splitIndices.push(bestIdx);
      }
      splitIndices.push(baseCoords.length - 1);

      const result: [number, number][][] = [];
      for (let i = 0; i < validActivePoints.length - 1; i++) {
        const startIdx = splitIndices[i];
        const endIdx = splitIndices[i + 1];
        const coords = baseCoords.slice(startIdx, endIdx + 1);
        result.push(coords.length > 0 ? coords : [[validActivePoints[i].lat, validActivePoints[i].lng], [validActivePoints[i + 1].lat, validActivePoints[i + 1].lng]]);
      }
      return result;
    }

    const result: [number, number][][] = [];
    for (let i = 0; i < validActivePoints.length - 1; i++) {
      result.push([
        [validActivePoints[i].lat, validActivePoints[i].lng],
        [validActivePoints[i + 1].lat, validActivePoints[i + 1].lng]
      ]);
    }
    return result;
  }, [liveDragRouteCoords, validRouteCoordinates, validActivePoints]);

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
    <div className={`w-full h-full relative ${mapTileStyle === 'satellite' ? 'map-mode-satellite' : 'map-mode-streets'} ${isModalOpen ? 'pointer-events-none select-none' : ''}`}>
      {/* Map Tile Style Switcher (Top-Left Corner next to Leaflet zoom controls) */}
      <div className="absolute top-3.5 left-14 z-[1000] flex items-center bg-white dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xl select-none">
        <button
          type="button"
          onClick={() => setMapTileStyle('streets')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${mapTileStyle === 'streets'
            ? 'bg-emerald-600 text-white shadow-md'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ulica</span>
        </button>
        <button
          type="button"
          onClick={() => setMapTileStyle('satellite')}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer ${mapTileStyle === 'satellite'
            ? 'bg-emerald-600 text-white shadow-md'
            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Satelita</span>
        </button>
      </div>

      {/* Floating Route Edit Controls Header on Map (Bottom-Left Corner) */}
      {validActivePoints.length >= 2 && onToggleRouteEditMode && (
        <div className="absolute bottom-6 left-6 z-[1000] flex items-center gap-2 bg-white dark:bg-zinc-900 p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl select-none">
          <button
            type="button"
            onClick={onToggleRouteEditMode}
            className={`px-3 py-2 rounded-lg text-xs font-extrabold transition flex items-center gap-2 cursor-pointer ${isRouteEditMode
              ? 'bg-amber-500 text-white shadow-lg ring-2 ring-amber-400/60'
              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-700'
              }`}
          >
            <Sliders className="w-4 h-4" />
            <span>{isRouteEditMode ? 'Tryb edycji: Przeciągaj trasę w locie (Real-time Drag)' : 'Koryguj trasę na mapie (Drag & Drop)'}</span>
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
          key="main-tile-layer"
          className={mapTileStyle === 'satellite' ? 'leaflet-satellite-tile' : ''}
          url={
            mapTileStyle === 'satellite'
              ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
              : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
          }
          attribution={
            mapTileStyle === 'satellite'
              ? 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and GIS User Community'
              : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          }
          maxZoom={19}
        />

        {/* Hybrid Satellite Overlay: Street Names, Roads and City Boundaries */}
        {mapTileStyle === 'satellite' && (
          <TileLayer
            key="satellite-transportation-overlay"
            className="leaflet-satellite-tile"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}"
            minZoom={11}
            maxZoom={19}
          />
        )}
        {mapTileStyle === 'satellite' && (
          <TileLayer
            key="satellite-boundaries-overlay"
            className="leaflet-satellite-tile"
            url="https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
            minZoom={6}
            maxZoom={19}
          />
        )}

        <MapInvalidateSize isMapMaximized={isMapMaximized} />
        <MapEvents
          onMapClick={onMapClick}
          isRouteEditMode={isRouteEditMode}
          onAddViaPoint={onAddViaPoint}
          activePoints={validActivePoints}
          segmentPolylines={segmentPolylines}
        />
        <MapFitBounds activePoints={validActivePoints} isDragging={isDragging} />

        <RouteRubberbandHandler
          isRouteEditMode={isRouteEditMode}
          activePolylineCoords={activePolylineCoords}
          segmentPolylines={segmentPolylines}
          onAddViaPoint={onAddViaPoint}
          activePoints={validActivePoints}
          validViaPoints={validViaPoints}
          setLiveDragRouteCoords={setLiveDragRouteCoords}
        />

        {/* All Points Markers */}
        {validPoints.map(point => {
          if (point.id === undefined) return null;
          const activeIndex = getActiveIndex(point.id);
          const isActive = activeIndex !== -1;
          const label = isActive ? (activeIndex + 1).toString() : '';

          return (
            <CustomMarker
              key={`marker-point-${point.id}`}
              point={point}
              isActive={isActive}
              label={label}
            />
          );
        })}

        {/* Draggable Route Via-Points (Google Maps style dynamic waypoint nodes) */}
        {validViaPoints.map((via, idx) => (
          <ViaPointMarker
            key={`via-${idx}-${via.segmentIndex}-${via.lat.toFixed(6)}-${via.lng.toFixed(6)}`}
            via={via}
            idx={idx}
            isRouteEditMode={isRouteEditMode}
            onUpdateViaPoint={onUpdateViaPoint}
            onRemoveViaPoint={onRemoveViaPoint}
            activePoints={validActivePoints}
            validViaPoints={validViaPoints}
            setLiveDragRouteCoords={setLiveDragRouteCoords}
          />
        ))}

        {/* Persistent Driving / Fallback Route Polyline */}
        {activePolylineCoords.length > 0 && (
          <>
            <Polyline
              key="main-route-line-outer"
              positions={activePolylineCoords}
              color={isRouteEditMode ? "#d97706" : "#1e3a8a"}
              weight={validRouteCoordinates.length > 0 ? 10 : 8}
              opacity={validRouteCoordinates.length > 0 ? 0.5 : 0.4}
              dashArray={validRouteCoordinates.length > 0 ? undefined : "8, 10"}
              lineCap="round"
              lineJoin="round"
              eventHandlers={{
                click: (e) => {
                  if (isRouteEditMode && onAddViaPoint) {
                    const segIdx = findNearestSegmentIndex(e.latlng.lat, e.latlng.lng, validActivePoints);
                    onAddViaPoint(e.latlng.lat, e.latlng.lng, segIdx);
                  }
                },
              }}
            />
            <Polyline
              key="main-route-line-inner"
              positions={activePolylineCoords}
              color={isRouteEditMode ? "#f59e0b" : validRouteCoordinates.length > 0 ? "#4285f4" : "#60a5fa"}
              weight={validRouteCoordinates.length > 0 ? 6 : 4}
              opacity={validRouteCoordinates.length > 0 ? 1.0 : 0.95}
              dashArray={validRouteCoordinates.length > 0 ? undefined : "8, 10"}
              lineCap="round"
              lineJoin="round"
              eventHandlers={{
                click: (e) => {
                  if (isRouteEditMode && onAddViaPoint) {
                    const segIdx = findNearestSegmentIndex(e.latlng.lat, e.latlng.lng, validActivePoints);
                    onAddViaPoint(e.latlng.lat, e.latlng.lng, segIdx);
                  }
                },
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}

