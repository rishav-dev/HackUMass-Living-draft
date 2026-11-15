import { useQuery } from '@tanstack/react-query';
import type { FeatureCollection, Geometry } from 'geojson';
import type { MemoryCardDto } from '@living-draft/contracts';
import { api } from '../../api/client';
import { emotionMeta } from '../../lib/meta';

export interface MapPlace {
  id: string;
  name: string;
  kind: string | null;
  region: string | null;
  country: string | null;
  lat: number;
  lon: number;
  memoryIds: string[];
}

export interface PlacesMapDto {
  placed: MapPlace[];
  unplaced: Array<{ id: string; name: string; count: number }>;
}

export interface PlaceCluster {
  id: string;
  lat: number;
  lon: number;
  places: MapPlace[];
  count: number;
}

export function usePlacesMap() {
  return useQuery({
    queryKey: ['places', 'map'],
    queryFn: () => api.get<PlacesMapDto>('/places/map'),
  });
}

const RAD = Math.PI / 180;

function degreesApart(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return (2 * Math.asin(Math.min(1, Math.sqrt(h)))) / RAD;
}

function finish(groups: Array<{ places: MapPlace[] }>): PlaceCluster[] {
  return groups.map(({ places }) => {
    const count = places.reduce((sum, p) => sum + p.memoryIds.length, 0);
    const lat = places.reduce((sum, p) => sum + p.lat * p.memoryIds.length, 0) / count;
    const lon = places.reduce((sum, p) => sum + p.lon * p.memoryIds.length, 0) / count;
    return {
      id: places
        .map((p) => p.id)
        .sort()
        .join('|'),
      lat,
      lon,
      places: [...places].sort((a, b) => b.memoryIds.length - a.memoryIds.length),
      count,
    };
  });
}

export function clusterByDegrees(places: MapPlace[], radius: number): PlaceCluster[] {
  const groups: Array<{ lat: number; lon: number; places: MapPlace[] }> = [];
  for (const place of [...places].sort((a, b) => b.memoryIds.length - a.memoryIds.length)) {
    const near = groups.find((g) => degreesApart(g, place) <= radius);
    if (near) near.places.push(place);
    else groups.push({ lat: place.lat, lon: place.lon, places: [place] });
  }
  return finish(groups);
}

export function clusterByPixels(
  places: MapPlace[],
  at: (place: MapPlace) => [number, number] | null,
  radius: number,
): PlaceCluster[] {
  const groups: Array<{ x: number; y: number; places: MapPlace[] }> = [];
  for (const place of [...places].sort((a, b) => b.memoryIds.length - a.memoryIds.length)) {
    const point = at(place);
    if (!point) continue;
    const near = groups.find((g) => Math.hypot(g.x - point[0], g.y - point[1]) <= radius);
    if (near) near.places.push(place);
    else groups.push({ x: point[0], y: point[1], places: [place] });
  }
  return finish(groups);
}

export function clusterLabel(cluster: PlaceCluster): string {
  if (cluster.places.length === 1) return cluster.places[0]!.name;
  const first = cluster.places[0]!.name.split(',')[0];
  return `${first} and ${cluster.places.length - 1} more`;
}

export function clusterTint(cluster: PlaceCluster, cards: Map<string, MemoryCardDto>): string {
  const tally = new Map<string, number>();
  for (const place of cluster.places)
    for (const id of place.memoryIds)
      for (const e of cards.get(id)?.emotions ?? [])
        if (e.phase === 'then') tally.set(e.tag, (tally.get(e.tag) ?? 0) + 1);
  const top = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return top ? emotionMeta(top).ink : '#e9d5ff';
}

let countries: Promise<FeatureCollection<Geometry>> | null = null;

function solid(ring: number[][]) {
  return new Set(ring.map((point) => point.join(','))).size >= 3;
}

function tidy(collection: FeatureCollection<Geometry>): FeatureCollection<Geometry> {
  for (const item of collection.features) {
    if (item.geometry.type === 'MultiPolygon')
      item.geometry.coordinates = item.geometry.coordinates.filter((poly) => solid(poly[0]!));
  }
  return collection;
}

export function loadCountries(): Promise<FeatureCollection<Geometry>> {
  countries ??= Promise.all([
    import('world-atlas/countries-110m.json'),
    import('topojson-client'),
  ]).then(([atlas, { feature }]) => {
    const topology = (atlas.default ?? atlas) as unknown as Parameters<typeof feature>[0];
    return tidy(
      feature(
        topology,
        (topology as unknown as { objects: { countries: Parameters<typeof feature>[1] } }).objects
          .countries,
      ) as unknown as FeatureCollection<Geometry>,
    );
  });
  return countries;
}
