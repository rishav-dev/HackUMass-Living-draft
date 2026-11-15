export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  wholetone: [0, 2, 4, 6, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
} as const;

export type ScaleName = keyof typeof SCALES;

export function midiToHz(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export function scaleNote(root: number, scale: readonly number[], degree: number): number {
  const length = scale.length;
  const octave = Math.floor(degree / length);
  const index = ((degree % length) + length) % length;
  return root + octave * 12 + scale[index]!;
}

export function chordNotes(
  root: number,
  scale: readonly number[],
  degree: number,
  size = 4,
): number[] {
  return Array.from({ length: size }, (_, i) => scaleNote(root, scale, degree + i * 2));
}
