export interface Pulse {
  x: number;
  y: number;
  start: number;
  strength: number;
}

const MAX = 4;
let pulses: Pulse[] = [];

export function emitPulse(clientX: number, clientY: number, strength = 1) {
  pulses = [
    ...pulses.slice(-(MAX - 1)),
    {
      x: clientX / window.innerWidth,
      y: 1 - clientY / window.innerHeight,
      start: performance.now(),
      strength,
    },
  ];
}

export function activePulses(now: number): Pulse[] {
  pulses = pulses.filter((p) => now - p.start < 2600);
  return pulses;
}
