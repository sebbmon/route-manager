'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  db,
  updateDistanceMatrix,
  Point,
  RouteHistory,
  SavedRoute,
  ViaPoint,
  findNearestSegmentIndex,
  normalizeViaPoints,
  sortViaPointsForSegment,
  exportDatabaseToJSON,
  importDatabaseFromJSON,
  DatabaseBackupData
} from '@/db/database';
import {
  MapPin,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Plus,
  Route,
  History,
  Calendar,
  Moon,
  Sun,
  Map as MapIcon,
  Loader2,
  CheckSquare,
  Square,
  ChevronRight,
  RefreshCw,
  Info,
  Search,
  X,
  Maximize2,
  Minimize2,
  Minus,
  Database,
  Compass,
  Sliders,
  SlidersHorizontal,
  CheckCircle2,
  Layers,
  Sparkles,
  Command,
  Monitor,
  GripVertical,
  ChevronDown,
  Check,
  RotateCcw,
  Save,
  Download,
  Upload,
  Settings,
  FileJson,
  ExternalLink,
  QrCode,
  Copy
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Dynamic import of MapComponent with SSR disabled to prevent Leaflet errors
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 animate-pulse flex flex-col items-center justify-center text-zinc-500 gap-3 border border-zinc-200 dark:border-zinc-800">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      <span className="text-sm font-medium">Inicjalizacja silnika mapy Leaflet...</span>
    </div>
  )
});

// Helper to format Nominatim address object as "ulica, numer, miejscowość, kod pocztowy"
const formatOsmAddress = (addressObj: any, defaultDisplay: string): string => {
  if (!addressObj) return defaultDisplay;

  const street = addressObj.road || addressObj.pedestrian || addressObj.street || addressObj.suburb;
  const houseNumber = addressObj.house_number || addressObj.building;
  const town = addressObj.city || addressObj.town || addressObj.village || addressObj.municipality || addressObj.hamlet;
  const postcode = addressObj.postcode;

  const parts: string[] = [];
  if (street) parts.push(street);
  if (houseNumber) parts.push(houseNumber);
  if (town) parts.push(town);
  if (postcode) parts.push(postcode);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return defaultDisplay;
};

// Helper to format Photon address properties into "ulica, numer, miejscowość, kod pocztowy"
const formatPhotonAddress = (properties: any): string => {
  if (!properties) return '';
  const street = properties.street;
  const houseNumber = properties.housenumber;
  const town = properties.city || properties.city_district || properties.town || properties.village || properties.municipality || properties.hamlet;
  const postcode = properties.postcode;

  const parts: string[] = [];
  if (street) parts.push(street);
  if (houseNumber) parts.push(houseNumber);
  if (town) parts.push(town);
  if (postcode) parts.push(postcode);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return properties.name || '';
};

// Helper to construct a clear suggestion text for autocomplete items
const getPhotonSuggestionText = (feature: any): string => {
  const p = feature.properties;
  const name = p.name || '';
  const street = p.street;
  const houseNumber = p.housenumber;
  const city = p.city || p.city_district || p.town || p.village;

  const addressParts: string[] = [];
  if (street) {
    if (houseNumber) {
      addressParts.push(`${street} ${houseNumber}`);
    } else {
      addressParts.push(street);
    }
  }
  if (city) {
    addressParts.push(city);
  }

  const addressText = addressParts.join(', ');
  if (name && addressText && name !== addressText && !addressText.startsWith(name)) {
    return `${name} (${addressText})`;
  }
  return name || addressText || 'Nieznana lokalizacja';
};

export default function Dashboard() {
  // Database live queries
  const rawPointsQuery = useLiveQuery(() => db.points.toArray());
  const rawPoints = useMemo(() => rawPointsQuery || [], [rawPointsQuery]);

  const points = useMemo(() => {
    return [...rawPoints].sort((a, b) => (a.order ?? a.id ?? 0) - (b.order ?? b.id ?? 0));
  }, [rawPoints]);

  const savedRoutes = useLiveQuery(() => db.routes_history.toArray()) || [];
  const savedUserRoutesQuery = useLiveQuery(() => db.routes.toArray());
  const savedUserRoutes = useMemo(() => savedUserRoutesQuery || [], [savedUserRoutesQuery]);

  // Active Route Folder state
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);
  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [editingFolderRoute, setEditingFolderRoute] = useState<SavedRoute | null>(null);
  const [editFolderRouteName, setEditFolderRouteName] = useState('');
  const [deletingFolderRoute, setDeletingFolderRoute] = useState<SavedRoute | null>(null);

  // Active route object helper
  const activeRoute = useMemo(() => {
    return savedUserRoutes.find(r => r.id === activeRouteId) || null;
  }, [savedUserRoutes, activeRouteId]);

  // Sidebar navigation tab state
  const [activeTab, setActiveTab] = useState<'points' | 'route' | 'history' | 'backup'>('points');

  // Backup & Restore state & handlers
  const [importBackupData, setImportBackupData] = useState<DatabaseBackupData | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportBackup = async () => {
    try {
      const backupObj = await exportDatabaseToJSON();
      const jsonStr = JSON.stringify(backupObj, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `transport_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showStatusMessage(`Pobrano kopię zapasową (${backupObj.points.length} pkt, ${backupObj.routes_history.length} tras)`, 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas eksportu kopii zapasowej.', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as DatabaseBackupData;
        if (!parsed || !Array.isArray(parsed.points)) {
          showStatusMessage('Wybrany plik nie jest prawidłową kopią zapasową aplikacji.', 'error');
          return;
        }
        setImportBackupData(parsed);
        setIsImportModalOpen(true);
      } catch (err) {
        console.error(err);
        showStatusMessage('Błąd podczas odczytu pliku JSON.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleConfirmImport = async (mode: 'overwrite' | 'merge') => {
    if (!importBackupData) return;
    try {
      const res = await importDatabaseFromJSON(importBackupData, mode);
      showStatusMessage(
        `Przywrócono bazę (${mode === 'overwrite' ? 'zastąpiono' : 'scalono'}): ${res.pointsCount} punktów, ${res.historyCount} tras.`,
        'success'
      );
      setIsImportModalOpen(false);
      setImportBackupData(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas przywracania bazy danych.', 'error');
    }
  };

  // Google Maps Export Modal state & segments calculation
  const [isGmapsExportModalOpen, setIsGmapsExportModalOpen] = useState(false);
  const [copiedSegmentIndex, setCopiedSegmentIndex] = useState<number | null>(null);

  const handleCopySegmentLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedSegmentIndex(index);
      showStatusMessage(`Skopiowano link do Segmentu #${index}!`, 'success');
      setTimeout(() => setCopiedSegmentIndex(null), 2500);
    }).catch(err => {
      console.error(err);
      showStatusMessage('Nie udało się skopiować linku.', 'error');
    });
  };

  const handleOpenExternalUrl = async (url: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      const { open: openShellUrl } = await import('@tauri-apps/plugin-shell');
      await openShellUrl(url);
    } catch (err) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Ensure an active route ID exists when adding points
  const ensureActiveRouteId = async (): Promise<number> => {
    if (activeRouteId !== null) {
      const existing = savedUserRoutes.find(r => r.id === activeRouteId);
      if (existing && existing.id !== undefined) return existing.id;
    }
    if (savedUserRoutes.length > 0 && savedUserRoutes[0].id !== undefined) {
      setActiveRouteId(savedUserRoutes[0].id);
      return savedUserRoutes[0].id;
    }
    const newId = await db.routes.add({
      name: 'Główna Trasa',
      createdAt: new Date().toISOString(),
      order: 0
    });
    setActiveRouteId(newId);
    return newId;
  };

  // Migration & cleanup: Only create "Główna Trasa" if there are unassigned points needing a route
  useEffect(() => {
    if (savedUserRoutesQuery === undefined || rawPointsQuery === undefined) return;

    const migrateUnassignedPointsAndCleanup = async () => {
      // 1. Clean up duplicate empty "Główna Trasa" routes created during previous hot-reloads
      if (savedUserRoutesQuery.length > 1) {
        const defaultNameRoutes = savedUserRoutesQuery.filter(r => r.name === 'Główna Trasa');
        if (defaultNameRoutes.length > 1) {
          for (let i = 1; i < defaultNameRoutes.length; i++) {
            const route = defaultNameRoutes[i];
            if (route.id !== undefined) {
              const pointCount = rawPointsQuery.filter(p => p.routeId === route.id).length;
              if (pointCount === 0) {
                await db.routes.delete(route.id);
              }
            }
          }
        }
      }

      // 2. Check for orphan/unassigned points
      const validRouteIds = new Set(savedUserRoutesQuery.map(r => r.id));
      const unassignedPoints = rawPointsQuery.filter(p => !p.routeId || !validRouteIds.has(p.routeId));

      // ONLY create a default route if there are points that actually need a route!
      if (unassignedPoints.length > 0) {
        let targetRouteId: number;

        if (savedUserRoutesQuery.length > 0 && savedUserRoutesQuery[0].id !== undefined) {
          targetRouteId = savedUserRoutesQuery[0].id;
        } else {
          targetRouteId = await db.routes.add({
            name: 'Główna Trasa',
            createdAt: new Date().toISOString(),
            order: 0
          });
        }

        for (const p of unassignedPoints) {
          if (p.id !== undefined) {
            await db.points.update(p.id, { routeId: targetRouteId });
          }
        }

        setActiveRouteId(prev => prev ?? targetRouteId);
      } else if (activeRouteId === null && savedUserRoutesQuery.length > 0) {
        setActiveRouteId(savedUserRoutesQuery[0].id ?? null);
      }
    };

    migrateUnassignedPointsAndCleanup();
  }, [savedUserRoutesQuery, rawPointsQuery, activeRouteId]);

  // Automatically reverse-geocode legacy points that don't have an address stored in IndexedDB
  useEffect(() => {
    const updateLegacyPoints = async () => {
      const legacyPoints = points.filter(p => !p.address);
      if (legacyPoints.length === 0) return;

      for (const point of legacyPoints) {
        if (point.id === undefined) continue;
        try {
          await new Promise(resolve => setTimeout(resolve, 1000));
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${point.lat}&lon=${point.lng}&format=json`, {
            headers: { 'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data) {
              const formatted = formatOsmAddress(data.address, data.display_name || '');
              await db.points.update(point.id, {
                address: formatted
              });
            }
          } else {
            await db.points.update(point.id, {
              address: `Szer: ${point.lat.toFixed(4)}, Dł: ${point.lng.toFixed(4)}`
            });
          }
        } catch (err) {
          console.error(`Failed to update address for legacy point ${point.id}:`, err);
          await db.points.update(point.id, {
            address: `Szer: ${point.lat.toFixed(4)}, Dł: ${point.lng.toFixed(4)}`
          });
        }
      }
    };

    if (points.length > 0) {
      updateLegacyPoints();
    }
  }, [points]);

  // Local state
  const [activePointIds, setActivePointIds] = useState<number[]>([]);
  const [formData, setFormData] = useState({ id: undefined as number | undefined, name: '', lat: '', lng: '', address: '' });
  const [routeName, setRouteName] = useState('');
  const [isUpdatingMatrix, setIsUpdatingMatrix] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [stepDistances, setStepDistances] = useState<Record<string, number>>({});
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMapMaximized, setIsMapMaximized] = useState(false);

  // Drag and Drop live-swapping state
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
  const [activeSavedDragId, setActiveSavedDragId] = useState<number | null>(null);

  // Via-points (route corrections) state
  const [isRouteEditMode, setIsRouteEditMode] = useState(false);
  const [viaPoints, setViaPoints] = useState<ViaPoint[]>([]);

  // Route edit mode & via-points are automatically reset whenever active route or active points selection changes
  useEffect(() => {
    setIsRouteEditMode(false);
    if (activePointIds.length < 2) {
      setViaPoints([]);
    } else {
      const maxSegmentIndex = activePointIds.length - 2;
      setViaPoints(prev => prev.filter(v => typeof v.segmentIndex === 'number' && v.segmentIndex <= maxSegmentIndex));
    }
  }, [activePointIds, activeRouteId]);

  const handleToggleRouteEditMode = () => {
    setIsRouteEditMode(prev => !prev);
  };

  const handleAddViaPoint = (lat: number, lng: number, segmentIndex?: number) => {
    const activePoints = activePointIds
      .map(id => points.find(p => p.id === id))
      .filter((p): p is Point => !!p);

    const finalSegmentIndex = typeof segmentIndex === 'number'
      ? segmentIndex
      : findNearestSegmentIndex(lat, lng, activePoints);

    setViaPoints(prev => [...prev, { segmentIndex: finalSegmentIndex, lat, lng }]);
    showStatusMessage('Dodano korektę trasowania na mapie!', 'success');
  };

  const handleUpdateViaPoint = (index: number, lat: number, lng: number, segmentIndex?: number) => {
    const activePoints = activePointIds
      .map(id => points.find(p => p.id === id))
      .filter((p): p is Point => !!p);

    setViaPoints(prev => {
      const updated = [...prev];
      const existing = updated[index];
      const segIdx = typeof segmentIndex === 'number'
        ? segmentIndex
        : (existing && typeof existing.segmentIndex === 'number' ? existing.segmentIndex : findNearestSegmentIndex(lat, lng, activePoints));

      updated[index] = { segmentIndex: segIdx, lat, lng };
      return updated;
    });
  };

  const handleRemoveViaPoint = (index: number) => {
    setViaPoints(prev => prev.filter((_, i) => i !== index));
    showStatusMessage('Usunięto korektę trasowania.', 'success');
  };

  const handleClearViaPoints = () => {
    setViaPoints([]);
    showStatusMessage('Zresetowano wszystkie korekty trasowania.', 'success');
  };

  // Modal editing state
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [deletingPoint, setDeletingPoint] = useState<Point | null>(null);
  const [editFormData, setEditFormData] = useState<{
    name: string;
    lat: string;
    lng: string;
    address: string;
    routeId?: number;
  }>({ name: '', lat: '', lng: '', address: '', routeId: undefined });
  const [isRouteSelectOpen, setIsRouteSelectOpen] = useState(false);

  const selectedRoute = useMemo(() => {
    const targetId = editFormData.routeId ?? editingPoint?.routeId;
    return savedUserRoutes.find(r => r.id === targetId) || null;
  }, [savedUserRoutes, editFormData.routeId, editingPoint?.routeId]);

  // Loaded route state
  const [loadedRouteId, setLoadedRouteId] = useState<number | null>(null);

  // Modal editing route in history state
  const [editingRoute, setEditingRoute] = useState<RouteHistory | null>(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [updatePointsWithActive, setUpdatePointsWithActive] = useState(false);

  // Modal deleting route state
  const [deletingRoute, setDeletingRoute] = useState<RouteHistory | null>(null);
  const [editAddressQuery, setEditAddressQuery] = useState('');
  const [editIsGeocoding, setEditIsGeocoding] = useState(false);
  const [editGeocodingResults, setEditGeocodingResults] = useState<{ display_name: string; name: string; address: string; lat: number; lng: number }[]>([]);

  // Modal backdrop click safety helper (prevents accidental closing when dragging text selection outside modal)
  const backdropMouseDownRef = useRef<boolean>(false);

  const handleBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      backdropMouseDownRef.current = true;
    } else {
      backdropMouseDownRef.current = false;
    }
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>, closeFn: () => void) => {
    if (e.target === e.currentTarget && backdropMouseDownRef.current) {
      closeFn();
    }
    backdropMouseDownRef.current = false;
  };

  // Geocoding state
  const [addressQuery, setAddressQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<{ display_name: string; name: string; address: string; lat: number; lng: number }[]>([]);

  // Desktop Window Controls (Tauri API wrapper with web fallbacks)
  const handleMinimizeWindow = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch {
      // Ignored when running in standard browser dev mode
    }
  };

  const handleMaximizeWindow = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().toggleMaximize();
    } catch {
      setIsMapMaximized(prev => !prev);
    }
  };

  const handleCloseWindow = async () => {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch {
      showStatusMessage('W środowisku przeglądarki użyj skrótu Alt+F4 lub zamknij kartę.', 'error');
    }
  };

  // Clear active route selection
  const handleClearActiveRoute = () => {
    setActivePointIds([]);
    setRouteName('');
    setLoadedRouteId(null);
    setRouteCoordinates([]);
    setTotalDistance(0);
    setStepDistances({});
    setViaPoints([]);
    setIsRouteEditMode(false);
    showStatusMessage('Wyczyszczono aktywny plan trasy.', 'success');
  };

  // Check if current active route has a return leg back to start
  const isHasReturnLeg = useMemo(() => {
    return activePointIds.length > 1 && activePointIds[activePointIds.length - 1] === activePointIds[0];
  }, [activePointIds]);

  // Toggle return to start (append/remove start point at the end of route)
  const handleToggleReturnToStart = () => {
    if (activePointIds.length === 0) {
      showStatusMessage('Dodaj najpierw przynajmniej jeden punkt do trasy.', 'error');
      return;
    }
    const firstId = activePointIds[0];
    const isCurrentlyLoop = activePointIds.length > 1 && activePointIds[activePointIds.length - 1] === firstId;

    if (isCurrentlyLoop) {
      setActivePointIds(prev => prev.slice(0, prev.length - 1));
      showStatusMessage('Usunięto powrót do punktu startowego z trasy.', 'success');
    } else {
      setActivePointIds(prev => [...prev, firstId]);
      showStatusMessage('Dodano punkt startowy na koniec trasy jako przystanek powrotny.', 'success');
    }
  };

  // Keyboard Shortcuts (Ctrl+F for search, Ctrl+A to select all points, Esc for close modals and clear route)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toUpperCase();
      const isTypingInInput = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || (document.activeElement as HTMLElement)?.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveTab('points');
        setTimeout(() => {
          const el = document.getElementById('desktop-main-search-input');
          if (el) el.focus();
        }, 50);
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !isTypingInInput) {
        e.preventDefault();
        const availablePoints = points.filter(p => activeRouteId === null || p.routeId === activeRouteId);
        const allIds = availablePoints.map(p => p.id).filter((id): id is number => id !== undefined);
        if (allIds.length === 0) {
          showStatusMessage('Brak zapisanych lokalizacji do zaznaczenia.', 'error');
        } else {
          setActivePointIds(allIds);
          showStatusMessage(`Zaznaczono wszystkie lokalizacje (${allIds.length}).`, 'success');
        }
      } else if (e.key === 'Escape') {
        setEditingPoint(null);
        setDeletingPoint(null);
        setEditingRoute(null);
        setDeletingRoute(null);
        setGeocodingResults([]);
        setEditGeocodingResults([]);
        setIsMapMaximized(false);
        handleClearActiveRoute();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [points, activeRouteId]);

  // Photon Address Search for Edit Modal
  const handleEditSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAddressQuery.trim()) return;

    setEditIsGeocoding(true);
    setEditGeocodingResults([]);

    try {
      const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(editAddressQuery.trim())}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const results = data.features.map((feature: any) => {
            const p = feature.properties;
            const [lng, lat] = feature.geometry.coordinates;
            const displayName = getPhotonSuggestionText(feature);
            const address = formatPhotonAddress(p);
            return {
              display_name: displayName,
              name: p.name || address || 'Lokalizacja',
              address: address,
              lat,
              lng
            };
          });

          handleEditSelectAddress(results[0]);
        } else {
          showStatusMessage('Nie znaleziono podanego adresu w edycji.', 'error');
        }
      } else {
        throw new Error('Photon geocoding failed');
      }
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd wyszukiwania adresu w edycji.', 'error');
    } finally {
      setEditIsGeocoding(false);
    }
  };

  const handleEditSelectAddress = (result: { display_name: string; name: string; address: string; lat: number; lng: number }) => {
    setEditFormData(prev => ({
      ...prev,
      name: result.name,
      lat: result.lat.toFixed(6),
      lng: result.lng.toFixed(6),
      address: result.address
    }));

    setEditGeocodingResults([]);
    setEditAddressQuery('');
  };

  const handleUpdatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoint || editingPoint.id === undefined) return;
    if (!editFormData.name.trim() || !editFormData.lat || !editFormData.lng) {
      showStatusMessage('Wypełnij wszystkie pola formularza edycji!', 'error');
      return;
    }

    const latVal = parseFloat(editFormData.lat);
    const lngVal = parseFloat(editFormData.lng);

    if (isNaN(latVal) || latVal < -90 || latVal > 90 || isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
      showStatusMessage('Wprowadź prawidłowe współrzędne geograficzne!', 'error');
      return;
    }

    setIsUpdatingMatrix(true);
    try {
      let finalAddress = editFormData.address;
      if (!finalAddress || finalAddress.startsWith('Pobieranie adresu...') || finalAddress.startsWith('Współrzędne:')) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latVal}&lon=${lngVal}&format=json`, {
            headers: { 'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data) {
              finalAddress = formatOsmAddress(data.address, data.display_name || '');
            }
          }
        } catch (err) {
          console.error('Edit submit reverse-lookup error:', err);
        }
      }

      const savedAddress = finalAddress || `Szer: ${latVal.toFixed(4)}, Dł: ${lngVal.toFixed(4)}`;
      const targetRouteId = editFormData.routeId ?? editingPoint.routeId;

      await db.points.update(editingPoint.id, {
        name: editFormData.name.trim(),
        lat: latVal,
        lng: lngVal,
        address: savedAddress,
        ...(targetRouteId !== undefined ? { routeId: targetRouteId } : {})
      });

      if (targetRouteId !== undefined && targetRouteId !== editingPoint.routeId) {
        setActivePointIds(prev => prev.filter(id => id !== editingPoint.id));
        const targetRoute = savedUserRoutes.find(r => r.id === targetRouteId);
        const routeMsg = targetRoute ? ` do trasy "${targetRoute.name}"` : '';
        showStatusMessage(`Zaktualizowano i przeniesiono punkt${routeMsg}!`, 'success');
      } else {
        showStatusMessage('Zaktualizowano punkt w bazie!', 'success');
      }

      await updateDistanceMatrix();
      setEditingPoint(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd aktualizacji punktu.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Main Search Input
  const handleSearchAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressQuery.trim()) return;

    setIsGeocoding(true);
    setError(null);
    setGeocodingResults([]);

    try {
      const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(addressQuery.trim())}&limit=5`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.features && data.features.length > 0) {
          const results = data.features.map((feature: any) => {
            const p = feature.properties;
            const [lng, lat] = feature.geometry.coordinates;
            const displayName = getPhotonSuggestionText(feature);
            const address = formatPhotonAddress(p);
            return {
              display_name: displayName,
              name: p.name || address || 'Lokalizacja',
              address: address,
              lat,
              lng
            };
          });

          await handleSelectAddress(results[0]);
        } else {
          showStatusMessage('Nie znaleziono podanego adresu.', 'error');
        }
      } else {
        throw new Error('Photon geocoding failed');
      }
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd wyszukiwania adresu.', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  // Select Address suggestion and auto-save
  const handleSelectAddress = async (result: { display_name: string; name: string; address: string; lat: number; lng: number }) => {
    setFormData({
      id: undefined,
      name: result.name,
      lat: result.lat.toFixed(6),
      lng: result.lng.toFixed(6),
      address: result.address
    });

    setGeocodingResults([]);
    setAddressQuery('');

    setIsUpdatingMatrix(true);
    try {
      const targetRouteId = await ensureActiveRouteId();
      const maxOrder = points.reduce((max, p) => Math.max(max, p.order ?? 0), 0);
      await db.points.add({
        routeId: targetRouteId,
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        address: result.address,
        order: points.length > 0 ? maxOrder + 1 : 0
      });
      showStatusMessage(`Automatycznie zapisano punkt: ${result.name}`, 'success');
      await updateDistanceMatrix();
    } catch (err) {
      console.error('Auto-save point error:', err);
      showStatusMessage('Błąd automatycznego zapisu punktu.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Theme Handler
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
    setTheme(initialTheme);

    if (initialTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  // Global click listener to dismiss search dropdown lists
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.main-search-container')) {
        setGeocodingResults([]);
      }
      if (!target.closest('.edit-search-container')) {
        setEditGeocodingResults([]);
      }
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, []);

  // Autocomplete debounce for Main Search Input
  useEffect(() => {
    if (addressQuery.trim().length < 3) {
      setGeocodingResults([]);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api?q=${encodeURIComponent(addressQuery.trim())}&limit=5`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.features) {
            const results = data.features.map((feature: any) => {
              const p = feature.properties;
              const [lng, lat] = feature.geometry.coordinates;
              const displayName = getPhotonSuggestionText(feature);
              const address = formatPhotonAddress(p);
              return {
                display_name: displayName,
                name: p.name || address || 'Lokalizacja',
                address: address,
                lat,
                lng
              };
            });
            setGeocodingResults(results);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Photon autocomplete error:', err);
        }
      } finally {
        setIsGeocoding(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [addressQuery]);

  // Autocomplete debounce for Edit Modal Search Input
  useEffect(() => {
    if (editAddressQuery.trim().length < 3) {
      setEditGeocodingResults([]);
      return;
    }

    const controller = new AbortController();
    const delayDebounceFn = setTimeout(async () => {
      setEditIsGeocoding(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api?q=${encodeURIComponent(editAddressQuery.trim())}&limit=5`,
          { signal: controller.signal }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.features) {
            const results = data.features.map((feature: any) => {
              const p = feature.properties;
              const [lng, lat] = feature.geometry.coordinates;
              const displayName = getPhotonSuggestionText(feature);
              const address = formatPhotonAddress(p);
              return {
                display_name: displayName,
                name: p.name || address || 'Lokalizacja',
                address: address,
                lat,
                lng
              };
            });
            setEditGeocodingResults(results);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Photon edit autocomplete error:', err);
        }
      } finally {
        setEditIsGeocoding(false);
      }
    }, 300);

    return () => {
      clearTimeout(delayDebounceFn);
      controller.abort();
    };
  }, [editAddressQuery]);

  // Fetch OSRM high-fidelity road polyline (deferred during live dragging for 60fps fluid performance)
  useEffect(() => {
    if (activeDragIndex !== null) return;

    const fetchRouteLine = async () => {
      if (activePointIds.length < 2) {
        setRouteCoordinates([]);
        return;
      }

      const activePoints = activePointIds
        .map(id => points.find(p => p.id === id))
        .filter((p): p is Point => !!p);

      if (activePoints.length < 2) {
        setRouteCoordinates([]);
        return;
      }

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
        const res = await fetch(url);
        if (!res.ok) {
          if (res.status === 429) {
            showStatusMessage('Limit zapytań darmowego serwera (429 Rate Limit). Odczekaj chwilę.', 'error');
          } else {
            showStatusMessage('Błąd pobierania trasy z serwera OSRM.', 'error');
          }
          throw new Error(`OSRM Route API failed: ${res.status}`);
        }
        const data = await res.json();

        if (data.code === 'Ok' && data.routes?.[0]?.geometry?.coordinates) {
          const parsedCoords = data.routes[0].geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
          setRouteCoordinates(parsedCoords);

          if (viaPoints.length > 0 && data.routes[0].distance !== undefined) {
            const distanceKm = Math.round((data.routes[0].distance / 1000) * 10) / 10;
            setTotalDistance(distanceKm);
          }
        } else {
          setRouteCoordinates([]);
        }
      } catch (err) {
        console.error('Failed to load detailed route geometry:', err);
        setRouteCoordinates([]);
      }
    };

    fetchRouteLine();
  }, [activePointIds, points, activeDragIndex, viaPoints]);

  // Real-time Distance Summing & Step Distances from IndexedDB
  useEffect(() => {
    const calcDistance = async () => {
      if (viaPoints.length > 0) return;

      if (activePointIds.length < 2) {
        setTotalDistance(0);
        setStepDistances({});
        return;
      }

      let sum = 0;
      const steps: Record<string, number> = {};

      for (let i = 0; i < activePointIds.length - 1; i++) {
        const fromId = activePointIds[i];
        const toId = activePointIds[i + 1];
        const key = `${fromId}-${toId}`;
        const entry = await db.distances.get(key);

        if (entry) {
          sum += entry.distanceKm;
          steps[key] = entry.distanceKm;
        } else {
          steps[key] = 0;
        }
      }

      setTotalDistance(Math.round(sum * 10) / 10);
      setStepDistances(steps);
    };

    calcDistance();
  }, [activePointIds, points, viaPoints]);

  // All points belonging to the currently active route
  const activeRoutePoints = useMemo(() => {
    return points.filter(p => activeRouteId === null || p.routeId === activeRouteId);
  }, [points, activeRouteId]);

  // Map active point IDs to point objects
  const activePoints = useMemo(() => {
    return activePointIds
      .map(id => activeRoutePoints.find(p => p.id === id))
      .filter((p): p is Point => !!p);
  }, [activePointIds, activeRoutePoints]);

  // Google Maps navigation segments calculation (max 10 points per segment)
  const gmapsSegments = useMemo(() => {
    if (activePoints.length < 2) return [];
    const segments: Array<{
      segmentIndex: number;
      totalSegments: number;
      points: Point[];
      startPoint: Point;
      endPoint: Point;
      googleMapsUrl: string;
    }> = [];
    const MAX_POINTS_PER_SEGMENT = 10;

    let currentIndex = 0;

    while (currentIndex < activePoints.length - 1) {
      const segmentPoints = activePoints.slice(currentIndex, currentIndex + MAX_POINTS_PER_SEGMENT);
      if (segmentPoints.length < 2) break;

      const origin = segmentPoints[0];
      const destination = segmentPoints[segmentPoints.length - 1];
      const waypoints = segmentPoints.slice(1, segmentPoints.length - 1);

      const originParam = `${origin.lat},${origin.lng}`;
      const destParam = `${destination.lat},${destination.lng}`;

      let url = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&travelmode=driving`;

      if (waypoints.length > 0) {
        const waypointsParam = waypoints.map(p => `${p.lat},${p.lng}`).join('|');
        url += `&waypoints=${encodeURIComponent(waypointsParam)}`;
      }

      segments.push({
        segmentIndex: segments.length + 1,
        totalSegments: 1,
        points: segmentPoints,
        startPoint: origin,
        endPoint: destination,
        googleMapsUrl: url,
      });

      currentIndex += (segmentPoints.length - 1);
    }

    const total = segments.length;
    segments.forEach(s => (s.totalSegments = total));

    return segments;
  }, [activePoints]);

  // Search filter for points list (scoped to active route)
  const filteredPoints = useMemo(() => {
    return activeRoutePoints.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [activeRoutePoints, searchQuery]);

  // Handle map click to fill form coordinates
  const handleMapClick = async (lat: number, lng: number) => {
    setActiveTab('points');
    setFormData(prev => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
      address: 'Pobieranie adresu...'
    }));

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
        headers: { 'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          const nameParts = (data.display_name || '').split(',');
          const shortName = nameParts.length > 0 ? nameParts[0].trim() : `Punkt na mapie`;
          let finalName = shortName;
          if (nameParts.length > 1 && shortName.length < 5) {
            finalName = `${shortName}, ${nameParts[1].trim()}`;
          }

          const formattedAddress = formatOsmAddress(data.address, data.display_name || '');

          setFormData(prev => ({
            ...prev,
            name: finalName,
            address: formattedAddress
          }));
          showStatusMessage('Ustalono adres na podstawie kliknięcia!', 'success');
          return;
        }
      }
    } catch (err) {
      console.error('Reverse geocoding failed:', err);
    }

    setFormData(prev => ({
      ...prev,
      address: `Współrzędne: ${lat.toFixed(6)}, ${lng.toFixed(6)}`
    }));
    showStatusMessage('Uzupełniono współrzędne z mapy!', 'success');
  };

  // Status message helpers
  const showStatusMessage = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccess(msg);
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(msg);
      setSuccess(null);
      setTimeout(() => setError(null), 5000);
    }
  };

  // Save Point handler
  const handleSavePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.lat || !formData.lng) {
      showStatusMessage('Wypełnij wszystkie pola formularza!', 'error');
      return;
    }

    const latVal = parseFloat(formData.lat);
    const lngVal = parseFloat(formData.lng);

    if (isNaN(latVal) || latVal < -90 || latVal > 90 || isNaN(lngVal) || lngVal < -180 || lngVal > 180) {
      showStatusMessage('Wprowadź prawidłowe współrzędne geograficzne!', 'error');
      return;
    }

    setIsUpdatingMatrix(true);
    try {
      let finalAddress = formData.address;
      if (!finalAddress || finalAddress.startsWith('Pobieranie adresu...') || finalAddress.startsWith('Współrzędne:')) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latVal}&lon=${lngVal}&format=json`, {
            headers: { 'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data) {
              finalAddress = formatOsmAddress(data.address, data.display_name || '');
            }
          }
        } catch (err) {
          console.error('Submit reverse-lookup error:', err);
        }
      }

      const targetRouteId = await ensureActiveRouteId();
      const savedAddress = finalAddress || `Szer: ${latVal.toFixed(4)}, Dł: ${lngVal.toFixed(4)}`;
      const maxOrder = points.reduce((max, p) => Math.max(max, p.order ?? 0), 0);

      await db.points.add({
        routeId: targetRouteId,
        name: formData.name.trim(),
        lat: latVal,
        lng: lngVal,
        address: savedAddress,
        order: points.length > 0 ? maxOrder + 1 : 0
      });
      showStatusMessage('Dodano nowy punkt do bazy!', 'success');

      await updateDistanceMatrix();
      setFormData({ id: undefined, name: '', lat: '', lng: '', address: '' });
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd synchronizacji z OSRM.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Start edit point
  const handleStartEdit = (point: Point) => {
    if (point.id === undefined) return;
    setEditingPoint(point);
    setEditFormData({
      name: point.name,
      lat: point.lat.toString(),
      lng: point.lng.toString(),
      address: point.address || '',
      routeId: point.routeId
    });
    setEditAddressQuery('');
    setEditGeocodingResults([]);
    setIsRouteSelectOpen(false);
  };

  // Confirm delete point
  const handleConfirmDeletePoint = async () => {
    if (!deletingPoint || deletingPoint.id === undefined) return;
    setIsUpdatingMatrix(true);
    try {
      await db.points.delete(deletingPoint.id);
      setActivePointIds(prev => prev.filter(pId => pId !== deletingPoint.id));
      await updateDistanceMatrix();
      showStatusMessage('Usunięto punkt i zaktualizowano macierz.', 'success');
      setDeletingPoint(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas usuwania punktu.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Toggle active selection
  const handleToggleActive = (id: number) => {
    setActivePointIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  // Move item up / down helpers
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    if (isHasReturnLeg && (index === 1 || index === activePointIds.length - 1)) return;

    setActivePointIds(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === activePointIds.length - 1) return;
    if (isHasReturnLeg && (index === 0 || index === activePointIds.length - 2)) return;

    setActivePointIds(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
      return updated;
    });
  };

  // Move saved points up / down helpers in IndexedDB
  const handleMoveSavedPointUp = async (index: number) => {
    if (index <= 0) return;
    const currentPoint = filteredPoints[index];
    const prevPoint = filteredPoints[index - 1];
    if (!currentPoint?.id || !prevPoint?.id) return;

    const currentIdxInFull = points.findIndex(p => p.id === currentPoint.id);
    const prevIdxInFull = points.findIndex(p => p.id === prevPoint.id);

    if (currentIdxInFull === -1 || prevIdxInFull === -1) return;

    const updatedPoints = [...points];
    const temp = updatedPoints[currentIdxInFull];
    updatedPoints[currentIdxInFull] = updatedPoints[prevIdxInFull];
    updatedPoints[prevIdxInFull] = temp;

    await db.transaction('rw', db.points, async () => {
      for (let i = 0; i < updatedPoints.length; i++) {
        const p = updatedPoints[i];
        if (p.id !== undefined && p.order !== i) {
          await db.points.update(p.id, { order: i });
        }
      }
    });
  };

  const handleMoveSavedPointDown = async (index: number) => {
    if (index >= filteredPoints.length - 1) return;
    const currentPoint = filteredPoints[index];
    const nextPoint = filteredPoints[index + 1];
    if (!currentPoint?.id || !nextPoint?.id) return;

    const currentIdxInFull = points.findIndex(p => p.id === currentPoint.id);
    const nextIdxInFull = points.findIndex(p => p.id === nextPoint.id);

    if (currentIdxInFull === -1 || nextIdxInFull === -1) return;

    const updatedPoints = [...points];
    const temp = updatedPoints[currentIdxInFull];
    updatedPoints[currentIdxInFull] = updatedPoints[nextIdxInFull];
    updatedPoints[nextIdxInFull] = temp;

    await db.transaction('rw', db.points, async () => {
      for (let i = 0; i < updatedPoints.length; i++) {
        const p = updatedPoints[i];
        if (p.id !== undefined && p.order !== i) {
          await db.points.update(p.id, { order: i });
        }
      }
    });
  };

  // Route Folder Management Handlers
  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim()) return;

    try {
      const maxOrder = savedUserRoutes.reduce((max, r) => Math.max(max, r.order ?? 0), 0);
      const newId = await db.routes.add({
        name: newRouteName.trim(),
        createdAt: new Date().toISOString(),
        order: savedUserRoutes.length > 0 ? maxOrder + 1 : 0
      });
      setActiveRouteId(newId);
      setNewRouteName('');
      setIsAddRouteModalOpen(false);
      showStatusMessage(`Utworzono nową trasę: ${newRouteName.trim()}`, 'success');
    } catch (err) {
      console.error('Failed to create route:', err);
      showStatusMessage('Błąd tworzenia trasy.', 'error');
    }
  };

  const handleUpdateRouteName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolderRoute || !editingFolderRoute.id || !editFolderRouteName.trim()) return;

    try {
      await db.routes.update(editingFolderRoute.id, { name: editFolderRouteName.trim() });
      showStatusMessage('Zaktualizowano nazwę trasy!', 'success');
      setEditingFolderRoute(null);
    } catch (err) {
      console.error('Failed to update route name:', err);
      showStatusMessage('Błąd aktualizacji trasy.', 'error');
    }
  };

  const handleDeleteRoute = async () => {
    if (!deletingFolderRoute || !deletingFolderRoute.id) return;

    try {
      const routeIdToDelete = deletingFolderRoute.id;

      // Delete all points belonging to this route
      const pointsToDelete = rawPoints.filter(p => p.routeId === routeIdToDelete);
      for (const p of pointsToDelete) {
        if (p.id !== undefined) {
          await db.points.delete(p.id);
          setActivePointIds(prev => prev.filter(id => id !== p.id));
        }
      }

      await db.routes.delete(routeIdToDelete);
      setDeletingFolderRoute(null);

      // Re-assign active route if current active route was deleted
      const remaining = savedUserRoutes.filter(r => r.id !== routeIdToDelete);
      if (remaining.length > 0) {
        setActiveRouteId(remaining[0].id ?? null);
      } else {
        const newDefaultId = await db.routes.add({
          name: 'Główna Trasa',
          createdAt: new Date().toISOString(),
          order: 0
        });
        setActiveRouteId(newDefaultId);
      }

      await updateDistanceMatrix();
      showStatusMessage('Usunięto trasę wraz z przypisanymi punktami.', 'success');
    } catch (err) {
      console.error('Failed to delete route:', err);
      showStatusMessage('Błąd usuwania trasy.', 'error');
    }
  };

  // Live-swapping Pointer Drag and Drop for active route plan
  const handlePointerDownDrag = (e: React.PointerEvent, index: number) => {
    if (e.button !== 0) return;
    if (isHasReturnLeg && (index === 0 || index === activePointIds.length - 1)) return;
    setActiveDragIndex(index);
  };

  const handlePointerEnterHover = (hoverIndex: number) => {
    if (activeDragIndex === null || activeDragIndex === hoverIndex) return;
    if (isHasReturnLeg && (hoverIndex === 0 || hoverIndex === activePointIds.length - 1)) return;
    if (isHasReturnLeg && (activeDragIndex === 0 || activeDragIndex === activePointIds.length - 1)) return;

    setActivePointIds(prev => {
      if (activeDragIndex < 0 || activeDragIndex >= prev.length || hoverIndex < 0 || hoverIndex >= prev.length) return prev;

      const updated = [...prev];
      const [moved] = updated.splice(activeDragIndex, 1);
      updated.splice(hoverIndex, 0, moved);
      return updated;
    });

    setActiveDragIndex(hoverIndex);
  };

  // Live-swapping Pointer Drag and Drop for saved points list in database
  const handlePointerDownSavedDrag = (e: React.PointerEvent, id: number) => {
    if (e.button !== 0) return;
    setActiveSavedDragId(id);
  };

  const handlePointerEnterSavedHover = async (hoverId: number) => {
    if (activeSavedDragId === null || activeSavedDragId === hoverId) return;

    const fromPoint = points.find(p => p.id === activeSavedDragId);
    const toPoint = points.find(p => p.id === hoverId);
    if (!fromPoint?.id || !toPoint?.id) return;

    const fromIdxInFull = points.findIndex(p => p.id === fromPoint.id);
    const toIdxInFull = points.findIndex(p => p.id === toPoint.id);
    if (fromIdxInFull === -1 || toIdxInFull === -1 || fromIdxInFull === toIdxInFull) return;

    const updatedPoints = [...points];
    const [moved] = updatedPoints.splice(fromIdxInFull, 1);
    updatedPoints.splice(toIdxInFull, 0, moved);

    await db.transaction('rw', db.points, async () => {
      for (let i = 0; i < updatedPoints.length; i++) {
        const p = updatedPoints[i];
        if (p.id !== undefined && p.order !== i) {
          await db.points.update(p.id, { order: i });
        }
      }
    });
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      setActiveDragIndex(null);
      setActiveSavedDragId(null);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, []);

  // Save Route to History (as new)
  const handleSaveRoute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (activePointIds.length < 2) {
      showStatusMessage('Trasa musi mieć co najmniej 2 punkty!', 'error');
      return;
    }
    if (!routeName.trim()) {
      showStatusMessage('Podaj nazwę dla zapisywanej trasy!', 'error');
      return;
    }

    try {
      const newId = await db.routes_history.add({
        routeName: routeName.trim(),
        date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
        pointsOrder: [...activePointIds],
        totalDistance,
        viaPoints: viaPoints.length > 0 ? [...viaPoints] : undefined
      });
      setLoadedRouteId(newId as number);
      showStatusMessage('Zapisano trasę jako nową w historii!', 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Nie udało się zapisać trasy do bazy.', 'error');
    }
  };

  // Update existing loaded route in History
  const handleUpdateLoadedRoute = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!loadedRouteId) return;
    if (activePointIds.length < 2) {
      showStatusMessage('Trasa musi mieć co najmniej 2 punkty!', 'error');
      return;
    }
    if (!routeName.trim()) {
      showStatusMessage('Podaj nazwę dla trasy!', 'error');
      return;
    }

    try {
      await db.routes_history.update(loadedRouteId, {
        routeName: routeName.trim(),
        date: new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' }),
        pointsOrder: [...activePointIds],
        totalDistance,
        viaPoints: viaPoints.length > 0 ? [...viaPoints] : undefined
      });
      showStatusMessage(`Zaktualizowano trasę "${routeName.trim()}" w historii!`, 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Wystąpił błąd podczas aktualizowania trasy w bazy.', 'error');
    }
  };

  // Load past route
  const handleLoadRoute = (route: RouteHistory) => {
    if (route.id === undefined) return;
    const validIds = route.pointsOrder.filter(id => points.some(p => p.id === id));
    const loadedActivePoints = validIds.map(id => points.find(p => p.id === id)).filter((p): p is Point => !!p);
    setActivePointIds(validIds);
    setRouteName(route.routeName);
    setLoadedRouteId(route.id);
    setViaPoints(normalizeViaPoints(route.viaPoints, loadedActivePoints));
    setActiveTab('route');
    showStatusMessage(`Wczytano trasę: ${route.routeName}${route.viaPoints && route.viaPoints.length > 0 ? ' (z korektami)' : ''}`, 'success');
  };


  // Edit route in history
  const handleStartEditRoute = (route: RouteHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    if (route.id === undefined) return;
    setEditingRoute(route);
    setEditRouteName(route.routeName);
    setUpdatePointsWithActive(false);
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute || editingRoute.id === undefined) return;
    if (!editRouteName.trim()) {
      showStatusMessage('Nazwa trasy nie może być pusta!', 'error');
      return;
    }

    try {
      const updateData: Partial<RouteHistory> = {
        routeName: editRouteName.trim()
      };

      if (updatePointsWithActive) {
        if (activePointIds.length < 2) {
          showStatusMessage('Zaznacz przynajmniej 2 punkty na mapie!', 'error');
          return;
        }
        updateData.pointsOrder = [...activePointIds];
        updateData.totalDistance = totalDistance;
      }

      await db.routes_history.update(editingRoute.id, updateData);
      showStatusMessage('Zaktualizowano trasę w historii!', 'success');

      if (loadedRouteId === editingRoute.id) {
        setRouteName(editRouteName.trim());
      }

      setEditingRoute(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas aktualizacji trasy.', 'error');
    }
  };

  // Delete route from history
  const handleConfirmDeleteRoute = async () => {
    if (!deletingRoute || deletingRoute.id === undefined) return;
    try {
      await db.routes_history.delete(deletingRoute.id);
      showStatusMessage('Usunięto trasę z historii.', 'success');
      if (loadedRouteId === deletingRoute.id) {
        handleClearActiveRoute();
      }
      setDeletingRoute(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Wystąpił błąd podczas usuwania trasy.', 'error');
    }
  };

  // Force rebuild of distances table manually
  const handleForceRebuild = async () => {
    setIsUpdatingMatrix(true);
    setError(null);
    try {
      await updateDistanceMatrix();
      showStatusMessage('Pomyślnie przebudowano macierz odległości!', 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd pobierania macierzy z OSRM.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-200 select-none">

      {/* 1. HEADER / TOOLBAR */}
      <header
        className="h-11 bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-3.5 text-sm select-none z-50 flex-shrink-0"
      >
        {/* Left App Brand */}
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-500 text-white p-1.5 rounded-lg shadow-sm shadow-emerald-500/20">
            <Route className="w-4 h-4" />
          </div>
          <span className="font-extrabold tracking-tight text-sm text-zinc-900 dark:text-zinc-100">
            GigaSigmaRoute
          </span>
          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            v1.0 Desktop
          </span>
        </div>

        {/* Center Title */}
        <div className="hidden md:flex items-center gap-2 text-zinc-500 dark:text-zinc-400 font-medium text-xs cursor-default">
          <Compass className="w-4 h-4" />
          <span>Lokalny Optymalizator Tras & Macierz OSRM</span>
        </div>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2">
          {/* OSRM Status */}
          <div className="hidden sm:flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800/80 px-2.5 py-1 rounded-full border border-zinc-200/80 dark:border-zinc-700/80 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>OSRM Engine</span>
          </div>

          {/* Refresh Matrix Button */}
          <button
            onClick={handleForceRebuild}
            disabled={isUpdatingMatrix}
            title="Przebuduj macierz odległości dla wszystkich punktów"
            className="p-1.5 text-zinc-600 hover:text-indigo-500 dark:text-zinc-400 dark:hover:text-indigo-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isUpdatingMatrix ? 'animate-spin' : ''}`} />
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            title="Przełącz motyw Dark/Light"
            className="p-1.5 text-zinc-600 hover:text-emerald-500 dark:text-zinc-400 dark:hover:text-emerald-400 bg-zinc-100 dark:bg-zinc-800 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 border border-zinc-200 dark:border-zinc-700 transition cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

        </div>
      </header>

      {/* Floating Toast Notification Container (Bottom-Right Pop-Over) */}
      <div className="fixed bottom-10 right-4 z-[9999] flex flex-col gap-2.5 pointer-events-none">
        {error && (
          <div className="pointer-events-auto flex items-center gap-3 px-4.5 py-3.5 bg-white dark:bg-zinc-900 border border-rose-200 dark:border-rose-900/60 shadow-2xl rounded-2xl text-sm font-bold text-rose-600 dark:text-rose-400 animate-slide-in max-w-md">
            <Info className="w-5 h-5 flex-shrink-0 text-rose-500" />
            <span className="pr-2 leading-snug">{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {success && (
          <div className="pointer-events-auto flex items-center gap-3 px-4.5 py-3.5 bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-900/60 shadow-2xl rounded-2xl text-sm font-bold text-emerald-600 dark:text-emerald-400 animate-slide-in max-w-md">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-500" />
            <span className="pr-2 leading-snug">{success}</span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* 2. MAIN DESKTOP WORKBENCH (Sidebar + Map Viewport) */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* LEFT DESKTOP SIDEBAR PANEL */}
        <aside className="w-[520px] bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden flex-shrink-0 z-10 shadow-lg">

          {/* SIDEBAR TABS NAV HEADER */}
          <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 bg-zinc-50/70 dark:bg-zinc-950/40 text-sm font-bold gap-1.5 flex-shrink-0">
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'points'
                ? 'bg-white dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
            >
              <MapIcon className="w-4 h-4" />
              <span>Stacje</span>
              <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                {points.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('route')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'route'
                ? 'bg-white dark:bg-zinc-850 text-emerald-600 dark:text-emerald-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
            >
              <Route className="w-4 h-4" />
              <span>Plan Trasy</span>
              {activePointIds.length > 0 && (
                <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">
                  {activePointIds.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${activeTab === 'history'
                ? 'bg-white dark:bg-zinc-850 text-amber-600 dark:text-amber-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
                }`}
            >
              <History className="w-4 h-4" />
              <span>Historia</span>
              <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-2 py-0.5 rounded-full font-bold">
                {savedRoutes.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              title="Ustawienia i kopia zapasowa bazy (.json)"
              className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer flex-shrink-0 ${activeTab === 'backup'
                ? 'bg-white dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* SIDEBAR SCROLLABLE CONTENT BODY */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">

            {/* TAB 1: POINTS & LOCATION ADDER */}
            {activeTab === 'points' && (
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
                      <span className="col-span-2 text-xs text-zinc-400 italic py-1">Brak zapisanych tras. Kliknij &quot;Dodaj trasę&quot;.</span>
                    ) : (
                      savedUserRoutes.map(route => {
                        if (!route.id) return null;
                        const isActive = activeRouteId === route.id;
                        const pointCount = rawPoints.filter(p => p.routeId === route.id).length;

                        return (
                          <div
                            key={route.id}
                            onClick={() => setActiveRouteId(route.id!)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium cursor-pointer transition group min-w-0 ${isActive
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-sm'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-emerald-500/50'
                              }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0 pr-1">
                              <span className="font-bold truncate" title={route.name}>{route.name}</span>
                              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold flex-shrink-0 ${isActive ? 'bg-white/20 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}>
                                {pointCount} {pointCount === 1 ? 'pkt' : 'pkt'}
                              </span>
                            </div>

                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" onClick={e => e.stopPropagation()}>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingFolderRoute(route);
                                  setEditFolderRouteName(route.name);
                                }}
                                title="Zmień nazwę"
                                className={`p-1 rounded transition ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400'}`}
                              >
                                <Edit3 className="w-3 h-3" />
                              </button>
                              {savedUserRoutes.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => setDeletingFolderRoute(route)}
                                  title="Usuń trasę"
                                  className={`p-1 rounded transition ${isActive ? 'hover:bg-white/20 text-white' : 'hover:bg-rose-500/10 text-rose-500'}`}
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
                    <span className="text-xs text-zinc-400">
                      Kliknij punkt aby dodać do trasy
                    </span>
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
                            className={`flex items-center justify-between p-3 rounded-xl border transition-all duration-150 ease-out cursor-pointer group select-none ${isBeingDragged
                              ? 'relative z-20 ring-2 ring-emerald-500/90 shadow-lg bg-emerald-500/10 dark:bg-emerald-950/50'
                              : isChecked
                                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
                                : 'bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800'
                              }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {/* Drag Handle */}
                              <div
                                onPointerDown={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handlePointerDownSavedDrag(e, point.id!);
                                }}
                                title="Przytrzymaj i przeciągnij myszą w górę/dół"
                                className="p-1 text-zinc-400 hover:text-emerald-500 cursor-grab active:cursor-grabbing touch-none select-none transition-colors"
                              >
                                <GripVertical className="w-4 h-4 flex-shrink-0" />
                              </div>

                              <div className={`transition-colors ${isChecked ? 'text-emerald-500' : 'text-zinc-300 dark:text-zinc-700'}`}>
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
            )}

            {/* TAB 2: ROUTE PLANNER ORDER */}
            {activeTab === 'route' && (
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
                    <p>Przejdź do zakładki &quot;Baza Punktów&quot; i zaznacz lokalizacje.</p>
                    <button
                      onClick={() => setActiveTab('points')}
                      className="mt-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-500 transition"
                    >
                      Otwórz Bazę Punktów
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
                          className={`text-[11px] font-bold h-7 w-[88px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer flex-shrink-0 ${isHasReturnLeg
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
                          title="Włącz lub wyłącz tryb edycji/korekty trasy na mapie"
                          className={`text-[11px] font-bold h-7 w-[92px] rounded-lg transition flex items-center justify-center gap-1 cursor-pointer flex-shrink-0 ${isRouteEditMode
                            ? 'bg-amber-500 text-white shadow-md'
                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
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

                        let nextStepKm: number | undefined = undefined;
                        if (!isLast) {
                          const nextPointId = activePointIds[index + 1];
                          nextStepKm = stepDistances[`${point.id}-${nextPointId}`];
                        }

                        const isBeingDragged = activeDragIndex === index;

                        return (
                          <div
                            key={`active-${index}-${point.id}`}
                            onPointerEnter={() => handlePointerEnterHover(index)}
                            className={`space-y-1 transition-all duration-150 ease-out rounded-xl select-none ${isBeingDragged
                              ? 'relative z-20 ring-2 ring-emerald-500/90 shadow-lg bg-emerald-500/10 dark:bg-emerald-950/50'
                              : ''
                              }`}
                          >
                            <div className={`flex items-center justify-between border rounded-xl p-2.5 transition-colors ${isReturnStop
                              ? 'bg-emerald-500/10 border-emerald-500/40 dark:bg-emerald-950/30'
                              : isBeingDragged
                                ? 'bg-emerald-500/15 border-emerald-500 dark:border-emerald-500/80'
                                : 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40'
                              }`}>
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {/* Drag Handle */}
                                <div
                                  onPointerDown={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    if (!isLockedInLoop) {
                                      handlePointerDownDrag(e, index);
                                    }
                                  }}
                                  title={isLockedInLoop ? "Przystanek zablokowany w trybie pętli" : "Przytrzymaj i przeciągnij myszą w górę/dół"}
                                  className={`p-1 select-none transition-colors ${isLockedInLoop
                                    ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed opacity-40'
                                    : 'text-zinc-400 hover:text-emerald-500 cursor-grab active:cursor-grabbing touch-none'
                                    }`}
                                >
                                  <GripVertical className="w-4 h-4 flex-shrink-0" />
                                </div>

                                <span className={`w-5 h-5 rounded-full text-white text-xs font-black flex items-center justify-center flex-shrink-0 transition-colors ${isReturnStop ? 'bg-emerald-600 ring-2 ring-emerald-400/40' : isBeingDragged ? 'bg-emerald-600' : 'bg-emerald-500'
                                  }`}>
                                  {index + 1}
                                </span>
                                <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100 truncate">
                                  {point.name}
                                </span>
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
                                  title={isMoveUpDisabled ? "Przesuwanie w górę zablokowane" : "Przesuń wyżej"}
                                  className="p-1 text-zinc-400 hover:text-emerald-500 disabled:opacity-20 disabled:cursor-not-allowed rounded transition cursor-pointer"
                                >
                                  <ArrowUp className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleMoveDown(index)}
                                  disabled={isMoveDownDisabled}
                                  title={isMoveDownDisabled ? "Przesuwanie w dół zablokowane" : "Przesuń niżej"}
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
                              <div className="flex items-center justify-between pl-7 pr-1 h-7 my-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                <div className="flex items-center">
                                  <div className="w-0.5 h-4 bg-zinc-300 dark:bg-zinc-700 mr-2"></div>
                                  <ChevronRight className="w-3.5 h-3.5 mr-0.5 flex-shrink-0" />
                                  {nextStepKm !== undefined ? (
                                    <span>+ {nextStepKm.toFixed(1)} km (odcinek)</span>
                                  ) : (
                                    <span className="text-zinc-400 text-[11px]">Odcinek {index + 1}</span>
                                  )}
                                </div>
                                {viaPoints.filter(v => v.segmentIndex === index).length > 0 ? (
                                  <span
                                    title={`Dodano ${viaPoints.filter(v => v.segmentIndex === index).length} waypoint(y) na tym odcinku`}
                                    className="text-[10px] leading-tight bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1 select-none flex-shrink-0"
                                  >
                                    <span>📍</span>
                                    <span>
                                      {viaPoints.filter(v => v.segmentIndex === index).length}{' '}
                                      {viaPoints.filter(v => v.segmentIndex === index).length === 1
                                        ? 'waypoint'
                                        : viaPoints.filter(v => v.segmentIndex === index).length < 5
                                          ? 'waypointy'
                                          : 'waypointów'}
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
                      <form onSubmit={loadedRouteId ? handleUpdateLoadedRoute : handleSaveRoute} className="pt-3 space-y-2 border-t border-zinc-200 dark:border-zinc-800">
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
                          <input
                            type="text"
                            required
                            placeholder="Nazwa trasy (np. Poniedziałek Północ)..."
                            value={routeName}
                            onChange={e => setRouteName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 transition select-text font-medium"
                          />

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
            )}

            {/* TAB 3: ROUTE HISTORY */}
            {activeTab === 'history' && (
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
                      return (
                        <div
                          key={route.id}
                          onClick={() => handleLoadRoute(route)}
                          className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-950/40 dark:hover:bg-zinc-850 transition cursor-pointer group flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0 text-left flex-1">
                            <p className="text-sm font-extrabold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-500 transition-colors truncate">
                              {route.routeName}
                            </p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium flex items-center gap-2">
                              <span>{route.date}</span>
                              <span>•</span>
                              <span>{route.pointsOrder.length} punktów w trasie</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-3 py-1 rounded-lg border border-emerald-500/20">
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
            )}

            {/* TAB 4: BACKUP & RESTORE */}
            {activeTab === 'backup' && (
              <div className="space-y-4 animate-fade-in">
                <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block px-1">
                  Kopia Zapasowa i Przywracanie Bazy (JSON)
                </span>

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
                        Zapisz plik kopii ze wszystkimi punktami ({points.length}), grupami tras ({savedUserRoutes.length}) oraz historią tras ({savedRoutes.length}) na swój komputer.
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
                        Wczytaj wcześniej pobrany plik .json, aby przywrócić zapamiętane punkty i trasy (z możliwością scalenia lub zastąpienia).
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
            )}
          </div>
        </aside>

        {/* RIGHT MAIN MAP VIEWPORT */}
        <main className="flex-1 h-full relative overflow-hidden bg-zinc-100 dark:bg-zinc-950">

          {/* FLOATING TELEMETRY HUD OVERLAY (Desktop HUD) */}
          <div className="absolute top-4 right-4 z-[400] flex flex-col gap-3 pointer-events-none">

            {/* Total Distance Telemetry Badge */}
            <div className="pointer-events-auto bg-zinc-900 text-white px-4 py-3 rounded-2xl border border-zinc-700/60 shadow-2xl flex items-center justify-between gap-6 min-w-[280px]">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-emerald-400 tracking-wider">
                  Dystans Dzisiejszego Planu
                </span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-2xl font-extrabold tabular-nums tracking-tight">{totalDistance}</span>
                  <span className="text-xs font-bold text-zinc-400">km</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-extrabold uppercase text-zinc-400 tracking-wider">
                  Liczba Stopów
                </span>
                <p className="text-lg font-black text-white mt-0.5">
                  {activePointIds.length} <span className="text-xs font-normal text-zinc-400">lokalizacji</span>
                </p>
              </div>
            </div>

            {/* Quick Actions Bar */}
            {activePointIds.length > 0 && (
              <div className="pointer-events-auto flex items-center justify-end gap-2">
                <button
                  onClick={handleClearActiveRoute}
                  className="px-3 py-1.5 bg-white dark:bg-zinc-900 hover:bg-rose-500 hover:text-white border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-bold shadow-md text-rose-600 dark:text-rose-400 transition cursor-pointer flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Wyczyść Trasę</span>
                </button>

                <button
                  onClick={() => setActiveTab('route')}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1"
                >
                  <Route className="w-3.5 h-3.5" />
                  <span>Zarządzaj Kolejnością</span>
                </button>
              </div>
            )}
          </div>

          {/* Leaflet Interactive Map Component */}
          {(() => {
            const isModalOpen = Boolean(
              editingPoint ||
              deletingPoint ||
              isAddRouteModalOpen ||
              editingFolderRoute ||
              deletingFolderRoute ||
              editingRoute ||
              deletingRoute ||
              isImportModalOpen ||
              isGmapsExportModalOpen
            );
            return (
              <MapComponent
                points={activeRoutePoints}
                activePoints={activePoints}
                routeCoordinates={routeCoordinates}
                onMapClick={handleMapClick}
                isMapMaximized={isMapMaximized}
                isDragging={activeDragIndex !== null}
                isRouteEditMode={isRouteEditMode}
                onToggleRouteEditMode={handleToggleRouteEditMode}
                viaPoints={viaPoints}
                onAddViaPoint={handleAddViaPoint}
                onUpdateViaPoint={handleUpdateViaPoint}
                onRemoveViaPoint={handleRemoveViaPoint}
                onClearViaPoints={handleClearViaPoints}
                isModalOpen={isModalOpen}
              />
            );
          })()}
        </main>
      </div>

      {/* 3. BOTTOM DESKTOP STATUS BAR */}
      <footer className="h-7 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 px-4 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400 select-none flex-shrink-0 z-40">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></span>
            <span>OSRM Engine Online</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Database className="w-3 h-3 text-indigo-500" />
            <span>IndexedDB Ready</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 text-zinc-400">
          <span>Skróty:</span>
          <kbd className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-800 rounded text-[10px] font-mono">Ctrl+F</kbd> Szukaj |
          <kbd className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-800 rounded text-[10px] font-mono">Ctrl+A</kbd> Zaznacz wszystkie |
          <kbd className="px-1.5 py-0.2 bg-zinc-200 dark:bg-zinc-800 rounded text-[10px] font-mono">Esc</kbd> Zamknij / Wyczyść plan
        </div>

        <div>
          <span>Baza: <strong className="text-zinc-800 dark:text-zinc-200">{points.length}</strong> punktów | Trasa: <strong className="text-emerald-500">{totalDistance} km</strong></span>
        </div>
      </footer>

      {/* EDIT POINT MODAL */}
      {editingPoint && (
        <div
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setEditingPoint(null))}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in text-zinc-950 dark:text-zinc-50 cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-lg space-y-4 animate-scale-up text-left cursor-default"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3.5">
              <h3 className="text-lg font-extrabold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
                <Edit3 className="w-5 h-5 text-indigo-500" />
                Edycja Lokalizacji
              </h3>
              <button
                type="button"
                onClick={() => setEditingPoint(null)}
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
                    <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isRouteSelectOpen ? 'rotate-180 text-emerald-500' : ''}`} />
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
                              className={`w-full text-left px-3 py-2.5 rounded-lg text-xs font-medium transition flex items-center justify-between gap-2 cursor-pointer ${isSelected
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/30'
                                : 'hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 pr-1">
                                <Route className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-emerald-500' : 'text-zinc-400'}`} />
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
                  onClick={() => setEditingPoint(null)}
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
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deletingPoint && (
        <div
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setDeletingPoint(null))}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-scale-up text-left cursor-default"
          >
            <h3 className="text-lg font-extrabold text-rose-600 dark:text-rose-400 flex items-center gap-2.5">
              <Trash2 className="w-6 h-6 text-rose-500" />
              Usuń Lokalizację
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium leading-relaxed">
              Czy na pewno chcesz usunąć punkt <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{deletingPoint.name}</strong> z bazy danych?
            </p>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingPoint(null)}
                className="flex-1 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition cursor-pointer"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePoint}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-bold hover:bg-rose-500 transition cursor-pointer"
              >
                Usuń Punkt
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE FOLDER ROUTE MODAL */}
      {isAddRouteModalOpen && (
        <div
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setIsAddRouteModalOpen(false))}
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
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setEditingFolderRoute(null))}
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
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setDeletingFolderRoute(null))}
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
              Czy na pewno chcesz usunąć trasę <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{deletingFolderRoute.name}</strong> oraz przypisane do niej punkty?
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

      {/* EDIT ROUTE MODAL */}
      {editingRoute && (
        <div
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setEditingRoute(null))}
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
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setDeletingRoute(null))}
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
              Czy na pewno chcesz usunąć trasę <strong className="text-zinc-900 dark:text-zinc-100 font-bold">{deletingRoute.routeName}</strong>?
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

      {/* IMPORT BACKUP MODAL */}
      {isImportModalOpen && importBackupData && (
        <div
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => {
            setIsImportModalOpen(false);
            setImportBackupData(null);
          })}
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
                onClick={() => handleConfirmImport('merge')}
                className="w-full py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Scal z obecną bazą (Dopisz dane)</span>
              </button>

              <button
                type="button"
                onClick={() => handleConfirmImport('overwrite')}
                className="w-full py-2.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Zastąp całą bazę (Nadpisz obecne dane)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsImportModalOpen(false);
                  setImportBackupData(null);
                }}
                className="w-full py-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 text-xs font-bold transition cursor-pointer"
              >
                Anuluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GOOGLE MAPS & QR CODES EXPORT MODAL */}
      {isGmapsExportModalOpen && (
        <div
          onMouseDown={handleBackdropMouseDown}
          onClick={e => handleBackdropClick(e, () => setIsGmapsExportModalOpen(false))}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-zinc-950/75 animate-fade-in cursor-pointer"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] flex flex-col space-y-4 animate-scale-up text-left cursor-default overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-2xl">
                  <QrCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <span>Nawigacja Google Maps & Kody QR</span>
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    Trasa liczy {activePointIds.length} punktów • Podzielona na {gmapsSegments.length} {gmapsSegments.length === 1 ? 'segment' : 'segmenty'} (max 10 pkt/segment)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGmapsExportModalOpen(false)}
                className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body: Responsive Grid of Segments */}
            <div className="flex-1 overflow-y-auto pr-1">
              <div className={`grid gap-4 ${gmapsSegments.length === 1 ? 'grid-cols-1 max-w-md mx-auto' : 'grid-cols-1 md:grid-cols-2'}`}>
                {gmapsSegments.map((segment) => {
                  const isCopied = copiedSegmentIndex === segment.segmentIndex;
                  return (
                    <div
                      key={`gmaps-seg-${segment.segmentIndex}`}
                      className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-950/50 flex flex-col justify-between space-y-4 hover:border-blue-500/50 transition shadow-sm"
                    >
                      <div className="space-y-2">
                        {/* Segment Header Badge */}
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-1 bg-blue-600 text-white rounded-lg text-xs font-black">
                            Segment #{segment.segmentIndex} z {segment.totalSegments}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-500">
                            {segment.points.length} punktów
                          </span>
                        </div>

                        {/* Segment Start -> End Description */}
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 pt-1 truncate">
                          <span className="text-emerald-600 dark:text-emerald-400 truncate">{segment.startPoint.name}</span>
                          <ChevronRight className="w-4 h-4 flex-shrink-0 text-zinc-400" />
                          <span className="text-blue-600 dark:text-blue-400 truncate">{segment.endPoint.name}</span>
                        </div>
                      </div>

                      {/* QR Code Display Container */}
                      <div className="p-3 bg-white rounded-2xl border border-zinc-200 dark:border-zinc-700/60 shadow-inner flex flex-col items-center justify-center gap-2 self-center">
                        <QRCodeSVG
                          value={segment.googleMapsUrl}
                          size={150}
                          level="M"
                          includeMargin={false}
                        />
                        <span className="text-[10px] font-bold text-zinc-400">Zeskanuj aparatem telefonu</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="space-y-2 pt-1">
                        <button
                          type="button"
                          onClick={(e) => handleOpenExternalUrl(segment.googleMapsUrl, e)}
                          className="w-full py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                        >
                          <ExternalLink className="w-4 h-4" />
                          <span>Otwórz w Google Maps</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopySegmentLink(segment.googleMapsUrl, segment.segmentIndex)}
                          className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${isCopied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700'
                            }`}
                        >
                          {isCopied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-white" />
                              <span>Skopiowano link!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Kopiuj link do segmentu</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
