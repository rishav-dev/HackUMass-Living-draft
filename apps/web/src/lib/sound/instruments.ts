import { midiToHz } from './theory';

export interface Voice {
  ctx: BaseAudioContext;
  out: AudioNode;
}

function envelope(
  param: AudioParam,
  time: number,
  peak: number,
  attack: number,
  hold: number,
  release: number,
) {
  const top = Math.max(0.0002, peak);
  param.setValueAtTime(0.0001, time);
  param.exponentialRampToValueAtTime(top, time + Math.max(0.002, attack));
  param.setValueAtTime(top, time + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, time + attack + hold + release);
}

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, detune = 0) {
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.value = freq;
  node.detune.value = detune;
  return node;
}

export function glassPad(
  v: Voice,
  note: number,
  time: number,
  length: number,
  level: number,
  brightness = 1800,
) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = brightness;
  filter.Q.value = 0.4;
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, Math.min(3, length * 0.4), Math.max(0, length - 3), 3.5);
  filter.connect(gain).connect(v.out);
  const end = time + length + 4;
  for (const [type, mult, detune, share] of [
    ['sine', 1, -6, 1],
    ['sine', 1, 6, 1],
    ['triangle', 2, 3, 0.25],
    ['sine', 0.5, 0, 0.35],
  ] as const) {
    const o = osc(ctx, type, freq * mult, detune);
    const g = ctx.createGain();
    g.gain.value = share;
    o.connect(g).connect(filter);
    o.start(time);
    o.stop(end);
  }
}

export function warmStrings(
  v: Voice,
  note: number,
  time: number,
  length: number,
  level: number,
  brightness = 1100,
) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.5;
  filter.frequency.setValueAtTime(brightness * 0.5, time);
  filter.frequency.linearRampToValueAtTime(brightness, time + Math.min(2.5, length * 0.5));
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, Math.min(2.2, length * 0.45), Math.max(0, length - 2.2), 3);
  filter.connect(gain).connect(v.out);
  const end = time + length + 3.4;
  const vibrato = osc(ctx, 'sine', 4.4);
  const depth = ctx.createGain();
  depth.gain.value = freq * 0.0025;
  vibrato.connect(depth);
  vibrato.start(time);
  vibrato.stop(end);
  for (const detune of [-8, 2, 9]) {
    const o = osc(ctx, 'sawtooth', freq, detune);
    depth.connect(o.frequency);
    o.connect(filter);
    o.start(time);
    o.stop(end);
  }
}

export function choirPad(v: Voice, note: number, time: number, length: number, level: number) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, 2, Math.max(0, length - 2), 3);
  gain.connect(v.out);
  const sum = ctx.createGain();
  for (const [f, g] of [
    [700, 1],
    [1100, 0.45],
    [2500, 0.12],
  ] as const) {
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = f;
    band.Q.value = 6;
    const bandGain = ctx.createGain();
    bandGain.gain.value = g * 2.2;
    sum.connect(band).connect(bandGain).connect(gain);
  }
  for (const detune of [-7, 0, 8]) {
    const o = osc(ctx, 'triangle', freq, detune);
    o.connect(sum);
    o.start(time);
    o.stop(time + length + 3.4);
  }
}

export function cello(v: Voice, note: number, time: number, length: number, level: number) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  filter.Q.value = 0.8;
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, 0.5, Math.max(0, length - 0.5), 1.6);
  filter.connect(gain).connect(v.out);
  const o = osc(ctx, 'sawtooth', freq);
  const vibrato = osc(ctx, 'sine', 5.1);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, time);
  depth.gain.linearRampToValueAtTime(freq * 0.004, time + 0.8);
  vibrato.connect(depth).connect(o.frequency);
  o.connect(filter);
  o.start(time);
  vibrato.start(time);
  o.stop(time + length + 2);
  vibrato.stop(time + length + 2);
}

export function piano(v: Voice, note: number, time: number, level: number, decay = 3.2) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = Math.min(5200, freq * 7);
  tone.Q.value = 0.3;
  const gain = ctx.createGain();
  gain.gain.value = 1;
  tone.connect(gain).connect(v.out);
  [1, 2, 3, 4.02].forEach((harmonic, i) => {
    const o = osc(ctx, 'sine', freq * harmonic, i ? (i % 2 ? 1.5 : -1.5) : 0);
    const g = ctx.createGain();
    envelope(g.gain, time, level / (i * 1.3 + 1), 0.006, 0, decay / (i * 0.55 + 1));
    o.connect(g).connect(tone);
    o.start(time);
    o.stop(time + decay + 0.2);
  });
}

export function celesta(v: Voice, note: number, time: number, level: number, decay = 2.6) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const carrier = osc(ctx, 'sine', freq);
  const modulator = osc(ctx, 'sine', freq * 4);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(freq * 1.2, time);
  modGain.gain.exponentialRampToValueAtTime(freq * 0.02, time + decay * 0.4);
  modulator.connect(modGain).connect(carrier.frequency);
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, 0.004, 0, decay);
  carrier.connect(gain).connect(v.out);
  carrier.start(time);
  modulator.start(time);
  carrier.stop(time + decay + 0.1);
  modulator.stop(time + decay + 0.1);
}

export function harp(v: Voice, note: number, time: number, level: number, decay = 1.6) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4200, freq * 8), time);
  filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.4), time + decay * 0.6);
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, 0.004, 0, decay);
  filter.connect(gain).connect(v.out);
  for (const [type, detune] of [
    ['triangle', -4],
    ['sine', 4],
  ] as const) {
    const o = osc(ctx, type, freq, detune);
    o.connect(filter);
    o.start(time);
    o.stop(time + decay + 0.1);
  }
}

export function softBass(v: Voice, note: number, time: number, length: number, level: number) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, 0.04, Math.max(0, length - 0.1), 0.6);
  filter.connect(gain).connect(v.out);
  for (const [type, mult] of [
    ['sine', 1],
    ['triangle', 2],
  ] as const) {
    const o = osc(ctx, type, freq * mult);
    const g = ctx.createGain();
    g.gain.value = mult === 1 ? 1 : 0.2;
    o.connect(g).connect(filter);
    o.start(time);
    o.stop(time + length + 0.8);
  }
}

export function heartbeat(v: Voice, time: number, level: number) {
  const { ctx } = v;
  for (const [offset, share] of [
    [0, 1],
    [0.28, 0.6],
  ] as const) {
    const o = osc(ctx, 'sine', 62);
    o.frequency.setValueAtTime(70, time + offset);
    o.frequency.exponentialRampToValueAtTime(42, time + offset + 0.18);
    const g = ctx.createGain();
    envelope(g.gain, time + offset, level * share, 0.012, 0, 0.32);
    o.connect(g).connect(v.out);
    o.start(time + offset);
    o.stop(time + offset + 0.5);
  }
}

export function horn(v: Voice, note: number, time: number, length: number, level: number) {
  const { ctx } = v;
  const freq = midiToHz(note);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(300, time);
  filter.frequency.linearRampToValueAtTime(1300, time + 0.9);
  filter.frequency.linearRampToValueAtTime(800, time + length);
  const gain = ctx.createGain();
  envelope(gain.gain, time, level, 0.5, Math.max(0, length - 0.5), 1.4);
  filter.connect(gain).connect(v.out);
  for (const detune of [-5, 5]) {
    const o = osc(ctx, 'sawtooth', freq, detune);
    o.connect(filter);
    o.start(time);
    o.stop(time + length + 1.6);
  }
}

export function seededNoise(
  ctx: BaseAudioContext,
  seconds: number,
  rand: () => number,
): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i += 1) {
    brown = (brown + 0.02 * (rand() * 2 - 1)) / 1.02;
    data[i] = brown * 3.2;
  }
  return buffer;
}
