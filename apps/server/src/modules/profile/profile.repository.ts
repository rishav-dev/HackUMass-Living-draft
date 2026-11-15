import type { ProfileDto, ProfileInput, ProfileUpdate } from '@living-draft/contracts';
import { ageOnDate } from '@living-draft/engine';
import { get, run } from '../../db/database';
import { HttpError, newId, now } from '../../lib/http';

interface ProfileRow {
  id: string;
  preferred_name: string;
  current_age: number;
  age_recorded_on: string;
  birth_date: string | null;
  gender: string | null;
  pronouns: string | null;
  full_name?: string | null;
  sex?: string | null;
  birth_place?: string | null;
  hemisphere: ProfileDto['hemisphere'];
  date_order: ProfileDto['dateOrder'];
  narrative_voice: ProfileDto['narrativeVoice'];
  motion: ProfileDto['motion'];
  density: ProfileDto['density'];
  keep_audio: number;
  sound_effects: number;
  ambient_sound: number;
  volume: number;
  art_online: number;
  art_daily_limit: number;
  auto_lock_minutes: number;
  place_name: string | null;
  place_lat: number | null;
  place_lon: number | null;
  weather_on: number;
  temp_unit: 'auto' | 'c' | 'f';
  location_mode?: 'home' | 'travel' | 'off';
  is_sample: number;
  created_at: string;
}

const MS_PER_YEAR = 365.2425 * 24 * 3600 * 1000;

function effectiveAge(row: ProfileRow, today = new Date()): number {
  if (row.birth_date) return ageOnDate(row.birth_date, today);
  const recorded = new Date(row.age_recorded_on);
  const elapsed = Math.floor((today.getTime() - recorded.getTime()) / MS_PER_YEAR);
  return row.current_age + Math.max(0, elapsed);
}

function toDto(row: ProfileRow): ProfileDto {
  return {
    id: row.id,
    preferredName: row.preferred_name,
    currentAge: effectiveAge(row),
    birthDate: row.birth_date,
    gender: row.gender,
    pronouns: row.pronouns,
    fullName: row.full_name ?? null,
    sex: row.sex ?? null,
    birthPlace: row.birth_place ?? null,
    hemisphere: row.hemisphere,
    dateOrder: row.date_order,
    narrativeVoice: row.narrative_voice,
    motion: row.motion,
    density: row.density,
    keepAudio: !!row.keep_audio,
    soundEffects: !!row.sound_effects,
    ambientSound: !!row.ambient_sound,
    volume: row.volume,
    artOnline: !!row.art_online,
    artDailyLimit: row.art_daily_limit,
    autoLockMinutes: row.auto_lock_minutes,
    placeName: row.place_name,
    placeLat: row.place_lat,
    placeLon: row.place_lon,
    weatherOn: !!row.weather_on,
    tempUnit: row.temp_unit ?? 'auto',
    locationMode: row.location_mode ?? 'home',
    isSample: !!row.is_sample,
    createdAt: row.created_at,
  };
}

export function findProfile(): ProfileDto | null {
  const row = get<ProfileRow>('SELECT * FROM profile LIMIT 1');
  return row ? toDto(row) : null;
}

export function requireProfile(): ProfileDto {
  const profile = findProfile();
  if (!profile) throw new HttpError(409, 'Set up your profile first');
  return profile;
}

export function createProfile(
  input: ProfileInput,
  options: { isSample?: boolean } = {},
): ProfileDto {
  const id = newId();
  const timestamp = now();
  const currentAge = input.birthDate ? ageOnDate(input.birthDate, new Date()) : input.currentAge;
  run(
    `INSERT INTO profile (id, preferred_name, current_age, age_recorded_on, birth_date, gender, pronouns, full_name,
      sex, birth_place, place_name, hemisphere, date_order, narrative_voice, motion, density, keep_audio,
      sound_effects, ambient_sound, volume, is_sample, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    input.preferredName,
    currentAge,
    timestamp.slice(0, 10),
    input.birthDate ?? null,
    input.gender ?? null,
    input.pronouns ?? null,
    input.fullName ?? null,
    input.sex ?? null,
    input.birthPlace ?? null,
    input.placeName ?? null,
    input.hemisphere ?? 'unknown',
    input.dateOrder ?? 'mdy',
    input.narrativeVoice ?? 'first',
    input.motion ?? 'system',
    input.density ?? 'rich',
    input.keepAudio ?? true,
    input.soundEffects ?? true,
    input.ambientSound ?? true,
    input.volume ?? 0.6,
    options.isSample ?? false,
    timestamp,
    timestamp,
  );
  run(
    "INSERT INTO books (id, kind, title, created_at) VALUES (?, 'life', 'Life Book', ?)",
    newId(),
    timestamp,
  );
  return findProfile()!;
}

const COLUMNS: Record<keyof ProfileUpdate, string> = {
  preferredName: 'preferred_name',
  currentAge: 'current_age',
  birthDate: 'birth_date',
  gender: 'gender',
  pronouns: 'pronouns',
  fullName: 'full_name',
  sex: 'sex',
  birthPlace: 'birth_place',
  hemisphere: 'hemisphere',
  dateOrder: 'date_order',
  narrativeVoice: 'narrative_voice',
  motion: 'motion',
  density: 'density',
  keepAudio: 'keep_audio',
  soundEffects: 'sound_effects',
  ambientSound: 'ambient_sound',
  volume: 'volume',
  artOnline: 'art_online',
  artDailyLimit: 'art_daily_limit',
  autoLockMinutes: 'auto_lock_minutes',
  placeName: 'place_name',
  placeLat: 'place_lat',
  placeLon: 'place_lon',
  weatherOn: 'weather_on',
  tempUnit: 'temp_unit',
  locationMode: 'location_mode',
};

export function updateProfile(update: ProfileUpdate): ProfileDto {
  const profile = requireProfile();
  const sets: string[] = [];
  const values: Array<string | number | boolean | null> = [];
  for (const [key, value] of Object.entries(update) as Array<[keyof ProfileUpdate, unknown]>) {
    if (value === undefined) continue;
    sets.push(`${COLUMNS[key]} = ?`);
    values.push(value as string | number | boolean | null);
  }
  if (update.currentAge !== undefined) {
    sets.push('age_recorded_on = ?');
    values.push(now().slice(0, 10));
  }
  if (sets.length) {
    sets.push('updated_at = ?');
    values.push(now());
    run(`UPDATE profile SET ${sets.join(', ')} WHERE id = ?`, ...values, profile.id);
  }
  return findProfile()!;
}

export function lifeBookId(): string {
  const row = get<{ id: string }>("SELECT id FROM books WHERE kind = 'life' LIMIT 1");
  if (!row) throw new Error('Life book missing');
  return row.id;
}
