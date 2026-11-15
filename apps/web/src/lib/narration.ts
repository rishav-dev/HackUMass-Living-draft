import { sound } from './sound/engine';
import { readLocal } from './storage';
import {
  dropSynthesis,
  narratorCached,
  narratorState,
  neuralVoice,
  neuralWanted,
  prepareNarrator,
  synthesize,
  type VoiceClip,
} from './voice/neural';
import { leadIn, planReading, type ReadingSegment } from '@living-draft/engine';

const PREFERRED = [
  /(Ava|Emma|Jenny|Aria|Sonia|Libby|Natasha|Clara).*Natural/i,
  /Natural/i,
  /(Ava|Zoe|Serena|Moira|Karen|Samantha).*(Premium|Enhanced)/i,
  /Google UK English Female/i,
  /Samantha|Moira|Karen|Tessa|Fiona/i,
  /Google US English/i,
  /Aria|Jenny|Libby|Sonia|Hazel|Zira/i,
];

export interface SpeakOptions {
  rate?: number;
  mood?: string | null;
  title?: string | null;
  wait?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

const neuralPossible = () => typeof Worker !== 'undefined' && typeof WebAssembly !== 'undefined';

export const narrationSupported = () =>
  typeof window !== 'undefined' && ('speechSynthesis' in window || neuralPossible());

export function narratorVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = narratorVoices();
  const chosen = readLocal('narrator-voice');
  if (chosen) {
    const match = voices.find((v) => v.voiceURI === chosen);
    if (match) return match;
  }
  for (const pattern of PREFERRED) {
    const match = voices.find((v) => pattern.test(v.name));
    if (match) return match;
  }
  return voices.find((v) => v.localService) ?? voices[0] ?? null;
}

interface Clip {
  id: number;
  audio: Promise<VoiceClip>;
  done: boolean;
}

const clips = new Map<string, Clip>();
const keyOf = (segment: ReadingSegment, voice: string, rate: number) =>
  `${voice}|${(segment.speed * rate).toFixed(2)}|${segment.text}`;

function clipFor(segment: ReadingSegment, voice: string, rate: number): Promise<VoiceClip> {
  const key = keyOf(segment, voice, rate);
  const hit = clips.get(key);
  if (hit) {
    clips.delete(key);
    clips.set(key, hit);
    return hit.audio;
  }
  const job = synthesize(segment.text, voice, Math.round(segment.speed * rate * 100) / 100);
  const clip: Clip = { id: job.id, audio: job.audio, done: false };
  job.audio.then(
    () => {
      clip.done = true;
    },
    () => {
      if (clips.get(key) === clip) clips.delete(key);
    },
  );
  clips.set(key, clip);
  for (const [old, entry] of clips) {
    if (clips.size <= 24) break;
    if (entry.done) clips.delete(old);
  }
  return job.audio;
}

function keepOnly(keys: Set<string>) {
  const drop: number[] = [];
  for (const [key, clip] of clips) {
    if (clip.done || keys.has(key)) continue;
    drop.push(clip.id);
    clips.delete(key);
  }
  dropSynthesis(drop);
}

let session = 0;
let ended = -1;
let timer = 0;
let release = 0;

function finish(mine: number, onEnd?: () => void) {
  if (mine !== session) return;
  ended = mine;
  release = window.setTimeout(() => sound.duck(false), 1400);
  onEnd?.();
}

function speakDevice(text: string, options: SpeakOptions, mine: number) {
  if (!('speechSynthesis' in window)) {
    finish(mine, options.onEnd);
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const segments = planReading(text, { mood: options.mood, title: options.title });
  const voice = pickVoice();
  sound.duck(true);
  const next = (index: number) => {
    if (mine !== session) return;
    if (index >= segments.length) {
      finish(mine, options.onEnd);
      return;
    }
    const segment = segments[index]!;
    const utterance = new SpeechSynthesisUtterance(segment.text);
    if (voice) utterance.voice = voice;
    utterance.rate = (options.rate ?? 1) * segment.speed;
    utterance.pitch = 1.02;
    const advance = () => {
      timer = window.setTimeout(() => next(index + 1), segment.pause);
    };
    utterance.onend = advance;
    utterance.onerror = advance;
    if (index === 0 && options.onStart) {
      const started = options.onStart;
      utterance.onstart = () => {
        if (mine === session) started();
      };
    }
    synth.speak(utterance);
  };
  next(0);
}

async function speakNeural(text: string, options: SpeakOptions, mine: number) {
  const segments = planReading(text, { mood: options.mood, title: options.title });
  if (!segments.length) {
    finish(mine, options.onEnd);
    return;
  }
  try {
    await prepareNarrator();
  } catch {
    if (mine === session) speakDevice(text, options, mine);
    return;
  }
  if (mine !== session) return;
  sound.unlock();
  const voice = neuralVoice();
  const rate = options.rate ?? 1;
  const opening = options.title ? 1 : 0;
  if (segments[opening] && !clips.has(keyOf(segments[opening], voice, rate)))
    segments.splice(opening, 1, ...leadIn(segments[opening]));
  let cursor = 0;
  let started = false;
  try {
    for (let i = 0; i < segments.length; i += 1) {
      for (let ahead = i; ahead < Math.min(segments.length, i + 3); ahead += 1)
        clipFor(segments[ahead]!, voice, rate);
      const audio = await clipFor(segments[i]!, voice, rate);
      if (!started && options.title && i === 0 && segments[1])
        await clipFor(segments[1], voice, rate).catch(() => undefined);
      if (mine !== session) return;
      const at = Math.max(cursor, sound.clock + 0.06);
      const end = sound.playVoice(audio.samples, audio.rate, at);
      if (end === null) throw new Error('No audio output');
      if (!started) {
        sound.duck(true);
        const begin = options.onStart;
        if (begin)
          window.setTimeout(
            () => {
              if (mine === session) begin();
            },
            Math.max(0, (at - sound.clock) * 1000),
          );
      }
      started = true;
      cursor = end + segments[i]!.pause / 1000;
    }
  } catch {
    if (mine === session && !started) speakDevice(text, options, mine);
    else if (mine === session) finish(mine, options.onEnd);
    return;
  }
  const last = segments[segments.length - 1]!;
  const wait = Math.max(
    0,
    (cursor - last.pause / 1000 - sound.clock) * 1000 + Math.min(last.pause, 500),
  );
  timer = window.setTimeout(() => finish(mine, options.onEnd), wait);
}

const saveData = () =>
  Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData);

async function choose(text: string, options: SpeakOptions, mine: number) {
  const state = narratorState();
  const deviceVoice = 'speechSynthesis' in window;
  if (state.status === 'ready' || state.status === 'loading' || options.wait || !deviceVoice) {
    if (state.status === 'loading' && state.downloading && deviceVoice && !options.wait) {
      speakDevice(text, options, mine);
      return;
    }
    await speakNeural(text, options, mine);
    return;
  }
  const cached = await narratorCached();
  if (mine !== session) return;
  if (cached) {
    await speakNeural(text, options, mine);
    return;
  }
  if (!saveData()) prepareNarrator().catch(() => undefined);
  speakDevice(text, options, mine);
}

function halt() {
  session += 1;
  window.clearTimeout(timer);
  window.clearTimeout(release);
  sound.stopVoice();
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

export function speak(text: string, options: SpeakOptions = {}): () => void {
  if (typeof window === 'undefined') return () => undefined;
  halt();
  const mine = session;
  const neural = neuralWanted() && neuralPossible() && narratorState().status !== 'failed';
  if (neural) {
    const voice = neuralVoice();
    const rate = options.rate ?? 1;
    const plan = planReading(text, { mood: options.mood, title: options.title });
    keepOnly(new Set(plan.map((segment) => keyOf(segment, voice, rate))));
    void choose(text, options, mine);
  } else speakDevice(text, options, mine);
  return () => {
    if (mine === session && ended !== mine) stopSpeaking();
  };
}

export function prefetchSpeech(
  text: string,
  options: Pick<SpeakOptions, 'mood' | 'title' | 'rate'> = {},
) {
  const state = narratorState();
  const usable = state.status === 'ready' || (state.status === 'loading' && !state.downloading);
  if (!neuralWanted() || !usable) return;
  const voice = neuralVoice();
  for (const segment of planReading(text, options).slice(0, 2))
    clipFor(segment, voice, options.rate ?? 1);
}

export function stopSpeaking() {
  if (typeof window === 'undefined') return;
  halt();
  keepOnly(new Set());
  sound.duck(false);
}
