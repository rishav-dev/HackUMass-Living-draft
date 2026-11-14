import { describe, expect, it } from 'vitest';
import {
  dayPart,
  dayWeatherSentence,
  greetingLine,
  momentPrompts,
  weatherFromCode,
  weatherParticles,
  writtenOnPhrase,
} from '../src';

describe('weather and time of day', () => {
  it('reads WMO codes as plain weather', () => {
    expect(weatherFromCode(0)).toEqual({ kind: 'clear', label: 'clear' });
    expect(weatherFromCode(63).kind).toBe('rain');
    expect(weatherFromCode(75).kind).toBe('snow');
    expect(weatherFromCode(99).label).toBe('thunderstorms and hail');
    expect(weatherParticles(weatherFromCode(53).kind)).toBe('rain');
  });

  it('uses real sunrise and sunset when it has them', () => {
    const sun = { sunrise: new Date('2026-11-14T06:39'), sunset: new Date('2026-11-14T16:28') };
    expect(dayPart(new Date('2026-11-14T06:50'), sun)).toBe('dawn');
    expect(dayPart(new Date('2026-11-14T10:00'), sun)).toBe('morning');
    expect(dayPart(new Date('2026-11-14T16:00'), sun)).toBe('evening');
    expect(dayPart(new Date('2026-11-14T19:30'), sun)).toBe('night');
    expect(dayPart(new Date('2026-11-14T13:00'))).toBe('afternoon');
  });

  it('greets you with the moment in natural words', () => {
    expect(greetingLine('evening', 'Kinjal', { kind: 'rain', temperature: 8, isDay: false })).toBe(
      'Rainy evening, Kinjal',
    );
    expect(greetingLine('night', 'Kinjal', { kind: 'clear', temperature: 1, isDay: false })).toBe(
      'Clear, cold night, Kinjal',
    );
    expect(
      greetingLine('afternoon', 'Kinjal', { kind: 'clear', temperature: 22, isDay: true }),
    ).toBe('Sunny afternoon, Kinjal');
    expect(greetingLine('night', 'Kinjal')).toBe('Quiet night, Kinjal');
  });

  it('labels the past as records, never as the memory', () => {
    expect(
      dayWeatherSentence(
        { code: 3, tempMax: 22, tempMin: 16.8, precipitation: 0 },
        'Boston, Massachusetts',
        'f',
      ),
    ).toBe('Weather records for Boston show an overcast day, between 62°F and 72°F.');
  });

  it('suggests prompts that fit the moment', () => {
    expect(momentPrompts('night', 'rain').map((p) => p.id)).toEqual(['now-rain', 'now-night']);
    expect(momentPrompts('afternoon', 'clear')[0]?.id).toBe('now-sun');
  });

  it('remembers when and where each telling was written', () => {
    expect(
      writtenOnPhrase({
        part: 'evening',
        weekday: 'Saturday',
        weatherKind: 'rain',
        temperature: 8,
        place: 'Amherst, Massachusetts',
      }),
    ).toBe('on a rainy Saturday evening in Amherst');
    expect(
      writtenOnPhrase({
        part: 'dawn',
        weekday: 'Monday',
        weatherKind: null,
        temperature: null,
        place: null,
      }),
    ).toBe('on an early Monday morning');
  });
});
