type Pattern = 'tap' | 'start' | 'stop' | 'saved' | 'warn' | 'fire';

const PATTERNS: Record<Pattern, number | number[]> = {
  tap: 8,
  fire: 6,
  start: [12, 40, 12],
  stop: 20,
  saved: [10, 60, 10, 60, 30],
  warn: [30, 50, 30],
};

const MOOD_PATTERNS: Record<string, number[]> = {
  happy: [18, 40, 18, 40, 30],
  excited: [12, 25, 12, 25, 12, 25, 40],
  peaceful: [60],
  nostalgic: [30, 120, 30],
  grateful: [40, 80, 60],
  proud: [20, 30, 80],
  sad: [140],
  disappointed: [90, 200, 40],
  angry: [70, 30, 70, 30, 90],
  anxious: [14, 24, 14, 24, 14, 24, 14],
  confused: [20, 90, 40, 30, 10],
};

function canVibrate(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.vibrate === 'function' &&
    window.matchMedia('(pointer: coarse)').matches
  );
}

export function haptic(pattern: Pattern) {
  if (canVibrate()) navigator.vibrate(PATTERNS[pattern]);
}

export function hapticMood(mood: string) {
  if (canVibrate()) navigator.vibrate(MOOD_PATTERNS[mood] ?? 20);
}
