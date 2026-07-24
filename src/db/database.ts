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

export interface RouteHistory {
  id?: number;
  routeName: string;
  date: string;
  pointsOrder: number[]; // Array of Point IDs
  totalDistance: number;
  viaPoints?: [number, number][]; // Custom route via points [lat, lng][]
}

export class RoutePlannerDatabase extends Dexie {
  points!: Table<Point>;
  distances!: Table<Distance>;
  routes_history!: Table<RouteHistory>;
  routes!: Table<SavedRoute>;

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
