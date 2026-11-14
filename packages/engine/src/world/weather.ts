export type WeatherKind = 'clear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'storm';
export type DayPart = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
export type TempUnit = 'c' | 'f';

export interface WeatherReading {
  kind: WeatherKind;
  label: string;
}

const CODES: Array<[number[], WeatherKind, string]> = [
  [[0], 'clear', 'clear'],
  [[1], 'clear', 'mostly clear'],
  [[2], 'cloudy', 'partly cloudy'],
  [[3], 'cloudy', 'overcast'],
  [[45, 48], 'fog', 'foggy'],
  [[51, 53, 55], 'drizzle', 'drizzly'],
  [[56, 57], 'drizzle', 'freezing drizzle'],
  [[61, 80], 'rain', 'light rain'],
  [[63, 81], 'rain', 'raining'],
  [[65, 82], 'rain', 'pouring'],
  [[66, 67], 'rain', 'freezing rain'],
  [[71, 85], 'snow', 'light snow'],
  [[73, 75, 77, 86], 'snow', 'snowing'],
  [[95], 'storm', 'thunderstorms'],
  [[96, 99], 'storm', 'thunderstorms and hail'],
];

export function weatherFromCode(code: number | null | undefined): WeatherReading {
  for (const [codes, kind, label] of CODES)
    if (code !== null && code !== undefined && codes.includes(code)) return { kind, label };
  return { kind: 'cloudy', label: 'unsettled' };
}

export function dayPart(now: Date, sun?: { sunrise: Date; sunset: Date } | null): DayPart {
  if (sun) {
    const t = now.getTime();
    const rise = sun.sunrise.getTime();
    const set = sun.sunset.getTime();
    const hour = 3_600_000;
    if (t >= rise - 0.75 * hour && t < rise + hour) return 'dawn';
    if (t >= set - hour && t < set + 1.25 * hour) return 'evening';
    if (t < rise - 0.75 * hour || t >= set + 1.25 * hour) return 'night';
    return now.getHours() < 12 ? 'morning' : 'afternoon';
  }
  const h = now.getHours();
  if (h >= 5 && h < 8) return 'dawn';
  if (h >= 8 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export function feelOf(celsius: number): string {
  if (celsius < -5) return 'freezing';
  if (celsius < 5) return 'cold';
  if (celsius < 12) return 'chilly';
  if (celsius < 20) return 'mild';
  if (celsius < 27) return 'warm';
  return 'hot';
}

export function formatTemp(celsius: number, unit: TempUnit): string {
  return unit === 'f' ? `${Math.round((celsius * 9) / 5 + 32)}°F` : `${Math.round(celsius)}°C`;
}

const ADJECTIVE: Record<WeatherKind, string> = {
  clear: 'clear',
  cloudy: 'grey',
  fog: 'foggy',
  drizzle: 'drizzly',
  rain: 'rainy',
  snow: 'snowy',
  storm: 'stormy',
};

export function momentPhrase(
  part: DayPart,
  weather?: { kind: WeatherKind; temperature: number; isDay: boolean } | null,
): string {
  if (!weather)
    return part === 'night'
      ? 'a quiet night'
      : part === 'dawn'
        ? 'an early morning'
        : `a quiet ${part}`;
  const sunny = weather.kind === 'clear' && weather.isDay ? 'sunny' : ADJECTIVE[weather.kind];
  const feel = feelOf(weather.temperature);
  const extra =
    (feel === 'cold' || feel === 'freezing' || feel === 'hot') && sunny !== feel
      ? `${sunny}, ${feel}`
      : sunny;
  const time = part === 'dawn' ? 'morning' : part;
  return `${/^[aeiou]/.test(extra) ? 'an' : 'a'} ${extra} ${time}`;
}

export function greetingLine(
  part: DayPart,
  name: string,
  weather?: { kind: WeatherKind; temperature: number; isDay: boolean } | null,
): string {
  const phrase = momentPhrase(part, weather).replace(/^(a|an) /, '');
  const opener = phrase.charAt(0).toUpperCase() + phrase.slice(1);
  return `${opener}, ${name}`;
}

export function dayWeatherSentence(
  record: {
    code: number | null;
    tempMax: number | null;
    tempMin: number | null;
    precipitation: number | null;
  },
  place: string,
  unit: TempUnit,
): string {
  const { kind, label } = weatherFromCode(record.code);
  const town = place.split(',')[0]!.trim();
  const sky =
    kind === 'clear'
      ? 'a clear day'
      : kind === 'cloudy'
        ? label === 'overcast'
          ? 'an overcast day'
          : 'a partly cloudy day'
        : kind === 'fog'
          ? 'a foggy day'
          : kind === 'drizzle'
            ? 'a drizzly day'
            : kind === 'rain'
              ? (record.precipitation ?? 0) > 15
                ? 'a day of heavy rain'
                : 'a rainy day'
              : kind === 'snow'
                ? 'a snowy day'
                : 'a day of thunderstorms';
  const range =
    record.tempMax !== null && record.tempMin !== null
      ? `, between ${formatTemp(record.tempMin, unit)} and ${formatTemp(record.tempMax, unit)}`
      : '';
  return `Weather records for ${town} show ${sky}${range}.`;
}

export function weatherTexture(kind: WeatherKind | null | undefined): string | null {
  if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') return 'rain';
  if (kind === 'snow') return 'bells';
  if (kind === 'fog' || kind === 'cloudy') return 'wind';
  return null;
}

export function weatherParticles(
  kind: WeatherKind | null | undefined,
): 'rain' | 'snow' | 'dust' | null {
  if (kind === 'rain' || kind === 'drizzle' || kind === 'storm') return 'rain';
  if (kind === 'snow') return 'snow';
  if (kind === 'fog') return 'dust';
  return null;
}

export interface MomentPrompt {
  id: string;
  text: string;
}

export function momentPrompts(part: DayPart, kind?: WeatherKind | null): MomentPrompt[] {
  const prompts: MomentPrompt[] = [];
  if (kind === 'rain' || kind === 'drizzle')
    prompts.push({
      id: 'now-rain',
      text: "It's raining out. Is there a rainy day that stayed with you?",
    });
  if (kind === 'storm')
    prompts.push({
      id: 'now-storm',
      text: 'A storm tonight. Do you remember another one? Where were you?',
    });
  if (kind === 'snow')
    prompts.push({
      id: 'now-snow',
      text: "There's snow outside. What's the first snow you remember?",
    });
  if (kind === 'fog')
    prompts.push({ id: 'now-fog', text: 'Foggy out. Is there a memory you only half remember?' });
  if (kind === 'clear' && (part === 'morning' || part === 'afternoon'))
    prompts.push({
      id: 'now-sun',
      text: "It's bright out. What's a sunny afternoon you'd go back to?",
    });
  if (part === 'dawn')
    prompts.push({
      id: 'now-dawn',
      text: 'Early start. What did mornings sound like at home when you were small?',
    });
  if (part === 'evening')
    prompts.push({
      id: 'now-evening',
      text: 'Evenings bring things back. What did dinner look like growing up?',
    });
  if (part === 'night')
    prompts.push({ id: 'now-night', text: "It's late. Is there a night you still think about?" });
  return prompts.slice(0, 2);
}

export function writtenOnPhrase(context: {
  part: DayPart;
  weekday: string;
  weatherKind: string | null;
  temperature: number | null;
  place: string | null;
}): string {
  const kind = context.weatherKind as WeatherKind | null;
  const phrase = momentPhrase(
    context.part,
    kind ? { kind, temperature: context.temperature ?? 15, isDay: context.part !== 'night' } : null,
  );
  const withDay = phrase.replace(/(morning|afternoon|evening|night)$/, `${context.weekday} $1`);
  const town = context.place?.split(',')[0]?.trim();
  return `on ${withDay}${town ? ` in ${town}` : ''}`;
}
