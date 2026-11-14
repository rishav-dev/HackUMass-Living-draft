import type { Hemisphere, Season } from '../types';

export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

const NORTH: Record<Season, number[]> = {
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  autumn: [9, 10, 11],
  winter: [12, 1, 2],
};

export function monthsForSeason(season: Season, hemisphere: Hemisphere | undefined): number[] {
  if (hemisphere === 'north') return NORTH[season];
  if (hemisphere === 'south') return NORTH[season].map((m) => ((m + 5) % 12) + 1);
  return [];
}

export function seasonForMonth(month: number, hemisphere: Hemisphere | undefined): Season | null {
  if (hemisphere !== 'north' && hemisphere !== 'south') return null;
  return SEASONS.find((season) => monthsForSeason(season, hemisphere).includes(month)) ?? null;
}

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function ageOnDate(birthDate: string, on: Date): number {
  const birth = parseIsoDate(birthDate);
  if (!birth) return NaN;
  let age = on.getUTCFullYear() - birth.getUTCFullYear();
  const beforeBirthday =
    on.getUTCMonth() < birth.getUTCMonth() ||
    (on.getUTCMonth() === birth.getUTCMonth() && on.getUTCDate() < birth.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export interface AgeProfile {
  today: Date;
  currentAge: number;
  birthDate?: string | null;
}

const MS_PER_YEAR = 365.2425 * 24 * 60 * 60 * 1000;

function ageBoundsOn(date: Date, profile: AgeProfile): [number, number] {
  if (profile.birthDate) {
    const age = ageOnDate(profile.birthDate, date);
    return [age, age];
  }
  const yearsBefore = (profile.today.getTime() - date.getTime()) / MS_PER_YEAR;
  const low = Math.floor(profile.currentAge - yearsBefore);
  const high = Math.ceil(profile.currentAge + 1 - yearsBefore) - 1;
  return [low, Math.max(low, high)];
}

export function ageRangeForInterval(
  start: Date,
  end: Date,
  profile: AgeProfile,
): { ageMin: number; ageMax: number } {
  const [startLow] = ageBoundsOn(start, profile);
  const [, endHigh] = ageBoundsOn(end, profile);
  return { ageMin: Math.max(0, startLow), ageMax: Math.max(0, endHigh) };
}

export function monthInterval(year: number, month: number): [Date, Date] {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return [start, end];
}

export function yearInterval(year: number): [Date, Date] {
  return [new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year, 11, 31))];
}

export function chapterDateRange(
  birthDate: string | null | undefined,
  age: number,
): { start: string; end: string } | null {
  const birth = parseIsoDate(birthDate);
  if (!birth) return null;
  const start = new Date(
    Date.UTC(birth.getUTCFullYear() + age, birth.getUTCMonth(), birth.getUTCDate()),
  );
  const end = new Date(
    Date.UTC(birth.getUTCFullYear() + age + 1, birth.getUTCMonth(), birth.getUTCDate() - 1),
  );
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? '';
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
