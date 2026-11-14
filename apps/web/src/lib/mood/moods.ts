export type MoodKey =
  | 'cosmos'
  | 'studio'
  | 'happy'
  | 'excited'
  | 'peaceful'
  | 'nostalgic'
  | 'grateful'
  | 'proud'
  | 'sad'
  | 'disappointed'
  | 'angry'
  | 'anxious'
  | 'confused';

export type Weather =
  | 'stars'
  | 'bubbles'
  | 'sparks'
  | 'fireflies'
  | 'dust'
  | 'petals'
  | 'rain'
  | 'embers'
  | 'snow'
  | 'leaves';

export interface MoodLook {
  palette: [string, string, string];
  energy: number;
  flicker: number;
  warp: number;
  brightness: number;
  weather: Weather;
  label: string;
}

export const MOODS: Record<MoodKey, MoodLook> = {
  cosmos: {
    palette: ['#120a2e', '#4c1d95', '#0ea5e9'],
    energy: 0.3,
    flicker: 0,
    warp: 0.4,
    brightness: 0.55,
    weather: 'stars',
    label: 'Drifting',
  },
  studio: {
    palette: ['#0f0a24', '#3b1f75', '#be185d'],
    energy: 0.18,
    flicker: 0,
    warp: 0.3,
    brightness: 0.45,
    weather: 'dust',
    label: 'Listening',
  },
  happy: {
    palette: ['#3b1405', '#f97316', '#facc15'],
    energy: 0.72,
    flicker: 0,
    warp: 0.55,
    brightness: 0.75,
    weather: 'bubbles',
    label: 'Bright',
  },
  excited: {
    palette: ['#3a0420', '#ff2e88', '#ffd60a'],
    energy: 1,
    flicker: 0.12,
    warp: 0.8,
    brightness: 0.85,
    weather: 'sparks',
    label: 'Electric',
  },
  peaceful: {
    palette: ['#021b1a', '#0d9488', '#a7f3d0'],
    energy: 0.16,
    flicker: 0,
    warp: 0.25,
    brightness: 0.6,
    weather: 'fireflies',
    label: 'Still',
  },
  nostalgic: {
    palette: ['#1f1206', '#b45309', '#fde3b0'],
    energy: 0.26,
    flicker: 0.05,
    warp: 0.35,
    brightness: 0.62,
    weather: 'dust',
    label: 'Golden',
  },
  grateful: {
    palette: ['#2a0a24', '#db2777', '#fde68a'],
    energy: 0.32,
    flicker: 0,
    warp: 0.4,
    brightness: 0.68,
    weather: 'petals',
    label: 'Warm',
  },
  proud: {
    palette: ['#16123f', '#d97706', '#c084fc'],
    energy: 0.58,
    flicker: 0,
    warp: 0.5,
    brightness: 0.72,
    weather: 'sparks',
    label: 'Rising',
  },
  sad: {
    palette: ['#01030d', '#1e3a8a', '#60a5fa'],
    energy: 0.14,
    flicker: 0,
    warp: 0.3,
    brightness: 0.45,
    weather: 'rain',
    label: 'Rain',
  },
  disappointed: {
    palette: ['#07090f', '#334155', '#94a3b8'],
    energy: 0.12,
    flicker: 0,
    warp: 0.22,
    brightness: 0.4,
    weather: 'rain',
    label: 'Grey',
  },
  angry: {
    palette: ['#160000', '#dc2626', '#fb923c'],
    energy: 0.95,
    flicker: 0.55,
    warp: 0.9,
    brightness: 0.7,
    weather: 'embers',
    label: 'Burning',
  },
  anxious: {
    palette: ['#0a0618', '#6d28d9', '#22d3ee'],
    energy: 0.78,
    flicker: 0.3,
    warp: 0.95,
    brightness: 0.55,
    weather: 'dust',
    label: 'Restless',
  },
  confused: {
    palette: ['#070b1c', '#4f46e5', '#2dd4bf'],
    energy: 0.5,
    flicker: 0.08,
    warp: 1,
    brightness: 0.55,
    weather: 'dust',
    label: 'Drifting apart',
  },
};

export const EMOTION_TO_MOOD: Record<string, MoodKey> = {
  happy: 'happy',
  excited: 'excited',
  peaceful: 'peaceful',
  nostalgic: 'nostalgic',
  grateful: 'grateful',
  proud: 'proud',
  sad: 'sad',
  disappointed: 'disappointed',
  angry: 'angry',
  anxious: 'anxious',
  confused: 'confused',
};

export interface MoodBlend {
  key: MoodKey;
  secondary: MoodKey | null;
  palette: [string, string, string];
  energy: number;
  flicker: number;
  warp: number;
  brightness: number;
  weather: Weather;
  intensity: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

export function mixColor(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  return rgbToHex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function moodBlend(key: MoodKey, intensity = 1): MoodBlend {
  const look = MOODS[key];
  return {
    key,
    secondary: null,
    palette: look.palette,
    energy: look.energy,
    flicker: look.flicker,
    warp: look.warp,
    brightness: look.brightness,
    weather: look.weather,
    intensity,
  };
}

export function blendEmotions(
  emotions: Array<{ tag: string; phase?: 'then' | 'now' }>,
  fallback: MoodKey = 'cosmos',
): MoodBlend {
  const weights = new Map<MoodKey, number>();
  for (const emotion of emotions) {
    const key = EMOTION_TO_MOOD[emotion.tag];
    if (!key) continue;
    weights.set(key, (weights.get(key) ?? 0) + (emotion.phase === 'now' ? 0.6 : 1));
  }
  if (!weights.size) return moodBlend(fallback, 0.6);
  const ranked = [...weights.entries()].sort((a, b) => b[1] - a[1]);
  const [primary, primaryWeight] = ranked[0]!;
  const secondary = ranked[1]?.[0] ?? null;
  const total = ranked.reduce((sum, [, w]) => sum + w, 0);
  const share = secondary ? ranked[1]![1] / (primaryWeight + ranked[1]![1]) : 0;
  const a = MOODS[primary];
  const b = secondary ? MOODS[secondary] : a;
  const mix = Math.min(0.45, share);
  return {
    key: primary,
    secondary,
    palette: [
      mixColor(a.palette[0], b.palette[0], mix),
      mixColor(a.palette[1], b.palette[1], mix),
      mixColor(a.palette[2], b.palette[2], mix),
    ],
    energy: a.energy * (1 - mix) + b.energy * mix,
    flicker: a.flicker * (1 - mix) + b.flicker * mix,
    warp: a.warp * (1 - mix) + b.warp * mix,
    brightness: a.brightness * (1 - mix) + b.brightness * mix,
    weather: a.weather,
    intensity: Math.min(1, 0.55 + total * 0.15),
  };
}

export function seasonMood(season: string | null | undefined): MoodKey {
  if (season === 'spring') return 'peaceful';
  if (season === 'summer') return 'happy';
  if (season === 'autumn') return 'nostalgic';
  return 'cosmos';
}
