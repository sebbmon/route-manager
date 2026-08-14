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
  DatabaseBackupData,
} from '@/db/database';
import {
  Route,
  History,
  Map as MapIcon,
  Loader2,
  X,
  Database,
  Settings,
} from 'lucide-react';

import HeaderBar from '@/components/HeaderBar';
import ToastContainer, { ToastItem } from '@/components/ToastContainer';
import PointsTab, { PointFormData } from '@/components/PointsTab';
import RoutePlanTab from '@/components/RoutePlanTab';
import HistoryTab from '@/components/HistoryTab';
import BackupTab from '@/components/BackupTab';
import EditPointModal, { EditPointFormData } from '@/components/EditPointModal';
import DeletePointModal from '@/components/DeletePointModal';
import RouteFolderModals from '@/components/RouteFolderModals';
import HistoryRouteModals from '@/components/HistoryRouteModals';
import ImportBackupModal from '@/components/ImportBackupModal';
import GmapsExportModal, { GmapsSegment } from '@/components/GmapsExportModal';

// Dynamic import of MapComponent with SSR disabled to prevent Leaflet errors
const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-zinc-100 dark:bg-zinc-900 animate-pulse flex flex-col items-center justify-center text-zinc-500 gap-3 border border-zinc-200 dark:border-zinc-800">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      <span className="text-sm font-medium">Inicjalizacja silnika mapy Leaflet...</span>
    </div>
  ),
});

// Helper to format Photon address properties into "ulica numer, miejscowość, kod pocztowy"
const formatPhotonAddress = (properties: any): string => {
  if (!properties) return '';
  const street = properties.street;
  const houseNumber = properties.housenumber;
  const town =
    properties.city ||
    properties.city_district ||
    properties.town ||
    properties.village ||
    properties.municipality ||
    properties.hamlet;
  const postcode = properties.postcode;

  const parts: string[] = [];
  if (street) {
    if (houseNumber) {
      parts.push(`${street} ${houseNumber}`);
    } else {
      parts.push(street);
    }
  } else if (houseNumber) {
    parts.push(houseNumber);
  }
  if (town) parts.push(town);
  if (postcode) parts.push(postcode);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return properties.name || '';
};

// Helper to format Nominatim address object as "ulica numer, miejscowość, kod pocztowy"
const formatOsmAddress = (addressObj: any, defaultDisplay: string): string => {
  if (!addressObj) return defaultDisplay;

  const street = addressObj.road || addressObj.pedestrian || addressObj.street || addressObj.suburb;
  const houseNumber = addressObj.house_number || addressObj.building;
  const town =
    addressObj.city || addressObj.town || addressObj.village || addressObj.municipality || addressObj.hamlet;
  const postcode = addressObj.postcode;

  const parts: string[] = [];
  if (street) {
    if (houseNumber) {
      parts.push(`${street} ${houseNumber}`);
    } else {
      parts.push(street);
    }
  } else if (houseNumber) {
    parts.push(houseNumber);
  }
  if (town) parts.push(town);
  if (postcode) parts.push(postcode);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return defaultDisplay;
};

// Resilient reverse geocoding helper (Primary: Photon, Fallback: Nominatim)
const reverseGeocode = async (lat: number, lng: number): Promise<{ address: string; name: string } | null> => {
  // 1. Try Photon first (without invalid lang param)
  try {
    const res = await fetch(`https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const feat = data.features[0];
        const p = feat.properties || {};
        const formatted = formatPhotonAddress(p);
        const streetPart = p.street ? (p.housenumber ? `${p.street} ${p.housenumber}` : p.street) : '';
        const shortName = streetPart || p.name || (p.city || p.town ? p.city || p.town : formatted) || 'Punkt na mapie';
        return {
          address: formatted || shortName,
          name: shortName,
        };
      }
    }
  } catch (err) {
    // Failover to Nominatim
  }

  // 2. Fallback to Nominatim if Photon is unreachable or 503
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`, {
      headers: { 'Accept-Language': 'pl,en-US;q=0.7,en;q=0.3' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        const formatted = formatOsmAddress(data.address, data.display_name || '');
        const street = data.address?.road || data.address?.pedestrian || data.address?.street;
        const houseNr = data.address?.house_number || data.address?.building;
        const streetWithNr = street ? (houseNr ? `${street} ${houseNr}` : street) : '';
        const nameParts = (data.display_name || '').split(',');
        const shortName = streetWithNr || (nameParts.length > 0 ? nameParts[0].trim() : 'Punkt na mapie');
        return {
          address: formatted || shortName,
          name: shortName,
        };
      }
    }
  } catch (err) {
    console.error('Reverse geocoding error:', err);
  }

  return null;
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
  const employeesQuery = useLiveQuery(() => db.employees.toArray());
  const employees = useMemo(() => employeesQuery || [], [employeesQuery]);

  // Employee management state & handlers
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [selectedEmployeeName, setSelectedEmployeeName] = useState<string>('');
  const [isPlanEmployeeSelectOpen, setIsPlanEmployeeSelectOpen] = useState(false);
  const [isEditRouteEmployeeSelectOpen, setIsEditRouteEmployeeSelectOpen] = useState(false);

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmployeeName.trim()) return;
    try {
      await db.employees.add({ name: newEmployeeName.trim() });
      showStatusMessage(`Dodano pracownika: ${newEmployeeName.trim()}`, 'success');
      setNewEmployeeName('');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas dodawania pracownika.', 'error');
    }
  };

  const handleDeleteEmployee = async (id: number | undefined, name: string) => {
    if (id === undefined) return;
    try {
      await db.employees.delete(id);
      if (selectedEmployeeName === name) {
        setSelectedEmployeeName('');
      }
      showStatusMessage(`Usunięto pracownika: ${name}`, 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas usuwania pracownika.', 'error');
    }
  };

  // Google Maps Export Modal state
  const [isGmapsExportModalOpen, setIsGmapsExportModalOpen] = useState(false);
  const [copiedSegmentIndex, setCopiedSegmentIndex] = useState<number | null>(null);

  const handleCopySegmentLink = (url: string, index: number) => {
    navigator.clipboard.writeText(url);
    setCopiedSegmentIndex(index);
    showStatusMessage(`Skopiowano link do segmentu #${index}!`, 'success', 2500);
    setTimeout(() => {
      setCopiedSegmentIndex(null);
    }, 2500);
  };

  const handleOpenExternalUrl = async (url: string, e?: React.SyntheticEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const { open } = await import('@tauri-apps/plugin-shell');
        await open(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Active route folder selector state
  const [activeRouteId, setActiveRouteId] = useState<number | null>(null);

  // Helper to ensure an active route folder exists
  const ensureActiveRouteId = async (): Promise<number> => {
    if (activeRouteId !== null) return activeRouteId;
    const currentRoutes = await db.routes.toArray();
    if (currentRoutes.length > 0 && currentRoutes[0].id !== undefined) {
      setActiveRouteId(currentRoutes[0].id);
      return currentRoutes[0].id;
    }
    const newId = await db.routes.add({
      name: 'Główna Trasa',
      createdAt: new Date().toISOString(),
      order: 0,
    });
    setActiveRouteId(newId);
    return newId;
  };

  // Migration of unassigned points
  useEffect(() => {
    const migrateUnassignedPointsAndCleanup = async () => {
      if (savedUserRoutesQuery === undefined || rawPointsQuery === undefined) return;

      const unassignedPoints = rawPointsQuery.filter(p => p.routeId === undefined || p.routeId === null);
      if (unassignedPoints.length > 0) {
        let targetRouteId: number;
        if (savedUserRoutesQuery.length > 0 && savedUserRoutesQuery[0].id !== undefined) {
          targetRouteId = savedUserRoutesQuery[0].id;
        } else {
          targetRouteId = await db.routes.add({
            name: 'Główna Trasa',
            createdAt: new Date().toISOString(),
            order: 0,
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

  // Reverse-geocode legacy points that don't have an address stored in IndexedDB
  useEffect(() => {
    const updateLegacyPoints = async () => {
      const legacyPoints = points.filter(p => !p.address);
      if (legacyPoints.length === 0) return;

      for (const point of legacyPoints) {
        if (point.id === undefined) continue;
        try {
          await new Promise(resolve => setTimeout(resolve, 200));
          const result = await reverseGeocode(point.lat, point.lng);
          if (result && result.address) {
            await db.points.update(point.id, {
              address: result.address,
              ...(point.name.startsWith('Punkt (') ? { name: result.name || result.address } : {}),
            });
          }
        } catch (e) {
          console.warn('Could not auto-fetch address for legacy point:', point.id);
        }
      }
    };

    if (points.length > 0) {
      updateLegacyPoints();
    }
  }, [points]);

  // Local state
  const [activePointIds, setActivePointIds] = useState<number[]>([]);
  const [formData, setFormData] = useState<PointFormData>({ name: '', lat: '', lng: '', address: '' });
  const [routeName, setRouteName] = useState('');
  const [isUpdatingMatrix, setIsUpdatingMatrix] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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

  const isSkipRouteResetRef = useRef(false);
  const isSkipViaPointResetRef = useRef(false);
  const prevActiveRouteIdRef = useRef<number | null>(activeRouteId);
  const mapClickGeocodeSeqRef = useRef<number>(0);

  // Automatically reset planning state when user switches the active route folder manually
  useEffect(() => {
    if (prevActiveRouteIdRef.current !== null && prevActiveRouteIdRef.current !== activeRouteId) {
      if (isSkipRouteResetRef.current) {
        isSkipRouteResetRef.current = false;
      } else {
        setActivePointIds([]);
        setRouteName('');
        setSelectedEmployeeName('');
        setLoadedRouteId(null);
        setRouteCoordinates([]);
        setTotalDistance(0);
        setStepDistances({});
        setViaPoints([]);
        setIsRouteEditMode(false);
      }
    }
    prevActiveRouteIdRef.current = activeRouteId;
  }, [activeRouteId]);

  // Route points filtered by active route folder
  const activeRoutePoints = useMemo(() => {
    if (activeRouteId === null) return points;
    return points.filter(p => p.routeId === activeRouteId);
  }, [points, activeRouteId]);

  const activeRoute = useMemo(() => {
    return savedUserRoutes.find(r => r.id === activeRouteId);
  }, [savedUserRoutes, activeRouteId]);

  // Points list in user-ordered sequence
  const activePoints = useMemo(() => {
    return activePointIds
      .map(id => points.find(p => p.id === id))
      .filter((p): p is Point => !!p);
  }, [activePointIds, points]);

  // Navigation segments calculation (max 10 points per segment)
  const gmapsSegments = useMemo(() => {
    if (activePoints.length < 2) return [];
    const segments: GmapsSegment[] = [];
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

      currentIndex += segmentPoints.length - 1;
    }

    const total = segments.length;
    segments.forEach(s => (s.totalSegments = total));

    return segments;
  }, [activePoints]);

  // Search filter for points list
  const filteredPoints = useMemo(() => {
    return activeRoutePoints.filter(
      p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [activeRoutePoints, searchQuery]);

  // Toast status message helper
  const showStatusMessage = (
    msg: string,
    type: 'success' | 'error' | 'warning' | 'info' = 'info',
    duration?: number
  ) => {
    const defaultDuration = type === 'error' ? 5000 : type === 'warning' ? 4500 : 3000;
    const toastDuration = duration ?? defaultDuration;
    const newId = Date.now() + Math.random();

    setToasts(prev => [...prev, { id: newId, message: msg, type, duration: toastDuration }]);

    if (toastDuration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== newId));
      }, toastDuration);
    }
  };

  const dismissToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Handle map click to fill form coordinates seamlessly
  const handleMapClick = async (lat: number, lng: number) => {
    setActiveTab('points');
    const currentSeq = ++mapClickGeocodeSeqRef.current;

    setFormData(prev => ({
      ...prev,
      lat: lat.toFixed(6),
      lng: lng.toFixed(6),
    }));

    const result = await reverseGeocode(lat, lng);
    if (mapClickGeocodeSeqRef.current !== currentSeq) return;

    if (result) {
      setFormData(prev => ({
        ...prev,
        name: result.name || result.address,
        address: result.address,
      }));
      showStatusMessage('Ustalono adres na podstawie kliknięcia!', 'success', 3000);
      return;
    }

    setFormData(prev => ({
      ...prev,
      name: prev.name ? prev.name : `Punkt (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
      address: `Współrzędne: ${lat.toFixed(6)}, ${lng.toFixed(6)}`,
    }));
    showStatusMessage('Uzupełniono współrzędne z mapy!', 'info', 3000);
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
      if (!finalAddress || finalAddress.startsWith('Współrzędne:') || finalAddress.startsWith('Szer:')) {
        const result = await reverseGeocode(latVal, lngVal);
        if (result && result.address) {
          finalAddress = result.address;
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
        order: points.length > 0 ? maxOrder + 1 : 0,
      });
      showStatusMessage('Dodano nowy punkt do bazy!', 'success');

      await updateDistanceMatrix(targetRouteId);
      setFormData({ id: undefined, name: '', lat: '', lng: '', address: '' });
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd synchronizacji z OSRM.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Modal states
  const [editingPoint, setEditingPoint] = useState<Point | null>(null);
  const [editFormData, setEditFormData] = useState<EditPointFormData>({ name: '', lat: '', lng: '', address: '' });
  const [editAddressQuery, setEditAddressQuery] = useState('');
  const [editIsGeocoding, setEditIsGeocoding] = useState(false);
  const [editGeocodingResults, setEditGeocodingResults] = useState<Array<{ display_name: string; name: string; address: string; lat: number; lng: number }>>([]);
  const [isRouteSelectOpen, setIsRouteSelectOpen] = useState(false);
  const [deletingPoint, setDeletingPoint] = useState<Point | null>(null);

  const [isAddRouteModalOpen, setIsAddRouteModalOpen] = useState(false);
  const [newRouteName, setNewRouteName] = useState('');
  const [editingFolderRoute, setEditingFolderRoute] = useState<SavedRoute | null>(null);
  const [editFolderRouteName, setEditFolderRouteName] = useState('');
  const [deletingFolderRoute, setDeletingFolderRoute] = useState<SavedRoute | null>(null);

  const [editingRoute, setEditingRoute] = useState<RouteHistory | null>(null);
  const [editRouteName, setEditRouteName] = useState('');
  const [editEmployeeName, setEditEmployeeName] = useState('');
  const [deletingRoute, setDeletingRoute] = useState<RouteHistory | null>(null);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importBackupData, setImportBackupData] = useState<DatabaseBackupData | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photon Search Bar state
  const [addressQuery, setAddressQuery] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodingResults, setGeocodingResults] = useState<Array<{ display_name: string; name: string; address: string; lat: number; lng: number }>>([]);

  // Live debounced geocoding search for main address query
  useEffect(() => {
    const query = addressQuery.trim();
    if (query.length < 2) {
      setGeocodingResults([]);
      setIsGeocoding(false);
      return;
    }

    const abortController = new AbortController();
    setIsGeocoding(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=6`, {
          signal: abortController.signal,
        });
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
                lng,
              };
            });
            setGeocodingResults(results);
          } else {
            setGeocodingResults([]);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Dynamic geocoding error:', err);
        }
      } finally {
        setIsGeocoding(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [addressQuery]);

  // Live debounced geocoding search for edit point address query
  useEffect(() => {
    const query = editAddressQuery.trim();
    if (query.length < 2) {
      setEditGeocodingResults([]);
      setEditIsGeocoding(false);
      return;
    }

    const abortController = new AbortController();
    setEditIsGeocoding(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=6`, {
          signal: abortController.signal,
        });
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
                lng,
              };
            });
            setEditGeocodingResults(results);
          } else {
            setEditGeocodingResults([]);
          }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error('Dynamic edit geocoding error:', err);
        }
      } finally {
        setEditIsGeocoding(false);
      }
    }, 280);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [editAddressQuery]);

  const handleSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!addressQuery.trim()) return;

    if (geocodingResults.length > 0) {
      handleSelectAddress(geocodingResults[0]);
      return;
    }

    setIsGeocoding(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(addressQuery.trim())}&limit=6`);
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
              lng,
            };
          });

          setGeocodingResults(results);
          if (results.length === 1) {
            handleSelectAddress(results[0]);
          }
        } else {
          showStatusMessage('Nie znaleziono podanego adresu w bazie Photon.', 'error');
        }
      }
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd wyszukiwania adresu w Photon.', 'error');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSelectAddress = (result: { display_name: string; name: string; address: string; lat: number; lng: number }) => {
    setFormData(prev => ({
      ...prev,
      name: result.name,
      lat: result.lat.toFixed(6),
      lng: result.lng.toFixed(6),
      address: result.address,
    }));

    setGeocodingResults([]);
    setAddressQuery('');
  };

  const handleEditSearchAddress = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editAddressQuery.trim()) return;

    if (editGeocodingResults.length > 0) {
      handleEditSelectAddress(editGeocodingResults[0]);
      return;
    }

    setEditIsGeocoding(true);
    try {
      const res = await fetch(`https://photon.komoot.io/api?q=${encodeURIComponent(editAddressQuery.trim())}&limit=6`);
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
              lng,
            };
          });

          setEditGeocodingResults(results);
          if (results.length === 1) {
            handleEditSelectAddress(results[0]);
          }
        } else {
          showStatusMessage('Nie znaleziono podanego adresu w edycji.', 'error');
        }
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
      address: result.address,
    }));

    setEditGeocodingResults([]);
    setEditAddressQuery('');
  };

  const handleStartEdit = (point: Point) => {
    setEditingPoint(point);
    setEditFormData({
      name: point.name,
      lat: point.lat.toString(),
      lng: point.lng.toString(),
      address: point.address || '',
      routeId: point.routeId,
    });
    setEditAddressQuery('');
    setEditGeocodingResults([]);
    setIsRouteSelectOpen(false);
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
      if (!finalAddress || finalAddress.startsWith('Współrzędne:') || finalAddress.startsWith('Szer:')) {
        const result = await reverseGeocode(latVal, lngVal);
        if (result && result.address) {
          finalAddress = result.address;
        }
      }

      const savedAddress = finalAddress || `Szer: ${latVal.toFixed(4)}, Dł: ${lngVal.toFixed(4)}`;
      const previousRouteId = editingPoint.routeId;
      const targetRouteId = editFormData.routeId ?? editingPoint.routeId;

      await db.points.update(editingPoint.id, {
        name: editFormData.name.trim(),
        lat: latVal,
        lng: lngVal,
        address: savedAddress,
        ...(targetRouteId !== undefined ? { routeId: targetRouteId } : {}),
      });

      if (targetRouteId !== undefined && targetRouteId !== editingPoint.routeId) {
        setActivePointIds(prev => prev.filter(id => id !== editingPoint.id));
        const targetRoute = savedUserRoutes.find(r => r.id === targetRouteId);
        const routeMsg = targetRoute ? ` do trasy "${targetRoute.name}"` : '';
        showStatusMessage(`Zaktualizowano i przeniesiono punkt${routeMsg}!`, 'success');
        if (previousRouteId !== undefined) {
          await updateDistanceMatrix(previousRouteId);
        }
        await updateDistanceMatrix(targetRouteId);
      } else {
        showStatusMessage('Zaktualizowano punkt w bazie!', 'success');
        await updateDistanceMatrix(targetRouteId);
      }

      setEditingPoint(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd aktualizacji punktu.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  const handleConfirmDeletePoint = async () => {
    if (!deletingPoint || deletingPoint.id === undefined) return;
    const pointId = deletingPoint.id;
    const pointRouteId = deletingPoint.routeId;
    setIsUpdatingMatrix(true);
    try {
      await db.points.delete(pointId);
      await db.distances.where('fromId').equals(pointId).or('toId').equals(pointId).delete();
      setActivePointIds(prev => prev.filter(id => id !== pointId));
      showStatusMessage('Punkt został usunięty z bazy.', 'success');
      setDeletingPoint(null);
      await updateDistanceMatrix(pointRouteId);
    } catch (err) {
      console.error(err);
      showStatusMessage('Wystąpił błąd podczas usuwania punktu.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Route folder handlers
  const handleCreateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRouteName.trim()) return;
    try {
      const maxOrder = savedUserRoutes.reduce((max, r) => Math.max(max, r.order ?? 0), 0);
      const newId = await db.routes.add({
        name: newRouteName.trim(),
        createdAt: new Date().toISOString(),
        order: savedUserRoutes.length > 0 ? maxOrder + 1 : 0,
      });
      setActiveRouteId(newId);
      setNewRouteName('');
      setIsAddRouteModalOpen(false);
      showStatusMessage(`Utworzono nową trasę "${newRouteName.trim()}"!`, 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas tworzenia nowej trasy.', 'error');
    }
  };

  const handleUpdateRouteName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFolderRoute || editingFolderRoute.id === undefined || !editFolderRouteName.trim()) return;
    try {
      await db.routes.update(editingFolderRoute.id, { name: editFolderRouteName.trim() });
      showStatusMessage('Zaktualizowano nazwę trasy!', 'success');
      setEditingFolderRoute(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas aktualizacji nazwy trasy.', 'error');
    }
  };

  const handleDeleteRoute = async () => {
    if (!deletingFolderRoute || deletingFolderRoute.id === undefined) return;
    const targetRouteId = deletingFolderRoute.id;
    try {
      const pointsToDelete = points.filter(p => p.routeId === targetRouteId);
      for (const p of pointsToDelete) {
        if (p.id !== undefined) {
          await db.points.delete(p.id);
        }
      }
      await db.distances.where('routeId').equals(targetRouteId).delete();
      await db.routes.delete(targetRouteId);

      const remainingRoutes = savedUserRoutes.filter(r => r.id !== targetRouteId);
      if (remainingRoutes.length > 0 && remainingRoutes[0].id !== undefined) {
        setActiveRouteId(remainingRoutes[0].id);
      } else {
        const fallbackId = await db.routes.add({
          name: 'Główna Trasa',
          createdAt: new Date().toISOString(),
          order: 0,
        });
        setActiveRouteId(fallbackId);
      }

      setDeletingFolderRoute(null);
      showStatusMessage('Trasa została pomyślnie usunięta.', 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Wystąpił błąd podczas usuwania trasy.', 'error');
    }
  };

  // Reorder saved points via Move Up / Move Down
  const handleMoveSavedPointUp = async (index: number) => {
    if (index <= 0 || index >= filteredPoints.length) return;
    const currentPoint = filteredPoints[index];
    const prevPoint = filteredPoints[index - 1];
    if (!currentPoint.id || !prevPoint.id) return;

    const currentOrder = currentPoint.order ?? index;
    const prevOrder = prevPoint.order ?? index - 1;

    await db.points.update(currentPoint.id, { order: prevOrder });
    await db.points.update(prevPoint.id, { order: currentOrder });
  };

  const handleMoveSavedPointDown = async (index: number) => {
    if (index < 0 || index >= filteredPoints.length - 1) return;
    const currentPoint = filteredPoints[index];
    const nextPoint = filteredPoints[index + 1];
    if (!currentPoint.id || !nextPoint.id) return;

    const currentOrder = currentPoint.order ?? index;
    const nextOrder = nextPoint.order ?? index + 1;

    await db.points.update(currentPoint.id, { order: nextOrder });
    await db.points.update(nextPoint.id, { order: currentOrder });
  };

  // Drag and Drop live swapping for saved points
  const handlePointerDownSavedDrag = (e: React.PointerEvent, pointId: number) => {
    setActiveSavedDragId(pointId);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerEnterSavedHover = async (targetPointId: number) => {
    if (activeSavedDragId === null || activeSavedDragId === targetPointId) return;

    const sourcePoint = points.find(p => p.id === activeSavedDragId);
    const targetPoint = points.find(p => p.id === targetPointId);
    if (!sourcePoint || !targetPoint || !sourcePoint.id || !targetPoint.id) return;

    const sourceOrder = sourcePoint.order ?? 0;
    const targetOrder = targetPoint.order ?? 0;

    await db.points.update(sourcePoint.id, { order: targetOrder });
    await db.points.update(targetPoint.id, { order: sourceOrder });
  };

  // Drag and Drop live swapping for active route points
  const handlePointerDownDrag = (e: React.PointerEvent, index: number) => {
    setActiveDragIndex(index);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerEnterHover = (targetIndex: number) => {
    if (activeDragIndex === null || activeDragIndex === targetIndex) return;

    setActivePointIds(prev => {
      const updated = [...prev];
      const [draggedItem] = updated.splice(activeDragIndex, 1);
      updated.splice(targetIndex, 0, draggedItem);
      return updated;
    });

    setActiveDragIndex(targetIndex);
  };

  useEffect(() => {
    const handleGlobalPointerUp = () => {
      if (activeDragIndex !== null) setActiveDragIndex(null);
      if (activeSavedDragId !== null) setActiveSavedDragId(null);
    };

    window.addEventListener('pointerup', handleGlobalPointerUp);
    return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [activeDragIndex, activeSavedDragId]);

  // Via-point correction handlers
  const handleAddViaPoint = (lat: number, lng: number, segmentIndex?: number) => {
    const segIdx = segmentIndex ?? 0;
    setViaPoints(prev => [...prev, { segmentIndex: segIdx, lat, lng }]);
  };

  const handleUpdateViaPoint = (index: number, lat: number, lng: number, segmentIndex?: number) => {
    setViaPoints(prev =>
      prev.map((v, idx) =>
        idx === index ? { ...v, lat, lng, segmentIndex: segmentIndex ?? v.segmentIndex } : v
      )
    );
  };

  const handleRemoveViaPoint = (index: number) => {
    setViaPoints(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearViaPoints = () => {
    setViaPoints([]);
  };

  const handleToggleRouteEditMode = () => {
    setIsRouteEditMode(prev => !prev);
  };

  // Active route points manipulation
  const handleToggleActive = (id: number) => {
    setActivePointIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(pId => pId !== id);
      }
      return [...prev, id];
    });
  };

  const isHasReturnLeg = useMemo(() => {
    return activePointIds.length > 1 && activePointIds[0] === activePointIds[activePointIds.length - 1];
  }, [activePointIds]);

  const handleToggleReturnToStart = () => {
    if (activePointIds.length < 2) {
      showStatusMessage('Dodaj co najmniej 2 punkty, aby włączyć pętlę trasy!', 'error');
      return;
    }
    if (isHasReturnLeg) {
      setActivePointIds(prev => prev.slice(0, prev.length - 1));
      showStatusMessage('Wyłączono powrót do punktu startowego.', 'info');
    } else {
      setActivePointIds(prev => [...prev, prev[0]]);
      showStatusMessage('Włączono pętlę trasy (powrót do startu)!', 'success');
    }
  };

  const handleClearActiveRoute = () => {
    setActivePointIds([]);
    setRouteName('');
    setSelectedEmployeeName('');
    setLoadedRouteId(null);
    setRouteCoordinates([]);
    setTotalDistance(0);
    setStepDistances({});
    setViaPoints([]);
    setIsRouteEditMode(false);
    showStatusMessage('Wyczyszczono plan bieżącej trasy.', 'info');
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setActivePointIds(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index - 1];
      updated[index - 1] = temp;
      return updated;
    });
  };

  const handleMoveDown = (index: number) => {
    if (index >= activePointIds.length - 1) return;
    setActivePointIds(prev => {
      const updated = [...prev];
      const temp = updated[index];
      updated[index] = updated[index + 1];
      updated[index + 1] = temp;
      return updated;
    });
  };

  // Recompute route geometry & distances when active points change
  useEffect(() => {
    const fetchFullRouteGeometry = async () => {
      if (activePoints.length < 2) {
        setRouteCoordinates([]);
        setTotalDistance(0);
        setStepDistances({});
        return;
      }

      try {
        let totalDist = 0;
        const coordsAccumulator: [number, number][] = [];
        const stepDistRecord: Record<string, number> = {};

        for (let i = 0; i < activePoints.length - 1; i++) {
          const from = activePoints[i];
          const to = activePoints[i + 1];

          const segVias = sortViaPointsForSegment(
            viaPoints.filter(v => v.segmentIndex === i),
            from,
            to
          );

          const sequenceCoords: Array<[number, number]> = [
            [from.lng, from.lat],
            ...segVias.map(v => [v.lng, v.lat] as [number, number]),
            [to.lng, to.lat],
          ];

          const coordsString = sequenceCoords.map(c => `${c[0]},${c[1]}`).join(';');
          const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;

          const res = await fetch(url);
          if (res.ok) {
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
              const segRoute = data.routes[0];
              const segKm = segRoute.distance / 1000;
              totalDist += segKm;

              stepDistRecord[`seg-${i}`] = segKm;
              if (from.id !== undefined && to.id !== undefined) {
                stepDistRecord[`${from.id}-${to.id}`] = segKm;
              }

              const segCoords: [number, number][] = segRoute.geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]] as [number, number]
              );

              if (coordsAccumulator.length > 0 && segCoords.length > 0) {
                coordsAccumulator.push(...segCoords.slice(1));
              } else {
                coordsAccumulator.push(...segCoords);
              }
            }
          }
        }

        setRouteCoordinates(coordsAccumulator);
        setTotalDistance(Math.round(totalDist * 10) / 10);
        setStepDistances(stepDistDist => ({ ...stepDistDist, ...stepDistRecord }));
      } catch (err) {
        console.error('Error computing segmented route with waypoints:', err);
      }
    };

    fetchFullRouteGeometry();
  }, [activePoints, viaPoints]);

  // Loaded route state
  const [loadedRouteId, setLoadedRouteId] = useState<number | null>(null);

  const handleSaveRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (activePointIds.length < 2) {
      showStatusMessage('Dodaj co najmniej 2 punkty do trasy, aby móc ją zapisać!', 'error');
      return;
    }

    const nameToSave = routeName.trim() || `Trasa z dnia ${new Date().toLocaleDateString('pl-PL')}`;
    const employeeToSave = selectedEmployeeName.trim() || undefined;

    try {
      const activeFolderId = await ensureActiveRouteId();
      await db.routes_history.add({
        routeId: activeFolderId,
        routeName: nameToSave,
        employeeName: employeeToSave,
        date: new Date().toISOString(),
        totalDistance: totalDistance,
        pointsOrder: activePointIds,
        viaPoints: viaPoints.length > 0 ? viaPoints : undefined,
      });

      showStatusMessage(`Trasa "${nameToSave}" została zapisana w historii!`, 'success');
      setRouteName('');
      setSelectedEmployeeName('');
      setLoadedRouteId(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd zapisu trasy do historii.', 'error');
    }
  };

  const handleUpdateLoadedRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loadedRouteId === null) return;
    if (activePointIds.length < 2) {
      showStatusMessage('Trasa musi posiadać co najmniej 2 punkty!', 'error');
      return;
    }

    const nameToSave = routeName.trim() || `Trasa z dnia ${new Date().toLocaleDateString('pl-PL')}`;
    const employeeToSave = selectedEmployeeName.trim() || undefined;

    try {
      const activeFolderId = await ensureActiveRouteId();
      await db.routes_history.update(loadedRouteId, {
        routeId: activeFolderId,
        routeName: nameToSave,
        employeeName: employeeToSave,
        totalDistance: totalDistance,
        pointsOrder: activePointIds,
        viaPoints: viaPoints.length > 0 ? viaPoints : undefined,
      });

      showStatusMessage(`Zaktualizowano trasę "${nameToSave}" w historii!`, 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd aktualizacji trasy w historii.', 'error');
    }
  };

  const handleLoadRoute = async (historyItem: RouteHistory) => {
    // Detect folder ID from history item or fallback to first point's folder
    const firstPoint = points.find(p => historyItem.pointsOrder.includes(p.id!));
    const targetFolderId = historyItem.routeId ?? firstPoint?.routeId;

    if (targetFolderId !== undefined && targetFolderId !== activeRouteId) {
      isSkipRouteResetRef.current = true;
      setActiveRouteId(targetFolderId);
    }

    const loadedPoints = historyItem.pointsOrder
      .map(id => points.find(p => p.id === id))
      .filter((p): p is Point => !!p);

    isSkipViaPointResetRef.current = true;
    setActivePointIds(historyItem.pointsOrder);
    setRouteName(historyItem.routeName);
    setSelectedEmployeeName(historyItem.employeeName || '');
    setLoadedRouteId(historyItem.id ?? null);
    setViaPoints(historyItem.viaPoints ? normalizeViaPoints(historyItem.viaPoints, loadedPoints) : []);

    setActiveTab('route');
    showStatusMessage(`Wczytano trasę "${historyItem.routeName}" z historii!`, 'success');
  };

  const handleStartEditRoute = (historyItem: RouteHistory, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingRoute(historyItem);
    setEditRouteName(historyItem.routeName);
    setEditEmployeeName(historyItem.employeeName || '');
    setIsEditRouteEmployeeSelectOpen(false);
  };

  const handleUpdateRoute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRoute || editingRoute.id === undefined) return;
    if (!editRouteName.trim()) {
      showStatusMessage('Podaj nazwę trasy!', 'error');
      return;
    }

    try {
      await db.routes_history.update(editingRoute.id, {
        routeName: editRouteName.trim(),
        employeeName: editEmployeeName.trim() || undefined,
      });

      if (loadedRouteId === editingRoute.id) {
        setRouteName(editRouteName.trim());
        setSelectedEmployeeName(editEmployeeName.trim());
      }

      showStatusMessage('Zaktualizowano dane trasy!', 'success');
      setEditingRoute(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd aktualizacji nazwy trasy.', 'error');
    }
  };

  const handleConfirmDeleteRoute = async () => {
    if (!deletingRoute || deletingRoute.id === undefined) return;
    const routeIdToDelete = deletingRoute.id;

    try {
      await db.routes_history.delete(routeIdToDelete);
      if (loadedRouteId === routeIdToDelete) {
        setLoadedRouteId(null);
      }
      showStatusMessage('Trasa została usunięta z historii.', 'success');
      setDeletingRoute(null);
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd podczas usuwania trasy.', 'error');
    }
  };

  // Helper to find folder name for history item
  const getRouteNameForHistoryItem = (item: RouteHistory): string => {
    if (item.routeId === undefined || item.routeId === null) return 'Główna Trasa';
    const folder = savedUserRoutes.find(r => r.id === item.routeId);
    return folder ? folder.name : 'Główna Trasa';
  };

  // Force rebuild of distances table manually
  const handleForceRebuild = async () => {
    setIsUpdatingMatrix(true);
    try {
      if (activeRouteId !== null) {
        await updateDistanceMatrix(activeRouteId);
      } else {
        await updateDistanceMatrix();
      }
      showStatusMessage('Pomyślnie przebudowano macierz odległości!', 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Błąd pobierania macierzy z OSRM.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Database Backup handlers
  const handleExportBackup = async () => {
    try {
      const backupData = await exportDatabaseToJSON();
      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const downloadUrl = URL.createObjectURL(blob);
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}_${hours}-${minutes}`;

      const downloadAnchor = document.createElement('a');
      downloadAnchor.href = downloadUrl;
      downloadAnchor.download = `transport_backup_${dateStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      document.body.removeChild(downloadAnchor);
      URL.revokeObjectURL(downloadUrl);
      showStatusMessage('Pomyślnie pobrano plik kopii zapasowej JSON!', 'success');
    } catch (err) {
      console.error(err);
      showStatusMessage('Wystąpił błąd podczas eksportu bazy.', 'error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as DatabaseBackupData;

        if (!parsed.points || !Array.isArray(parsed.points)) {
          throw new Error('Nieprawidłowy format pliku kopii zapasowej.');
        }

        setImportBackupData(parsed);
        setIsImportModalOpen(true);
      } catch (err: any) {
        console.error(err);
        showStatusMessage(err.message || 'Błąd odczytu pliku JSON.', 'error');
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.readAsText(file);
  };

  const handleConfirmImport = async (mode: 'overwrite' | 'merge') => {
    if (!importBackupData) return;

    setIsUpdatingMatrix(true);
    try {
      await importDatabaseFromJSON(importBackupData, mode);
      setIsImportModalOpen(false);
      setImportBackupData(null);

      const refreshedRoutes = await db.routes.toArray();
      if (refreshedRoutes.length > 0 && refreshedRoutes[0].id !== undefined) {
        setActiveRouteId(refreshedRoutes[0].id);
      }

      showStatusMessage(
        mode === 'overwrite' ? 'Pomyślnie zastąpiono całą bazę danymi z pliku!' : 'Pomyślnie scalono dane z pliku z obecną bazą!',
        'success'
      );
    } catch (err: any) {
      console.error(err);
      showStatusMessage(err.message || 'Wystąpił błąd podczas importu danych.', 'error');
    } finally {
      setIsUpdatingMatrix(false);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setActiveTab('points');
        const searchInput = document.getElementById('desktop-main-search-input');
        if (searchInput) {
          searchInput.focus();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const routePointIds = activeRoutePoints.map(p => p.id!).filter(id => id !== undefined);
          if (activePointIds.length === routePointIds.length) {
            setActivePointIds([]);
          } else {
            setActivePointIds(routePointIds);
          }
        }
      } else if (e.key === 'Escape') {
        if (isGmapsExportModalOpen) {
          setIsGmapsExportModalOpen(false);
        } else if (isAddRouteModalOpen) {
          setIsAddRouteModalOpen(false);
        } else if (editingFolderRoute) {
          setEditingFolderRoute(null);
        } else if (deletingFolderRoute) {
          setDeletingFolderRoute(null);
        } else if (editingPoint) {
          setEditingPoint(null);
        } else if (deletingPoint) {
          setDeletingPoint(null);
        } else if (editingRoute) {
          setEditingRoute(null);
        } else if (deletingRoute) {
          setDeletingRoute(null);
        } else if (isImportModalOpen) {
          setIsImportModalOpen(false);
          setImportBackupData(null);
        } else if (isRouteEditMode) {
          setIsRouteEditMode(false);
        } else if (activePointIds.length > 0) {
          handleClearActiveRoute();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeRoutePoints,
    activePointIds,
    isGmapsExportModalOpen,
    isAddRouteModalOpen,
    editingFolderRoute,
    deletingFolderRoute,
    editingPoint,
    deletingPoint,
    editingRoute,
    deletingRoute,
    isImportModalOpen,
    isRouteEditMode,
  ]);

  // Dark mode theme toggle
  const toggleTheme = () => {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      if (next === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  // Active tab state: 'points' | 'route' | 'history' | 'backup'
  const [activeTab, setActiveTab] = useState<'points' | 'route' | 'history' | 'backup'>('points');

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-200 select-none">
      {/* 1. HEADER / TOOLBAR */}
      <HeaderBar
        isUpdatingMatrix={isUpdatingMatrix}
        theme={theme}
        onForceRebuild={handleForceRebuild}
        onToggleTheme={toggleTheme}
      />

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 2. MAIN DESKTOP WORKBENCH (Sidebar + Map Viewport) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* LEFT DESKTOP SIDEBAR PANEL */}
        <aside className="w-[520px] bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col overflow-hidden flex-shrink-0 z-10 shadow-lg">
          {/* SIDEBAR TABS NAV HEADER */}
          <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 bg-zinc-50/70 dark:bg-zinc-950/40 text-sm font-bold gap-1.5 flex-shrink-0">
            <button
              onClick={() => setActiveTab('points')}
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'points'
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
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'route'
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
              className={`flex-1 py-2 rounded-lg flex items-center justify-center gap-2 transition cursor-pointer ${
                activeTab === 'history'
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
              className={`p-2 rounded-lg flex items-center justify-center transition cursor-pointer flex-shrink-0 ${
                activeTab === 'backup'
                  ? 'bg-white dark:bg-zinc-850 text-indigo-600 dark:text-indigo-400 shadow-sm border border-zinc-200/80 dark:border-zinc-700/80'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>

          {/* SIDEBAR SCROLLABLE CONTENT BODY */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeTab === 'points' && (
              <PointsTab
                addressQuery={addressQuery}
                setAddressQuery={setAddressQuery}
                handleSearchAddress={handleSearchAddress}
                isGeocoding={isGeocoding}
                geocodingResults={geocodingResults}
                setGeocodingResults={setGeocodingResults}
                handleSelectAddress={handleSelectAddress}
                formData={formData}
                setFormData={setFormData}
                handleSavePoint={handleSavePoint}
                isUpdatingMatrix={isUpdatingMatrix}
                savedUserRoutes={savedUserRoutes}
                activeRouteId={activeRouteId}
                setActiveRouteId={setActiveRouteId}
                rawPoints={rawPoints}
                setIsAddRouteModalOpen={setIsAddRouteModalOpen}
                setEditingFolderRoute={setEditingFolderRoute}
                setEditFolderRouteName={setEditFolderRouteName}
                setDeletingFolderRoute={setDeletingFolderRoute}
                activeRoute={activeRoute}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                filteredPoints={filteredPoints}
                activePointIds={activePointIds}
                activeSavedDragId={activeSavedDragId}
                handlePointerEnterSavedHover={handlePointerEnterSavedHover}
                handleToggleActive={handleToggleActive}
                handlePointerDownSavedDrag={handlePointerDownSavedDrag}
                handleMoveSavedPointUp={handleMoveSavedPointUp}
                handleMoveSavedPointDown={handleMoveSavedPointDown}
                handleStartEdit={handleStartEdit}
                setDeletingPoint={setDeletingPoint}
              />
            )}

            {activeTab === 'route' && (
              <RoutePlanTab
                totalDistance={totalDistance}
                activePointIds={activePointIds}
                setActiveTab={setActiveTab}
                handleToggleReturnToStart={handleToggleReturnToStart}
                isHasReturnLeg={isHasReturnLeg}
                handleToggleRouteEditMode={handleToggleRouteEditMode}
                isRouteEditMode={isRouteEditMode}
                handleClearActiveRoute={handleClearActiveRoute}
                activePoints={activePoints}
                viaPoints={viaPoints}
                stepDistances={stepDistances}
                activeDragIndex={activeDragIndex}
                handlePointerEnterHover={handlePointerEnterHover}
                handlePointerDownDrag={handlePointerDownDrag}
                handleMoveUp={handleMoveUp}
                handleMoveDown={handleMoveDown}
                handleToggleActive={handleToggleActive}
                setIsGmapsExportModalOpen={setIsGmapsExportModalOpen}
                gmapsSegments={gmapsSegments}
                loadedRouteId={loadedRouteId}
                setLoadedRouteId={setLoadedRouteId}
                handleUpdateLoadedRoute={handleUpdateLoadedRoute}
                handleSaveRoute={handleSaveRoute}
                routeName={routeName}
                setRouteName={setRouteName}
                selectedEmployeeName={selectedEmployeeName}
                setSelectedEmployeeName={setSelectedEmployeeName}
                isPlanEmployeeSelectOpen={isPlanEmployeeSelectOpen}
                setIsPlanEmployeeSelectOpen={setIsPlanEmployeeSelectOpen}
                employees={employees}
              />
            )}

            {activeTab === 'history' && (
              <HistoryTab
                savedRoutes={savedRoutes}
                getRouteNameForHistoryItem={getRouteNameForHistoryItem}
                handleLoadRoute={handleLoadRoute}
                handleStartEditRoute={handleStartEditRoute}
                setDeletingRoute={setDeletingRoute}
              />
            )}

            {activeTab === 'backup' && (
              <BackupTab
                handleAddEmployee={handleAddEmployee}
                newEmployeeName={newEmployeeName}
                setNewEmployeeName={setNewEmployeeName}
                employees={employees}
                handleDeleteEmployee={handleDeleteEmployee}
                fileInputRef={fileInputRef}
                handleFileChange={handleFileChange}
                handleExportBackup={handleExportBackup}
                pointsCount={points.length}
                savedUserRoutesCount={savedUserRoutes.length}
                savedRoutesCount={savedRoutes.length}
              />
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
          <span>
            Baza: <strong className="text-zinc-800 dark:text-zinc-200">{points.length}</strong> punktów | Trasa:{' '}
            <strong className="text-emerald-500">{totalDistance} km</strong>
          </span>
        </div>
      </footer>

      {/* MODALS */}
      <EditPointModal
        editingPoint={editingPoint}
        onClose={() => setEditingPoint(null)}
        editFormData={editFormData}
        setEditFormData={setEditFormData}
        editAddressQuery={editAddressQuery}
        setEditAddressQuery={setEditAddressQuery}
        editIsGeocoding={editIsGeocoding}
        editGeocodingResults={editGeocodingResults}
        handleEditSearchAddress={handleEditSearchAddress}
        handleEditSelectAddress={handleEditSelectAddress}
        handleUpdatePoint={handleUpdatePoint}
        isUpdatingMatrix={isUpdatingMatrix}
        savedUserRoutes={savedUserRoutes}
        activeRouteId={activeRouteId}
        rawPoints={rawPoints}
        isRouteSelectOpen={isRouteSelectOpen}
        setIsRouteSelectOpen={setIsRouteSelectOpen}
      />

      <DeletePointModal
        deletingPoint={deletingPoint}
        onClose={() => setDeletingPoint(null)}
        onConfirm={handleConfirmDeletePoint}
        isUpdatingMatrix={isUpdatingMatrix}
      />

      <RouteFolderModals
        isAddRouteModalOpen={isAddRouteModalOpen}
        setIsAddRouteModalOpen={setIsAddRouteModalOpen}
        newRouteName={newRouteName}
        setNewRouteName={setNewRouteName}
        handleCreateRoute={handleCreateRoute}
        editingFolderRoute={editingFolderRoute}
        setEditingFolderRoute={setEditingFolderRoute}
        editFolderRouteName={editFolderRouteName}
        setEditFolderRouteName={setEditFolderRouteName}
        handleUpdateRouteName={handleUpdateRouteName}
        deletingFolderRoute={deletingFolderRoute}
        setDeletingFolderRoute={setDeletingFolderRoute}
        handleDeleteRoute={handleDeleteRoute}
      />

      <HistoryRouteModals
        editingRoute={editingRoute}
        setEditingRoute={setEditingRoute}
        editRouteName={editRouteName}
        setEditRouteName={setEditRouteName}
        editEmployeeName={editEmployeeName}
        setEditEmployeeName={setEditEmployeeName}
        employees={employees}
        isEditRouteEmployeeSelectOpen={isEditRouteEmployeeSelectOpen}
        setIsEditRouteEmployeeSelectOpen={setIsEditRouteEmployeeSelectOpen}
        handleUpdateRoute={handleUpdateRoute}
        deletingRoute={deletingRoute}
        setDeletingRoute={setDeletingRoute}
        handleConfirmDeleteRoute={handleConfirmDeleteRoute}
      />

      <ImportBackupModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setImportBackupData(null);
        }}
        importBackupData={importBackupData}
        onConfirmImport={handleConfirmImport}
      />

      <GmapsExportModal
        isOpen={isGmapsExportModalOpen}
        onClose={() => setIsGmapsExportModalOpen(false)}
        activePointsCount={activePointIds.length}
        gmapsSegments={gmapsSegments}
        copiedSegmentIndex={copiedSegmentIndex}
        onCopySegmentLink={handleCopySegmentLink}
        onOpenExternalUrl={handleOpenExternalUrl}
      />
    </div>
  );
}
