import type { MoodKey } from '../mood/moods';
import { compose, COMPOSITIONS, seededRandom } from './compositions';

export interface RenderedLoop {
  key: string;
  bed: AudioBuffer;
  motif: AudioBuffer;
  duration: number;
}

const TAIL = 5;
const RENDER_RATE = 22050;
const KEEP = 10;
const cache = new Map<string, Promise<RenderedLoop>>();

function impulse(ctx: BaseAudioContext, seconds: number, decay: number, seed: number): AudioBuffer {
  const rand = seededRandom(seed);
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel);
    let smooth = 0;
    for (let i = 0; i < length; i += 1) {
      smooth = smooth * 0.55 + (rand() * 2 - 1) * 0.45;
      data[i] = smooth * Math.pow(1 - i / length, decay);
    }
  }
  return buffer;
}

function fold(
  rendered: AudioBuffer,
  loopFrames: number,
  ctx: BaseAudioContext,
  targetPeak: number,
): AudioBuffer {
  const out = ctx.createBuffer(rendered.numberOfChannels, loopFrames, rendered.sampleRate);
  let peak = 0;
  for (let channel = 0; channel < rendered.numberOfChannels; channel += 1) {
    const source = rendered.getChannelData(channel);
    const target = out.getChannelData(channel);
    for (let i = 0; i < loopFrames; i += 1) {
      let value = source[i]!;
      let wrapped = i + loopFrames;
      while (wrapped < source.length) {
        value += source[wrapped]!;
        wrapped += loopFrames;
      }
      target[i] = value;
      if (Math.abs(value) > peak) peak = Math.abs(value);
    }
  }
  if (peak > 0.0001) {
    const scale = targetPeak / peak;
    for (let channel = 0; channel < out.numberOfChannels; channel += 1) {
      const data = out.getChannelData(channel);
      for (let i = 0; i < data.length; i += 1) data[i]! *= scale;
    }
  }
  return out;
}

async function renderLayer(
  sampleRate: number,
  seconds: number,
  reverb: number,
  seed: number,
  targetPeak: number,
  build: (ctx: OfflineAudioContext, input: AudioNode) => void,
): Promise<AudioBuffer> {
  const loopFrames = Math.round(seconds * sampleRate);
  const ctx = new OfflineAudioContext(2, loopFrames + Math.round(TAIL * sampleRate), sampleRate);
  const input = ctx.createGain();
  const dry = ctx.createGain();
  dry.gain.value = 1 - reverb * 0.45;
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 2.6, 2.6, seed);
  const wet = ctx.createGain();
  wet.gain.value = reverb;
  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowpass';
  warmth.frequency.value = 6500;
  input.connect(dry).connect(warmth);
  input.connect(room).connect(wet).connect(warmth);
  warmth.connect(ctx.destination);
  build(ctx, input);
  const rendered = await ctx.startRendering();
  return fold(rendered, loopFrames, ctx, targetPeak);
}

export function renderLoop(
  mood: MoodKey,
  seed: number,
  texture: string | null,
  gentle: boolean,
): Promise<RenderedLoop> {
  const sampleRate = RENDER_RATE;
  const key = `${mood}|${seed}|${texture ?? ''}|${gentle ? 1 : 0}`;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return cached;
  }
  const def = COMPOSITIONS[mood];
  const duration = def.bars * (60 / def.tempo) * 4;
  const job = (async () => {
    const options = { gentle, texture };
    const [bed, motif] = await Promise.all([
      renderLayer(sampleRate, duration, def.reverb, seed, 0.55, (ctx, input) => {
        compose(ctx, def, seed, { bed: input, motif: null }, options);
      }),
      renderLayer(sampleRate, duration, def.reverb * 0.85, seed + 1, 0.5, (ctx, input) => {
        compose(ctx, def, seed, { bed: null, motif: input }, { ...options, texture: null });
      }),
    ]);
    return { key, bed, motif, duration };
  })();
  cache.set(key, job);
  job.catch(() => cache.delete(key));
  while (cache.size > KEEP) cache.delete(cache.keys().next().value!);
  return job;
}
