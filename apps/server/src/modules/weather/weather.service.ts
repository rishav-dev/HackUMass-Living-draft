import type { DayWeatherDto, PlaceDto, WeatherNowDto } from '@living-draft/contracts';
import { weatherFromCode } from '@living-draft/engine';
import { get, run } from '../../db/database';
import { HttpError, now } from '../../lib/http';
import { Archive } from '../archive/snapshot';
import { findProfile } from '../profile/profile.repository';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const NOW_TTL_MS = 15 * 60_000;
const ARCHIVE_DELAY_DAYS = 6;

interface WeatherRow {
  memory_id: string;
  status: DayWeatherDto['status'];
  place: string | null;
  date: string | null;
  code: number | null;
  temp_max: number | null;
  temp_min: number | null;
  precipitation: number | null;
}

let current: { key: string; at: number; value: WeatherNowDto } | null = null;

const round = (value: number) => Math.round(value * 10) / 10;

async function getJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`Weather service answered ${response.status}`);
    return (await response.json()) as T;
  } catch {
    throw new HttpError(503, "The weather service can't be reached right now. Try again in a bit.");
  } finally {
    clearTimeout(timer);
  }
}

export async function weatherNow(
  here?: { lat: number; lon: number } | null,
): Promise<WeatherNowDto | null> {
  const profile = findProfile();
  if (!profile?.weatherOn) return null;
  const travelling = profile.locationMode === 'travel' && here;
  if (!travelling && (profile.placeLat === null || profile.placeLon === null)) return null;
  const lat = round(travelling ? here.lat : profile.placeLat!);
  const lon = round(travelling ? here.lon : profile.placeLon!);
  const away =
    travelling &&
    (profile.placeLat === null ||
      profile.placeLon === null ||
      Math.abs(lat - profile.placeLat) > 0.3 ||
      Math.abs(lon - profile.placeLon) > 0.3);
  const key = `${lat},${lon}`;
  if (current && current.key === key && Date.now() - current.at < NOW_TTL_MS) return current.value;
  const data = await getJson<{
    current: { time: string; temperature_2m: number; weather_code: number; is_day: number };
    daily?: { sunrise?: string[]; sunset?: string[] };
  }>(
    `${FORECAST}?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`,
  );
  const reading = weatherFromCode(data.current.weather_code);
  const value: WeatherNowDto = {
    place: away ? 'where you are now' : (profile.placeName ?? 'your area'),
    code: data.current.weather_code,
    kind: reading.kind,
    label: reading.label,
    temperature: data.current.temperature_2m,
    isDay: data.current.is_day === 1,
    sunrise: data.daily?.sunrise?.[0] ?? null,
    sunset: data.daily?.sunset?.[0] ?? null,
    observedAt: data.current.time,
  };
  current = { key, at: Date.now(), value };
  return value;
}

export async function searchPlaces(query: string): Promise<PlaceDto[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const data = await getJson<{
    results?: Array<{
      name: string;
      admin1?: string;
      country?: string;
      latitude: number;
      longitude: number;
    }>;
  }>(`${GEOCODE}?name=${encodeURIComponent(q)}&count=6&language=en&format=json`);
  return (data.results ?? []).map((r) => ({
    name: r.name,
    region: r.admin1 ?? null,
    country: r.country ?? null,
    lat: r.latitude,
    lon: r.longitude,
    label: [r.name, r.admin1, r.country].filter(Boolean).join(', '),
  }));
}

async function locate(place: string): Promise<{ name: string; lat: number; lon: number } | null> {
  const key = place.trim().toLowerCase();
  const cached = get<{ name: string | null; lat: number | null; lon: number | null }>(
    'SELECT name, lat, lon FROM place_cache WHERE query = ?',
    key,
  );
  if (cached)
    return cached.name && cached.lat !== null && cached.lon !== null
      ? { name: cached.name, lat: cached.lat, lon: cached.lon }
      : null;
  const [first, ...rest] = place.split(',').map((part) => part.trim());
  const results = await searchPlaces(first ?? place);
  const hint = rest.join(' ').toLowerCase();
  const best =
    (hint &&
      results.find((r) =>
        hint
          .split(/\s+/)
          .some((word) => `${r.region ?? ''} ${r.country ?? ''}`.toLowerCase().includes(word)),
      )) ||
    results[0] ||
    null;
  run(
    'INSERT OR REPLACE INTO place_cache (query, name, lat, lon, fetched_at) VALUES (?, ?, ?, ?, ?)',
    key,
    best?.label ?? null,
    best ? round(best.lat) : null,
    best ? round(best.lon) : null,
    now(),
  );
  return best ? { name: best.label, lat: round(best.lat), lon: round(best.lon) } : null;
}

function toDto(row: WeatherRow): DayWeatherDto {
  const reading = row.code !== null ? weatherFromCode(row.code) : null;
  return {
    status: row.status,
    place: row.place,
    date: row.date,
    code: row.code,
    kind: reading?.kind ?? null,
    label: reading?.label ?? null,
    tempMax: row.temp_max,
    tempMin: row.temp_min,
    precipitation: row.precipitation,
  };
}

const empty = (
  status: DayWeatherDto['status'],
  place: string | null = null,
  date: string | null = null,
): DayWeatherDto => ({
  status,
  place,
  date,
  code: null,
  kind: null,
  label: null,
  tempMax: null,
  tempMin: null,
  precipitation: null,
});

export function cachedDayWeather(memoryId: string): DayWeatherDto | null {
  const row = get<WeatherRow>('SELECT * FROM memory_weather WHERE memory_id = ?', memoryId);
  return row && row.status === 'ok' ? toDto(row) : null;
}

export function forgetDayWeather(memoryId: string) {
  run('DELETE FROM memory_weather WHERE memory_id = ?', memoryId);
}

export async function dayWeather(memoryId: string): Promise<DayWeatherDto> {
  const profile = findProfile();
  if (!profile?.weatherOn) return empty('off');
  const archive = Archive.load();
  const memory = archive.memory(memoryId);
  if (!memory) throw new HttpError(404, 'Memory not found');
  const cached = get<WeatherRow>('SELECT * FROM memory_weather WHERE memory_id = ?', memoryId);
  if (cached) return toDto(cached);

  const temporal = archive.temporal(memoryId);
  if (temporal.precision !== 'exact' || !temporal.year || !temporal.month || !temporal.day)
    return empty('no_date');
  const date = `${temporal.year}-${String(temporal.month).padStart(2, '0')}-${String(temporal.day).padStart(2, '0')}`;
  if (!memory.place) return empty('no_place', null, date);
  if (Date.now() - new Date(`${date}T12:00:00Z`).getTime() < ARCHIVE_DELAY_DAYS * 864e5)
    return empty('too_recent', memory.place, date);

  const found = await locate(memory.place);
  const store = (row: Omit<WeatherRow, 'memory_id'>) => {
    run(
      `INSERT OR REPLACE INTO memory_weather (memory_id, status, place, date, code, temp_max, temp_min, precipitation, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      memoryId,
      row.status,
      row.place,
      row.date,
      row.code,
      row.temp_max,
      row.temp_min,
      row.precipitation,
      now(),
    );
    return toDto({ memory_id: memoryId, ...row });
  };
  if (!found)
    return store({
      status: 'not_found',
      place: memory.place,
      date,
      code: null,
      temp_max: null,
      temp_min: null,
      precipitation: null,
    });

  const data = await getJson<{
    daily?: {
      weather_code?: Array<number | null>;
      temperature_2m_max?: Array<number | null>;
      temperature_2m_min?: Array<number | null>;
      precipitation_sum?: Array<number | null>;
    };
  }>(
    `${ARCHIVE}?latitude=${found.lat}&longitude=${found.lon}&start_date=${date}&end_date=${date}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`,
  );
  const code = data.daily?.weather_code?.[0] ?? null;
  return store({
    status: code === null ? 'not_found' : 'ok',
    place: memory.place,
    date,
    code,
    temp_max: data.daily?.temperature_2m_max?.[0] ?? null,
    temp_min: data.daily?.temperature_2m_min?.[0] ?? null,
    precipitation: data.daily?.precipitation_sum?.[0] ?? null,
  });
}
