export interface Point {
  x: number;
  y: number;
}

export function seededRandom(seed: string) {
  let h = 2166136261;
  for (const char of seed) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function placeNodes(count: number, seed: string): Point[] {
  if (count === 0) return [];
  if (count === 1) return [{ x: 0.5, y: 0.46 }];
  const r = seededRandom(seed);
  const points: Point[] = [];
  if (count <= 8) {
    const start = r() * Math.PI * 2;
    for (let i = 0; i < count; i += 1) {
      const angle = start + (i / count) * Math.PI * 2 + (r() - 0.5) * 0.4;
      const radius = 0.27 + (r() - 0.5) * 0.08;
      points.push({ x: 0.5 + Math.cos(angle) * radius, y: 0.47 + Math.sin(angle) * radius * 0.95 });
    }
  } else {
    for (let i = 0; i < count; i += 1) {
      const angle = i * 2.39996 + r() * 0.35;
      const radius = 0.06 + Math.sqrt((i + 0.5) / count) * 0.36;
      points.push({ x: 0.5 + Math.cos(angle) * radius, y: 0.47 + Math.sin(angle) * radius * 0.9 });
    }
  }
  return points.map((p) => ({ x: clamp(p.x, 0.1, 0.9), y: clamp(p.y, 0.14, 0.8) }));
}

export function placeSatellite(anchor: Point, index: number, seed: string): Point {
  const r = seededRandom(`${seed}:${index}`);
  const away = Math.atan2(anchor.y - 0.47, anchor.x - 0.5) || r() * Math.PI * 2;
  const angle = away + (r() - 0.5) * 1.3;
  const distance = 0.14 + r() * 0.06;
  return {
    x: clamp(anchor.x + Math.cos(angle) * distance, 0.05, 0.95),
    y: clamp(anchor.y + Math.sin(angle) * distance, 0.08, 0.86),
  };
}

export function synapsePath(a: Point, b: Point, bend: number): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx = mx - dy * bend;
  const cy = my + dx * bend;
  const f = (n: number) => n.toFixed(1);
  return `M ${f(a.x)} ${f(a.y)} Q ${f(cx)} ${f(cy)} ${f(b.x)} ${f(b.y)}`;
}
