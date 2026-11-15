import type { MoodKey } from '../mood/moods';
import { COMPOSITIONS } from './compositions';
import * as inst from './instruments';
import { renderLoop, type RenderedLoop } from './renderer';
import { midiToHz, SCALES, scaleNote } from './theory';

export type Scene =
  | 'quiet'
  | 'path'
  | 'spring'
  | 'summer'
  | 'autumn'
  | 'winter'
  | 'night'
  | 'studio'
  | 'board'
  | 'playback';

export type Effect =
  | 'shift'
  | 'chime'
  | 'saved'
  | 'tap'
  | 'deny'
  | 'pluck'
  | 'whoosh'
  | 'seal'
  | 'unseal'
  | 'sparkle'
  | 'open'
  | 'close'
  | 'start'
  | 'stop'
  | 'zoomIn'
  | 'zoomOut';

export type Presence = 'ambient' | 'memory' | 'live';

export interface SoundSettings {
  effects: boolean;
  ambient: boolean;
  volume: number;
  muted: boolean;
  gentle: boolean;
}

interface Deck {
  key: string;
  bed: AudioBufferSourceNode;
  motif: AudioBufferSourceNode;
  bedGain: GainNode;
  motifGain: GainNode;
}

interface Target {
  mood: MoodKey | null;
  intensity: number;
  texture: string | null;
  seed: number;
  presence: Presence;
}

const CROSSFADE = 4;
const PRESENCE_LEVELS: Record<Presence, { bed: number; motif: number }> = {
  ambient: { bed: 0.16, motif: 0.04 },
  memory: { bed: 0.3, motif: 0.36 },
  live: { bed: 0.38, motif: 0.48 },
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private echo: GainNode | null = null;
  private deck: Deck | null = null;
  private target: Target = {
    mood: 'cosmos',
    intensity: 0.5,
    texture: null,
    seed: 0,
    presence: 'ambient',
  };
  private pending = 0;
  private request = 0;
  private ducked = false;
  private lastFire = 0;
  private hidden = false;
  private room: { part: string; texture: string | null } = { part: 'afternoon', texture: null };
  private settings: SoundSettings = {
    effects: true,
    ambient: true,
    volume: 0.6,
    muted: false,
    gentle: false,
  };

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const Context =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Context) return;
      const ctx = new Context({ latencyHint: 'playback' });
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0;
      this.music = ctx.createGain();
      this.sfx = ctx.createGain();
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10;
      limiter.knee.value = 8;
      limiter.ratio.value = 4;
      limiter.attack.value = 0.005;
      limiter.release.value = 0.3;

      this.echo = ctx.createGain();
      const delay = ctx.createDelay(1.5);
      delay.delayTime.value = 0.36;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.32;
      const soften = ctx.createBiquadFilter();
      soften.type = 'lowpass';
      soften.frequency.value = 2400;
      const wet = ctx.createGain();
      wet.gain.value = 0.35;
      this.echo.connect(delay);
      delay.connect(soften).connect(feedback).connect(delay);
      soften.connect(wet).connect(this.master);

      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.sfx.connect(this.echo);
      this.master.connect(limiter).connect(ctx.destination);
      this.limiter = limiter;
      this.applyVolume(1.2);
      this.schedule(0);
    }
    if (this.ctx.state === 'suspended' && !this.hidden) void this.ctx.resume();
  }

  configure(next: Partial<SoundSettings>) {
    const before = this.settings;
    this.settings = { ...this.settings, ...next };
    this.applyVolume(0.6);
    if (before.gentle !== this.settings.gentle || before.ambient !== this.settings.ambient)
      this.schedule(0);
  }

  setHidden(hidden: boolean) {
    this.hidden = hidden;
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    if (hidden) {
      this.master.gain.setTargetAtTime(0, now, 0.15);
      window.setTimeout(() => {
        if (this.hidden && this.ctx?.state === 'running') void this.ctx.suspend();
      }, 900);
    } else {
      void this.ctx.resume().then(() => this.applyVolume(1));
    }
  }

  setScene(scene: Scene) {
    const quiet = scene === 'quiet';
    this.setMood(quiet ? null : 'cosmos', 0.4, null, 0, 'ambient');
  }

  setMood(
    mood: MoodKey | null,
    intensity = 0.5,
    texture: string | null = null,
    seed = 0,
    presence: Presence = 'ambient',
  ) {
    const before = this.target;
    this.target = { mood, intensity, texture, seed, presence };
    const sameMusic =
      before.mood === mood &&
      before.seed === seed &&
      before.texture === texture &&
      before.presence === presence;
    if (sameMusic) {
      this.applyLevels(1.6);
      return;
    }
    this.schedule(presence === 'ambient' ? 650 : 250);
  }

  prepare(mood: MoodKey | null, seed: number, texture: string | null = null) {
    if (!mood || !this.ctx || !this.settings.ambient) return;
    void renderLoop(mood, seed, texture, this.settings.gentle).catch(() => undefined);
  }

  get scale(): { root: number; scale: readonly number[] } {
    const def = COMPOSITIONS[this.target.mood ?? 'cosmos'];
    return { root: def.root + ((this.target.seed % 5) - 2), scale: SCALES[def.scale] };
  }

  duck(on: boolean) {
    this.ducked = on;
    this.applyLevels(0.8);
  }

  private voiceBus: GainNode | null = null;
  private voiceOut: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private voices = new Set<AudioBufferSourceNode>();

  private ensureVoiceBus(): GainNode | null {
    if (!this.ctx || !this.master) return null;
    if (this.voiceBus) return this.voiceBus;
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.gain.value = 1.15;
    const body = ctx.createBiquadFilter();
    body.type = 'lowshelf';
    body.frequency.value = 220;
    body.gain.value = 2;
    const air = ctx.createBiquadFilter();
    air.type = 'highshelf';
    air.frequency.value = 7000;
    air.gain.value = -2;
    const room = ctx.createConvolver();
    const length = Math.floor(ctx.sampleRate * 1.1);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      let smooth = 0;
      for (let i = 0; i < length; i += 1) {
        smooth = smooth * 0.6 + (Math.random() * 2 - 1) * 0.4;
        data[i] = smooth * Math.pow(1 - i / length, 3.2);
      }
    }
    room.buffer = impulse;
    const wet = ctx.createGain();
    wet.gain.value = 0.07;
    const out = ctx.createGain();
    out.gain.value = this.voiceLevel();
    bus.connect(body).connect(air).connect(out);
    air.connect(room).connect(wet).connect(out);
    out.connect(this.limiter ?? ctx.destination);
    this.voiceBus = bus;
    this.voiceOut = out;
    return bus;
  }

  get clock(): number {
    return this.ctx?.currentTime ?? 0;
  }

  playVoice(samples: Float32Array, rate: number, when: number): number | null {
    const bus = this.ensureVoiceBus();
    if (!bus || !this.ctx) return null;
    const buffer = this.ctx.createBuffer(1, samples.length, rate);
    buffer.copyToChannel(samples as Float32Array<ArrayBuffer>, 0);
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    const fade = this.ctx.createGain();
    const start = Math.max(when, this.ctx.currentTime + 0.03);
    fade.gain.setValueAtTime(0, start);
    fade.gain.linearRampToValueAtTime(1, start + 0.012);
    fade.gain.setValueAtTime(1, start + buffer.duration - 0.03);
    fade.gain.linearRampToValueAtTime(0, start + buffer.duration);
    source.connect(fade).connect(bus);
    source.start(start);
    this.voices.add(source);
    source.onended = () => this.voices.delete(source);
    return start + buffer.duration;
  }

  stopVoice() {
    for (const source of this.voices) {
      try {
        source.stop();
      } catch {
        continue;
      }
    }
    this.voices.clear();
  }

  private schedule(delay: number) {
    window.clearTimeout(this.pending);
    this.pending = window.setTimeout(() => void this.apply(), delay);
  }

  private async apply() {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    const ticket = ++this.request;
    const { mood, seed } = this.target;
    const texture = this.textureNow();
    if (!mood || !this.settings.ambient) {
      this.fadeOut(this.deck, 2.5);
      this.deck = null;
      return;
    }
    let loop: RenderedLoop;
    try {
      loop = await renderLoop(mood, seed, texture, this.settings.gentle);
    } catch {
      return;
    }
    if (ticket !== this.request || !this.ctx) return;
    if (this.deck?.key === loop.key) {
      this.applyLevels(1.5);
      return;
    }
    this.crossfade(loop);
  }

  setRoom(room: { part: string; texture: string | null }) {
    const before = this.textureNow();
    this.room = room;
    if (this.textureNow() !== before) this.schedule(1200);
    else this.applyLevels(3);
  }

  private textureNow(): string | null {
    if (this.target.texture) return this.target.texture;
    return this.target.presence === 'ambient' ? this.room.texture : null;
  }

  private levels() {
    const base = PRESENCE_LEVELS[this.target.presence];
    const hush = this.room.part === 'night' ? 0.78 : this.room.part === 'dawn' ? 0.88 : 1;
    const duck = (this.ducked ? 0.3 : 1) * (this.target.presence === 'ambient' ? hush : 1);
    const lift = 0.75 + this.target.intensity * 0.35;
    return {
      bed: base.bed * duck,
      motif: base.motif * lift * duck * (this.settings.gentle ? 0.75 : 1),
    };
  }

  private crossfade(loop: RenderedLoop) {
    const ctx = this.ctx!;
    const start = ctx.currentTime + 0.08;
    const make = (buffer: AudioBuffer) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, start);
      source.connect(gain).connect(this.music!);
      source.start(start);
      return { source, gain };
    };
    const bed = make(loop.bed);
    const motif = make(loop.motif);
    const { bed: bedLevel, motif: motifLevel } = this.levels();
    bed.gain.gain.linearRampToValueAtTime(bedLevel, start + CROSSFADE);
    motif.gain.gain.linearRampToValueAtTime(motifLevel, start + CROSSFADE * 1.25);
    this.fadeOut(this.deck, CROSSFADE);
    this.deck = {
      key: loop.key,
      bed: bed.source,
      motif: motif.source,
      bedGain: bed.gain,
      motifGain: motif.gain,
    };
  }

  private fadeOut(deck: Deck | null, seconds: number) {
    if (!deck || !this.ctx) return;
    const now = this.ctx.currentTime;
    for (const gain of [deck.bedGain, deck.motifGain]) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + seconds);
    }
    deck.bed.stop(now + seconds + 0.1);
    deck.motif.stop(now + seconds + 0.1);
  }

  private applyLevels(seconds: number) {
    if (!this.ctx || !this.deck) return;
    const now = this.ctx.currentTime;
    const { bed, motif } = this.levels();
    for (const [gain, value] of [
      [this.deck.bedGain, bed],
      [this.deck.motifGain, motif],
    ] as const) {
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(value, now + seconds);
    }
  }

  private applyVolume(seconds: number) {
    if (!this.ctx || !this.master || !this.music || !this.sfx) return;
    const now = this.ctx.currentTime;
    const volume = this.settings.muted || this.hidden ? 0 : this.settings.volume;
    this.master.gain.setTargetAtTime(volume, now, seconds / 3);
    this.sfx.gain.setTargetAtTime(this.settings.effects ? 0.8 : 0, now, 0.05);
    this.music.gain.setTargetAtTime(this.settings.ambient ? 0.9 : 0, now, seconds / 3);
    this.voiceOut?.gain.setTargetAtTime(this.voiceLevel(), now, 0.1);
  }

  private voiceLevel(): number {
    return this.hidden ? 0 : Math.max(0.35, this.settings.volume);
  }

  private voice(pan = 0): inst.Voice {
    const ctx = this.ctx!;
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    panner.connect(this.sfx!);
    return { ctx, out: panner };
  }

  private ready(): boolean {
    return (
      !!this.ctx && !!this.sfx && this.settings.effects && !this.settings.muted && !this.hidden
    );
  }

  fire(clientX: number, clientY: number, strength = 1) {
    if (!this.ready()) return;
    const now = performance.now();
    if (now - this.lastFire < 90) return;
    this.lastFire = now;
    const { root, scale } = this.scale;
    const degree = Math.floor((1 - clientY / window.innerHeight) * 7) + 7;
    const note = scaleNote(root + 12, scale, degree);
    inst.celesta(
      this.voice((clientX / window.innerWidth) * 1.6 - 0.8),
      note,
      this.ctx!.currentTime,
      0.018 * strength,
      1.6,
    );
  }

  play(effect: Effect) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime + 0.01;
    const { root, scale } = this.scale;
    const note = (degree: number, octave = 24) => scaleNote(root + octave, scale, degree);
    const v = this.voice();
    switch (effect) {
      case 'shift':
        this.pageTurn(t);
        break;
      case 'chime':
        inst.celesta(v, note(4), t, 0.03, 2.2);
        break;
      case 'saved':
        [0, 2, 4, 7].forEach((d, i) =>
          inst.celesta(this.voice(-0.4 + i * 0.27), note(d), t + i * 0.11, 0.03, 2.4),
        );
        break;
      case 'sparkle':
        [7, 9, 11].forEach((d, i) =>
          inst.celesta(this.voice(0.2 * i), note(d), t + i * 0.07, 0.016, 1.4),
        );
        break;
      case 'tap':
        break;
      case 'deny':
        inst.piano(v, note(0, 0), t, 0.03, 0.9);
        inst.piano(v, note(0, 0) + 1, t + 0.09, 0.025, 0.9);
        break;
      case 'pluck':
        inst.harp(
          this.voice(Math.random() - 0.5),
          note(Math.floor(Math.random() * 5), 12),
          t,
          0.035,
          1.4,
        );
        break;
      case 'whoosh':
      case 'zoomIn':
        this.glide(t, true);
        if (effect === 'zoomIn')
          [0, 4, 7].forEach((d, i) => inst.celesta(v, note(d), t + 0.45 + i * 0.06, 0.016, 1.8));
        break;
      case 'zoomOut':
        this.glide(t, false);
        break;
      case 'seal':
        inst.heartbeat(v, t, 0.12);
        inst.celesta(v, note(0), t + 0.15, 0.02, 1.6);
        break;
      case 'unseal':
        [4, 2, 0, 7].forEach((d, i) => inst.celesta(v, note(d), t + i * 0.12, 0.024, 2));
        break;
      case 'open':
      case 'start':
        inst.celesta(v, note(0, 12), t, 0.022, 1);
        inst.celesta(v, note(4, 12), t + 0.09, 0.022, 1.3);
        break;
      case 'close':
      case 'stop':
        inst.celesta(v, note(4, 12), t, 0.022, 1);
        inst.celesta(v, note(0, 12), t + 0.09, 0.022, 1.3);
        break;
    }
  }

  private pageTurn(t: number) {
    const ctx = this.ctx!;
    const length = 0.42;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * length), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < data.length; i += 1) {
      brown = (brown + 0.04 * (Math.random() * 2 - 1)) / 1.04;
      const x = i / data.length;
      data[i] = brown * 6 * Math.sin(Math.PI * Math.pow(x, 0.7));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.5;
    band.frequency.setValueAtTime(700, t);
    band.frequency.exponentialRampToValueAtTime(1800, t + length * 0.6);
    band.frequency.exponentialRampToValueAtTime(900, t + length);
    const gain = ctx.createGain();
    gain.gain.value = 0.05;
    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(0.4, t);
    pan.pan.linearRampToValueAtTime(-0.4, t + length);
    source.connect(band).connect(gain).connect(pan).connect(this.sfx!);
    source.start(t);
  }

  private glide(t: number, rising: boolean) {
    const ctx = this.ctx!;
    const { root } = this.scale;
    for (const [offset, share] of [
      [0, 1],
      [7, 0.6],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const from = midiToHz(root + 12 + offset + (rising ? -5 : 5));
      const to = midiToHz(root + 12 + offset);
      osc.frequency.setValueAtTime(from, t);
      osc.frequency.exponentialRampToValueAtTime(to, t + 0.7);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.02 * share, t + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
      osc.connect(gain).connect(this.sfx!);
      osc.start(t);
      osc.stop(t + 1.2);
    }
  }

  tone(midi: number, length = 0.5) {
    if (!this.ready()) return;
    inst.celesta(this.voice(), midi, this.ctx!.currentTime, 0.03, length);
  }
}

export const sound = new SoundEngine();
