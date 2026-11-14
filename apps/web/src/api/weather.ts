import { useQuery } from '@tanstack/react-query';
import type { DayWeatherDto, PlaceDto } from '@living-draft/contracts';
import { api } from './client';

export function useDayWeather(memoryId: string, enabled: boolean, version = '') {
  return useQuery({
    queryKey: ['day-weather', memoryId, version],
    queryFn: () => api.get<DayWeatherDto>(`/weather/memory/${memoryId}`),
    enabled,
    staleTime: Infinity,
    retry: 0,
  });
}

export function searchPlaces(query: string) {
  return api.get<PlaceDto[]>(`/places?q=${encodeURIComponent(query)}`);
}
