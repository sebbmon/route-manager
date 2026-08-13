import Dexie, { type Table } from 'dexie';

export interface Point {
  id?: number;
  routeId?: number;
  name: string;
  lat: number;
  lng: number;
  address?: string;
  order?: number;
}

export interface SavedRoute {
  id?: number;
  name: string;
  createdAt: string;
  order?: number;
}

export interface Distance {
  id: string; // "fromId-toId"
  fromId: number;
  toId: number;
  distanceKm: number;
}

export interface ViaPoint {
  segmentIndex: number;
  lat: number;
  lng: number;
}

function distanceToSegmentSquared(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return (px - ax) * (px - ax) + (py - ay) * (py - ay);
  let t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  t = Math.max(0, Math.min(1, t));
  const projX = ax + t * (bx - ax);
  const projY = ay + t * (by - ay);
  return (px - projX) * (px - projX) + (py - projY) * (py - projY);
}

export function findNearestSegmentIndex(
  lat: number,
  lng: number,
  activePoints: Point[],
  segmentPolylines?: [number, number][][]
): number {
  if (!activePoints || activePoints.length < 2) return 0;

  // If detailed segment polylines are available, measure distance to actual road polyline
  if (segmentPolylines && segmentPolylines.length === activePoints.length - 1) {
    let minDistance = Infinity;
    let bestIndex = 0;

    for (let i = 0; i < segmentPolylines.length; i++) {
      const coords = segmentPolylines[i];
      if (!coords || coords.length === 0) continue;

      for (let j = 0; j < coords.length - 1; j++) {
        const p1 = coords[j];
        const p2 = coords[j + 1];
        const distSq = distanceToSegmentSquared(lat, lng, p1[0], p1[1], p2[0], p2[1]);
        if (distSq < minDistance) {
          minDistance = distSq;
          bestIndex = i;
        }
      }
    }

    return bestIndex;
  }

  // Fallback to straight line segments between main active points
  let minDistance = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < activePoints.length - 1; i++) {
    const p1 = activePoints[i];
    const p2 = activePoints[i + 1];
    if (!p1 || !p2 || typeof p1.lat !== 'number' || typeof p1.lng !== 'number' || typeof p2.lat !== 'number' || typeof p2.lng !== 'number') {
      continue;
    }
    const distSq = distanceToSegmentSquared(lat, lng, p1.lat, p1.lng, p2.lat, p2.lng);
    if (distSq < minDistance) {
      minDistance = distSq;
      bestIndex = i;
    }
  }

  return bestIndex;
}

export function getSegmentProjectionT(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const l2 = (bx - ax) * (bx - ax) + (by - ay) * (by - ay);
  if (l2 === 0) return 0;
  const t = ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / l2;
  return Math.max(0, Math.min(1, t));
}

export function sortViaPointsForSegment(segVias: ViaPoint[], p1: Point, p2: Point): ViaPoint[] {
  if (!segVias || segVias.length <= 1 || !p1 || !p2) return segVias || [];
  return [...segVias].sort((a, b) => {
    const tA = getSegmentProjectionT(a.lat, a.lng, p1.lat, p1.lng, p2.lat, p2.lng);
    const tB = getSegmentProjectionT(b.lat, b.lng, p1.lat, p1.lng, p2.lat, p2.lng);
    return tA - tB;
  });
}

export function normalizeViaPoints(
  rawViaPoints: (ViaPoint | [number, number])[] | undefined | null,
  activePoints: Point[]
): ViaPoint[] {
  if (!rawViaPoints || rawViaPoints.length === 0) return [];

  return rawViaPoints.map(v => {
    if (Array.isArray(v)) {
      const lat = v[0];
      const lng = v[1];
      const segmentIndex = activePoints.length >= 2 ? findNearestSegmentIndex(lat, lng, activePoints) : 0;
      return { segmentIndex, lat, lng };
    }
    return v;
  });
}

export interface Employee {
  id?: number;
  name: string;
}

export interface RouteHistory {
  id?: number;
  routeId?: number;
  routeName: string;
  employeeName?: string;
  date: string;
  pointsOrder: number[]; // Array of Point IDs
  totalDistance: number;
  viaPoints?: ViaPoint[] | [number, number][]; // Custom route via points with segment index (or legacy [lat, lng][])
  savedRouteName?: string; // Name of the route/folder that these points belong to
}

export class RoutePlannerDatabase extends Dexie {
  points!: Table<Point>;
  distances!: Table<Distance>;
  routes_history!: Table<RouteHistory>;
  routes!: Table<SavedRoute>;
  employees!: Table<Employee>;

  constructor() {
    super('RoutePlannerDatabase');
    this.version(1).stores({
      points: '++id, name, lat, lng',
      distances: 'id, fromId, toId, distanceKm',
      routes_history: '++id, routeName, date, totalDistance'
    });

    this.version(2).stores({
      points: '++id, routeId, name, lat, lng',
      distances: 'id, fromId, toId, distanceKm',
      routes_history: '++id, routeName, date, totalDistance',
      routes: '++id, name, order'
    });

    this.version(3).stores({
      points: '++id, routeId, name, lat, lng',
      distances: 'id, fromId, toId, distanceKm',
      routes_history: '++id, routeName, employeeName, date, totalDistance',
      routes: '++id, name, order',
      employees: '++id, name'
    });
  }
}

export const db = new RoutePlannerDatabase();

/**
 * Re-fetches the entire distance matrix from OSRM and updates the distances table.
 * It queries all points from the 'points' table and gets the "each-to-each" distance.
 */
export async function updateDistanceMatrix(): Promise<void> {
  const points = await db.points.toArray();
  
  if (points.length < 2) {
    // Cannot compute distances for less than 2 points, clear the table
    await db.distances.clear();
    return;
  }

  // Build the coordinate string: lng,lat;lng,lat...
  const coords = points.map(p => `${p.lng},${p.lat}`).join(';');
  const url = `http://router.project-osrm.org/table/v1/driving/${coords}?annotations=distance`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`OSRM Distance Matrix API failed: ${res.statusText}`);
    }

    const data = await res.json();
    if (data.code !== 'Ok' || !data.distances) {
      throw new Error(`OSRM Distance Matrix API error: ${data.code}`);
    }

    const newDistances: Distance[] = [];

    // OSRM returns distances[fromIndex][toIndex] in meters
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        const fromPoint = points[i];
        const toPoint = points[j];

        if (fromPoint.id === undefined || toPoint.id === undefined) continue;

        const distanceMeters = data.distances[i][j];
        
        // Convert to km, round to 1 decimal place.
        // Math.round(meters / 100) / 10 is equivalent to Math.round((meters / 1000) * 10) / 10
        const distanceKm = distanceMeters !== null && distanceMeters !== undefined
          ? Math.round(distanceMeters / 100) / 10
          : 0;

        newDistances.push({
          id: `${fromPoint.id}-${toPoint.id}`,
          fromId: fromPoint.id,
          toId: toPoint.id,
          distanceKm
        });
      }
    }

    // Write to DB atomically
    await db.transaction('rw', db.distances, async () => {
      await db.distances.clear();
      await db.distances.bulkAdd(newDistances);
    });
  } catch (error) {
    console.error('Failed to update distance matrix:', error);
    throw error;
  }
}

export interface DatabaseBackupData {
  version: number;
  appName: string;
  exportedAt: string;
  points: Point[];
  routes: SavedRoute[];
  routes_history: RouteHistory[];
  distances?: Distance[];
  employees?: Employee[];
}

/**
 * Export all database tables to a structured JSON object
 */
export async function exportDatabaseToJSON(): Promise<DatabaseBackupData> {
  const points = await db.points.toArray();
  const routes = await db.routes.toArray();
  const routes_history = await db.routes_history.toArray();
  const distances = await db.distances.toArray();
  const employees = await db.employees.toArray();

  return {
    version: 3,
    appName: 'RoutePlanner',
    exportedAt: new Date().toISOString(),
    points,
    routes,
    routes_history,
    distances,
    employees,
  };
}

/**
 * Import database tables from a backup object
 */
export async function importDatabaseFromJSON(
  backupData: DatabaseBackupData,
  mode: 'overwrite' | 'merge' = 'overwrite'
): Promise<{ pointsCount: number; routesCount: number; historyCount: number }> {
  if (!backupData || typeof backupData !== 'object') {
    throw new Error('Nieprawidłowy format pliku kopii zapasowej.');
  }

  const points = Array.isArray(backupData.points) ? backupData.points : [];
  const routes = Array.isArray(backupData.routes) ? backupData.routes : [];
  const routes_history = Array.isArray(backupData.routes_history) ? backupData.routes_history : [];
  const distances = Array.isArray(backupData.distances) ? backupData.distances : [];
  const employees = Array.isArray(backupData.employees) ? backupData.employees : [];

  if (mode === 'overwrite') {
    await db.transaction('rw', [db.points, db.routes, db.routes_history, db.distances, db.employees], async () => {
      await db.points.clear();
      await db.routes.clear();
      await db.routes_history.clear();
      await db.distances.clear();
      await db.employees.clear();

      if (points.length > 0) await db.points.bulkAdd(points);
      if (routes.length > 0) await db.routes.bulkAdd(routes);
      if (routes_history.length > 0) await db.routes_history.bulkAdd(routes_history);
      if (distances.length > 0) await db.distances.bulkAdd(distances);
      if (employees.length > 0) await db.employees.bulkAdd(employees);
    });
  } else {
    // Merge mode: Add without clearing
    await db.transaction('rw', [db.points, db.routes, db.routes_history, db.distances, db.employees], async () => {
      if (points.length > 0) {
        // Strip IDs when merging to avoid primary key conflicts
        const cleanPoints = points.map(({ id, ...rest }) => rest);
        await db.points.bulkAdd(cleanPoints as Point[]);
      }
      if (routes.length > 0) {
        const cleanRoutes = routes.map(({ id, ...rest }) => rest);
        await db.routes.bulkAdd(cleanRoutes as SavedRoute[]);
      }
      if (routes_history.length > 0) {
        const cleanHistory = routes_history.map(({ id, ...rest }) => rest);
        await db.routes_history.bulkAdd(cleanHistory as RouteHistory[]);
      }
      if (employees.length > 0) {
        const cleanEmployees = employees.map(({ id, ...rest }) => rest);
        await db.employees.bulkAdd(cleanEmployees as Employee[]);
      }
    });
  }

  // Recalculate distance matrix if needed
  try {
    await updateDistanceMatrix();
  } catch (err) {
    console.error('Failed to auto-update distance matrix after import:', err);
  }

  return {
    pointsCount: points.length,
    routesCount: routes.length,
    historyCount: routes_history.length,
  };
}
