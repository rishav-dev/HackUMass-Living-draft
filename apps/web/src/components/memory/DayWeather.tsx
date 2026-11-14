import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  MapPin,
  Snowflake,
  Sun,
} from 'lucide-react';
import type { DayWeatherDto } from '@living-draft/contracts';
import { dayWeatherSentence, type TempUnit, type WeatherKind } from '@living-draft/engine';

const ICONS: Record<WeatherKind, typeof Sun> = {
  clear: Sun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: Snowflake,
  storm: CloudLightning,
};

export function DayWeather({
  weather,
  unit,
  onAddPlace,
  compact = false,
}: {
  weather: DayWeatherDto;
  unit: TempUnit;
  onAddPlace?: () => void;
  compact?: boolean;
}) {
  if (weather.status === 'off' || weather.status === 'no_date') return null;
  if (weather.status === 'no_place') {
    if (!onAddPlace) return null;
    return (
      <button
        type="button"
        onClick={onAddPlace}
        className="hand inline-flex items-center gap-1.5 text-lg text-ink-faint transition hover:text-ink-soft"
      >
        <MapPin className="size-4" aria-hidden="true" /> add where this happened to see that day's
        weather
      </button>
    );
  }
  if (weather.status === 'too_recent')
    return (
      <p className="hand text-lg text-ink-faint">
        The weather records for that day aren't in yet. Check back in a few days.
      </p>
    );
  if (weather.status === 'not_found')
    return (
      <p className="hand text-lg text-ink-faint">
        I couldn't find “{weather.place}” on a map. Adding the state or country usually helps.
      </p>
    );
  const kind = (weather.kind ?? 'cloudy') as WeatherKind;
  const Icon = ICONS[kind];
  const sentence = dayWeatherSentence(weather, weather.place ?? '', unit);
  if (compact)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-snow/70">
        <Icon className="size-4 shrink-0" aria-hidden="true" /> {sentence}
      </p>
    );
  return (
    <figure className="paper flex items-start gap-3 rounded-2xl p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/6">
        <Icon className="size-5 text-mist-deep" aria-hidden="true" />
      </span>
      <div>
        <p className="eyebrow">that day</p>
        <p className="mt-1 text-[0.97rem]">{sentence}</p>
        <figcaption className="mt-1 text-xs text-ink-faint">
          From Open-Meteo's weather archive, not from the memory itself.
        </figcaption>
      </div>
    </figure>
  );
}
