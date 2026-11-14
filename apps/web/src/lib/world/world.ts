import { createContext, useContext } from 'react';
import type { CaptureContextDto, WeatherNowDto } from '@living-draft/contracts';
import { dayPart, type DayPart, type TempUnit, type WeatherKind } from '@living-draft/engine';

export interface World {
  now: Date;
  part: DayPart;
  weather: WeatherNowDto | null;
  kind: WeatherKind | null;
  unit: TempUnit;
  place: string | null;
  intoRoom: boolean;
  context: () => CaptureContextDto;
}

export const fallbackUnit = (): TempUnit =>
  /-(US|LR|MM)$/i.test(typeof navigator === 'undefined' ? '' : navigator.language) ? 'f' : 'c';

export const WorldContext = createContext<World>({
  now: new Date(),
  part: dayPart(new Date()),
  weather: null,
  kind: null,
  unit: fallbackUnit(),
  place: null,
  intoRoom: true,
  context: () => ({
    part: dayPart(new Date()),
    weekday: new Date().toLocaleDateString(undefined, { weekday: 'long' }),
    weatherKind: null,
    weatherLabel: null,
    temperature: null,
    place: null,
  }),
});

export const WEATHER_KEY = ['world', 'weather'] as const;

export function useWorld(): World {
  return useContext(WorldContext);
}
