import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { WeatherNowDto } from '@living-draft/contracts';
import { dayPart, weatherTexture, type TempUnit, type WeatherKind } from '@living-draft/engine';
import { api } from '../../api/client';
import { useProfile } from '../../api/hooks';
import { sound } from '../sound/engine';
import { readLocal } from '../storage';
import { fallbackUnit, WEATHER_KEY, WorldContext, type World } from './world';

export function WorldProvider({ children }: { children: ReactNode }) {
  const { data: profile } = useProfile();
  const [now, setNow] = useState(() => new Date());
  const [intoRoom, setIntoRoom] = useState(() => readLocal('weather-room') !== 'false');
  const enabled = Boolean(
    profile?.weatherOn && profile.placeLat !== null && profile.placeLon !== null,
  );
  const { data: weather } = useQuery({
    queryKey: [...WEATHER_KEY, profile?.placeLat, profile?.placeLon],
    queryFn: () => api.get<WeatherNowDto | null>('/weather/now'),
    enabled,
    staleTime: 10 * 60_000,
    refetchInterval: 15 * 60_000,
    retry: 0,
  });

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), 60_000);
    const onRoom = () => setIntoRoom(readLocal('weather-room') !== 'false');
    window.addEventListener('living-draft:room', onRoom);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener('living-draft:room', onRoom);
    };
  }, []);

  const current = enabled ? (weather ?? null) : null;
  const sun =
    current?.sunrise && current.sunset
      ? { sunrise: new Date(current.sunrise), sunset: new Date(current.sunset) }
      : null;
  const part = dayPart(now, sun);
  const kind = (current?.kind as WeatherKind | undefined) ?? null;
  const unit: TempUnit =
    profile?.tempUnit === 'c' || profile?.tempUnit === 'f' ? profile.tempUnit : fallbackUnit();

  useEffect(() => {
    document.documentElement.dataset.daypart = part;
    if (kind && intoRoom) document.documentElement.dataset.weather = kind;
    else delete document.documentElement.dataset.weather;
  }, [part, kind, intoRoom]);

  useEffect(() => {
    sound.setRoom({ part, texture: intoRoom ? weatherTexture(kind) : null });
  }, [part, kind, intoRoom]);

  const value = useMemo<World>(
    () => ({
      now,
      part,
      weather: current,
      kind,
      unit,
      place: enabled ? (profile?.placeName ?? null) : null,
      intoRoom,
      context: () => ({
        part: dayPart(new Date(), sun),
        weekday: new Date().toLocaleDateString(undefined, { weekday: 'long' }),
        weatherKind: current?.kind ?? null,
        weatherLabel: current?.label ?? null,
        temperature: current ? Math.round(current.temperature * 10) / 10 : null,
        place: enabled ? (profile?.placeName ?? null) : null,
      }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [now, part, current, kind, unit, enabled, profile?.placeName, intoRoom],
  );

  return <WorldContext.Provider value={value}>{children}</WorldContext.Provider>;
}
