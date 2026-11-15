import type { MoodKey } from '../mood/moods';
import * as inst from './instruments';
import { chordNotes, SCALES, scaleNote, type ScaleName } from './theory';

type BedVoice = 'glass' | 'strings' | 'choir' | 'cello';
type MotifVoice = 'piano' | 'celesta' | 'harp';
type MotifStyle = 'broken' | 'sparse' | 'pulse' | 'rising' | 'falling' | 'wander';

export interface Composition {
  tempo: number;
  root: number;
  scale: ScaleName;
  progression: number[];
  barsPerChord: number;
  bars: number;
  bed: { voice: BedVoice; level: number; brightness: number; octave: number; second?: BedVoice };
  motif: { voice: MotifVoice; style: MotifStyle; level: number; density: number; octave: number };
  bass?: number;
  heartbeat?: number;
  horn?: number;
  reverb: number;
}

export const COMPOSITIONS: Record<MoodKey, Composition> = {
  cosmos: {
    tempo: 60,
    root: 50,
    scale: 'dorian',
    progression: [0, 5, 3, 4],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'glass', level: 0.05, brightness: 1400, octave: 0 },
    motif: { voice: 'celesta', style: 'sparse', level: 0.03, density: 0.35, octave: 2 },
    reverb: 0.55,
  },
  studio: {
    tempo: 56,
    root: 53,
    scale: 'major',
    progression: [0, 3, 5, 4],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'glass', level: 0.045, brightness: 1200, octave: 0 },
    motif: { voice: 'piano', style: 'sparse', level: 0.025, density: 0.25, octave: 1 },
    reverb: 0.5,
  },
  happy: {
    tempo: 84,
    root: 55,
    scale: 'major',
    progression: [0, 4, 5, 3],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'strings', level: 0.045, brightness: 1500, octave: 0 },
    motif: { voice: 'piano', style: 'broken', level: 0.05, density: 0.75, octave: 1 },
    bass: 0.07,
    reverb: 0.38,
  },
  excited: {
    tempo: 96,
    root: 57,
    scale: 'lydian',
    progression: [0, 1, 4, 5],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'glass', level: 0.05, brightness: 2200, octave: 0, second: 'strings' },
    motif: { voice: 'harp', style: 'pulse', level: 0.045, density: 0.9, octave: 1 },
    bass: 0.08,
    reverb: 0.35,
  },
  peaceful: {
    tempo: 64,
    root: 52,
    scale: 'pentatonic',
    progression: [0, 3, 1, 4],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'choir', level: 0.04, brightness: 1200, octave: 0, second: 'glass' },
    motif: { voice: 'piano', style: 'sparse', level: 0.045, density: 0.4, octave: 1 },
    reverb: 0.6,
  },
  nostalgic: {
    tempo: 72,
    root: 50,
    scale: 'mixolydian',
    progression: [0, 6, 3, 0],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'strings', level: 0.042, brightness: 950, octave: 0 },
    motif: { voice: 'celesta', style: 'falling', level: 0.045, density: 0.55, octave: 2 },
    bass: 0.05,
    reverb: 0.5,
  },
  grateful: {
    tempo: 70,
    root: 53,
    scale: 'major',
    progression: [0, 5, 3, 4],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'strings', level: 0.045, brightness: 1300, octave: 0, second: 'choir' },
    motif: { voice: 'piano', style: 'rising', level: 0.05, density: 0.6, octave: 1 },
    reverb: 0.5,
  },
  proud: {
    tempo: 78,
    root: 55,
    scale: 'lydian',
    progression: [0, 4, 5, 1],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'strings', level: 0.05, brightness: 1600, octave: 0 },
    motif: { voice: 'piano', style: 'rising', level: 0.05, density: 0.7, octave: 1 },
    bass: 0.07,
    horn: 0.03,
    reverb: 0.45,
  },
  sad: {
    tempo: 58,
    root: 48,
    scale: 'minor',
    progression: [0, 5, 3, 4],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'cello', level: 0.05, brightness: 900, octave: -1, second: 'glass' },
    motif: { voice: 'piano', style: 'falling', level: 0.05, density: 0.35, octave: 1 },
    reverb: 0.6,
  },
  disappointed: {
    tempo: 60,
    root: 50,
    scale: 'dorian',
    progression: [0, 3, 0, 6],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'glass', level: 0.045, brightness: 1000, octave: 0 },
    motif: { voice: 'piano', style: 'sparse', level: 0.04, density: 0.3, octave: 1 },
    reverb: 0.55,
  },
  angry: {
    tempo: 76,
    root: 45,
    scale: 'phrygian',
    progression: [0, 1, 0, 6],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'cello', level: 0.05, brightness: 800, octave: -1, second: 'strings' },
    motif: { voice: 'harp', style: 'pulse', level: 0.035, density: 0.7, octave: 0 },
    bass: 0.09,
    heartbeat: 0.09,
    reverb: 0.4,
  },
  anxious: {
    tempo: 88,
    root: 49,
    scale: 'harmonic',
    progression: [0, 5, 4, 0],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'glass', level: 0.045, brightness: 1600, octave: 0 },
    motif: { voice: 'harp', style: 'pulse', level: 0.03, density: 0.6, octave: 1 },
    heartbeat: 0.08,
    reverb: 0.45,
  },
  confused: {
    tempo: 66,
    root: 51,
    scale: 'wholetone',
    progression: [0, 2, 1, 3],
    barsPerChord: 2,
    bars: 8,
    bed: { voice: 'glass', level: 0.045, brightness: 1300, octave: 0 },
    motif: { voice: 'celesta', style: 'wander', level: 0.04, density: 0.5, octave: 2 },
    reverb: 0.6,
  },
};

export function seededRandom(seed: number) {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) % 100000) / 100000;
  };
}

export interface ComposeTargets {
  bed: AudioNode | null;
  motif: AudioNode | null;
}

function panned(ctx: BaseAudioContext, out: AudioNode, pan: number): AudioNode {
  const node = ctx.createStereoPanner();
  node.pan.value = Math.max(-0.9, Math.min(0.9, pan));
  node.connect(out);
  return node;
}

function playBed(
  voice: BedVoice,
  v: inst.Voice,
  note: number,
  time: number,
  length: number,
  level: number,
  brightness: number,
) {
  if (voice === 'glass') inst.glassPad(v, note, time, length, level, brightness);
  else if (voice === 'strings') inst.warmStrings(v, note, time, length, level, brightness);
  else if (voice === 'choir') inst.choirPad(v, note, time, length, level);
  else inst.cello(v, note, time, length, level);
}

function playMotif(
  voice: MotifVoice,
  v: inst.Voice,
  note: number,
  time: number,
  level: number,
  decay: number,
) {
  if (voice === 'piano') inst.piano(v, note, time, level, decay);
  else if (voice === 'celesta') inst.celesta(v, note, time, level, decay);
  else inst.harp(v, note, time, level, decay);
}

export function compose(
  ctx: BaseAudioContext,
  def: Composition,
  seed: number,
  targets: ComposeTargets,
  options: { gentle: boolean; texture: string | null },
): number {
  const rand = seededRandom(seed + 17);
  const transpose = (seed % 5) - 2;
  const root = def.root + transpose;
  const scale = SCALES[def.scale];
  const beat = 60 / def.tempo;
  const bar = beat * 4;
  const duration = def.bars * bar;
  const rotate = seed % def.progression.length;
  const chordAt = (b: number) =>
    def.progression[(Math.floor(b / def.barsPerChord) + rotate) % def.progression.length]!;
  const motifLevel = def.motif.level * (options.gentle ? 0.7 : 1);
  const density = def.motif.density * (options.gentle ? 0.65 : 1);

  const bedOut = targets.bed;
  const motifOut = targets.motif;
  for (let b = 0; bedOut && b < def.bars; b += def.barsPerChord) {
    const degree = chordAt(b);
    const start = b * bar;
    const length = def.barsPerChord * bar + 0.4;
    const notes = chordNotes(root + def.bed.octave * 12, scale, degree, 3);
    notes.forEach((note, i) => {
      const v = { ctx, out: panned(ctx, bedOut, (i - 1) * 0.45) };
      playBed(def.bed.voice, v, note, start, length, def.bed.level / 2, def.bed.brightness);
      if (def.bed.second && i !== 1)
        playBed(
          def.bed.second,
          { ctx, out: panned(ctx, bedOut, (1 - i) * 0.5) },
          note + 12,
          start + 0.3,
          length,
          def.bed.level / 4,
          def.bed.brightness,
        );
    });
    if (def.bass) {
      const low = scaleNote(root - 12, scale, degree);
      if (options.gentle)
        inst.softBass({ ctx, out: bedOut }, low, start, length - 0.3, def.bass * 0.6);
      else
        for (let half = 0; half < def.barsPerChord * 2; half += 1)
          inst.softBass(
            { ctx, out: bedOut },
            low,
            start + half * bar * 0.5,
            bar * 0.45,
            def.bass * (half % 2 ? 0.7 : 1),
          );
    }
  }

  if (bedOut && def.heartbeat && !options.gentle)
    for (let b = 0; b < def.bars; b += 1)
      inst.heartbeat({ ctx, out: bedOut }, b * bar, def.heartbeat);

  if (motifOut && def.horn && !options.gentle)
    for (let b = 0; b < def.bars; b += def.barsPerChord)
      inst.horn(
        { ctx, out: panned(ctx, motifOut, -0.3) },
        scaleNote(root, scale, chordAt(b) + 4),
        b * bar + beat,
        bar * 1.6,
        def.horn,
      );

  const motifRoot = root + def.motif.octave * 12;
  let walker = Math.floor(rand() * scale.length);
  for (let b = 0; motifOut && b < def.bars; b += 1) {
    const degree = chordAt(b);
    const tones = chordNotes(motifRoot, scale, degree, 4);
    const at = (step: number) => b * bar + step * beat;
    const hit = (note: number, time: number, level = motifLevel, decay = 2.6) => {
      if (time >= duration - 0.05) return;
      const v = { ctx, out: panned(ctx, motifOut!, (rand() - 0.5) * 0.9) };
      playMotif(
        def.motif.voice,
        v,
        note,
        time + rand() * 0.012,
        level * (0.85 + rand() * 0.25),
        decay,
      );
    };
    switch (def.motif.style) {
      case 'broken': {
        const order = [0, 2, 1, 3, 2, 1, 0, 2];
        for (let s = 0; s < 8; s += 1)
          if (rand() < density)
            hit(tones[order[s]! % tones.length]!, at(s / 2), motifLevel * (s % 2 ? 0.7 : 1), 2.4);
        break;
      }
      case 'sparse': {
        const count = rand() < density ? (rand() < 0.4 ? 2 : 1) : 0;
        for (let n = 0; n < count; n += 1)
          hit(
            tones[Math.floor(rand() * tones.length)]!,
            at(n * 2 + Math.floor(rand() * 2)),
            motifLevel,
            4,
          );
        break;
      }
      case 'pulse': {
        for (let s = 0; s < 8; s += 1)
          if (rand() < density)
            hit(
              s % 4 === 0 ? tones[0]! : tones[s % 2 ? 2 : 1]!,
              at(s / 2),
              motifLevel * (s % 4 === 0 ? 1 : 0.6),
              0.9,
            );
        break;
      }
      case 'rising': {
        if (b % 2 === 0)
          tones.forEach((note, i) => {
            if (rand() < density + 0.2) hit(note, at(i * 0.75), motifLevel * (0.7 + i * 0.1), 3);
          });
        else if (rand() < density) hit(tones[3]! + 12, at(1), motifLevel * 0.8, 3.5);
        break;
      }
      case 'falling': {
        const phrase = [3, 2, 1, 0];
        phrase.forEach((index, i) => {
          if (rand() < density) hit(tones[index]!, at(i), motifLevel * (1 - i * 0.12), 3.4);
        });
        break;
      }
      case 'wander': {
        for (let s = 0; s < 4; s += 1) {
          walker += Math.floor(rand() * 3) - 1;
          if (rand() < density) hit(scaleNote(motifRoot, scale, walker), at(s), motifLevel, 3);
        }
        break;
      }
    }
  }

  if (bedOut && options.texture) addTexture(ctx, options.texture, bedOut, duration, rand);
  return duration;
}

function addTexture(
  ctx: BaseAudioContext,
  kind: string,
  out: AudioNode,
  duration: number,
  rand: () => number,
) {
  const air = (cutoff: number, level: number, sway: number) => {
    const source = ctx.createBufferSource();
    source.buffer = inst.seededNoise(ctx, duration + 6, rand);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    filter.Q.value = 0.3;
    const gain = ctx.createGain();
    gain.gain.value = level;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / (duration / Math.max(1, Math.round(duration / 9)));
    const depth = ctx.createGain();
    depth.gain.value = level * sway;
    lfo.connect(depth).connect(gain.gain);
    source.connect(filter).connect(gain).connect(out);
    source.start(0);
    lfo.start(0);
  };
  if (kind === 'waves') air(420, 0.05, 0.8);
  else if (kind === 'rain') air(900, 0.022, 0.2);
  else if (kind === 'wind') air(520, 0.03, 0.7);
  else if (kind === 'fire') air(260, 0.04, 0.3);
  else if (kind === 'birds' || kind === 'crickets') {
    const calls = Math.max(2, Math.round(duration / 7));
    for (let i = 0; i < calls; i += 1) {
      const time = rand() * (duration - 1.5);
      const base = 2400 + rand() * 1400;
      for (let n = 0; n < 2 + Math.floor(rand() * 3); n += 1) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        const t = time + n * 0.13;
        o.frequency.setValueAtTime(base, t);
        o.frequency.exponentialRampToValueAtTime(base * (1.25 + rand() * 0.3), t + 0.08);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.008, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
        const pan = ctx.createStereoPanner();
        pan.pan.value = rand() * 1.6 - 0.8;
        o.connect(g).connect(pan).connect(out);
        o.start(t);
        o.stop(t + 0.15);
      }
    }
  } else if (kind === 'bells') {
    for (let i = 0; i < Math.max(1, Math.round(duration / 10)); i += 1)
      inst.celesta(
        { ctx, out },
        [79, 83, 86, 91][Math.floor(rand() * 4)]!,
        rand() * (duration - 3),
        0.012,
        4,
      );
  }
}
