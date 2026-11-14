import {
  Angry,
  CloudRain,
  Frown,
  Hand,
  Heart,
  HelpCircle,
  Laugh,
  Leaf,
  Mic,
  Keyboard,
  PenLine,
  RotateCcw,
  Sparkles,
  Star,
  Sun,
  Snowflake,
  Flower2,
  Wind,
  Hourglass,
  CircleDashed,
  type LucideIcon,
} from 'lucide-react';
import type { Season } from '@living-draft/contracts';

export interface EmotionMeta {
  label: string;
  icon: LucideIcon;
  tint: string;
  ink: string;
}

export const EMOTIONS: Record<string, EmotionMeta> = {
  happy: { label: 'Happy', icon: Laugh, tint: 'rgb(251 191 36 / 0.18)', ink: '#fcd34d' },
  sad: { label: 'Sad', icon: CloudRain, tint: 'rgb(56 189 248 / 0.18)', ink: '#7dd3fc' },
  angry: { label: 'Angry', icon: Angry, tint: 'rgb(244 63 94 / 0.18)', ink: '#fda4af' },
  nostalgic: {
    label: 'Nostalgic',
    icon: Hourglass,
    tint: 'rgb(192 132 252 / 0.18)',
    ink: '#d8b4fe',
  },
  excited: { label: 'Excited', icon: Sparkles, tint: 'rgb(236 72 153 / 0.18)', ink: '#f9a8d4' },
  peaceful: { label: 'Peaceful', icon: Leaf, tint: 'rgb(45 212 191 / 0.18)', ink: '#5eead4' },
  anxious: { label: 'Anxious', icon: Wind, tint: 'rgb(129 140 248 / 0.18)', ink: '#a5b4fc' },
  proud: { label: 'Proud', icon: Star, tint: 'rgb(250 204 21 / 0.18)', ink: '#fde047' },
  grateful: { label: 'Grateful', icon: Heart, tint: 'rgb(251 113 133 / 0.18)', ink: '#fecdd3' },
  confused: {
    label: 'Confused',
    icon: HelpCircle,
    tint: 'rgb(148 163 184 / 0.18)',
    ink: '#cbd5e1',
  },
  disappointed: {
    label: 'Disappointed',
    icon: Frown,
    tint: 'rgb(161 161 170 / 0.18)',
    ink: '#d4d4d8',
  },
};

export const BASE_EMOTION_TAGS = Object.keys(EMOTIONS);

export function emotionMeta(tag: string): EmotionMeta {
  return (
    EMOTIONS[tag] ?? {
      label: tag.charAt(0).toUpperCase() + tag.slice(1),
      icon: Hand,
      tint: 'rgb(232 121 249 / 0.16)',
      ink: '#f0abfc',
    }
  );
}

export interface SeasonMeta {
  label: string;
  icon: LucideIcon;
  wash: [string, string];
  accent: string;
  particles:
    | 'petals'
    | 'fireflies'
    | 'leaves'
    | 'snow'
    | 'dust'
    | 'stars'
    | 'rain'
    | 'embers'
    | 'sparks'
    | 'bubbles';
}

export const SEASON_META: Record<Season, SeasonMeta> = {
  spring: {
    label: 'Spring',
    icon: Flower2,
    wash: ['#3b1d4a', '#123a37'],
    accent: '#f9a8d4',
    particles: 'petals',
  },
  summer: {
    label: 'Summer',
    icon: Sun,
    wash: ['#4a1d2e', '#3a2a0c'],
    accent: '#fdba74',
    particles: 'fireflies',
  },
  autumn: {
    label: 'Autumn',
    icon: Leaf,
    wash: ['#3d1a0c', '#2c1238'],
    accent: '#fb923c',
    particles: 'leaves',
  },
  winter: {
    label: 'Winter',
    icon: Snowflake,
    wash: ['#0c1f3d', '#1b1440'],
    accent: '#7dd3fc',
    particles: 'snow',
  },
};

export interface ConnectionMeta {
  color: string;
  dash: string;
  glyph: string;
}

export const CONNECTION_META: Record<string, ConnectionMeta> = {
  full_circle: { color: '#f472b6', dash: '0', glyph: '◯' },
  repeating_pattern: { color: '#38bdf8', dash: '10 6', glyph: '↻' },
  breaking_pattern: { color: '#a78bfa', dash: '2 6', glyph: '⤳' },
  wish_fulfilled: { color: '#fbbf24', dash: '0', glyph: '✦' },
  relationship_change: { color: '#34d399', dash: '14 5 3 5', glyph: '⇄' },
  shared_character: { color: '#cbd5e1', dash: '3 5', glyph: '•' },
  milestone: { color: '#fb923c', dash: '1 4', glyph: '⚑' },
};

export function connectionMeta(type: string): ConnectionMeta {
  return CONNECTION_META[type] ?? { color: '#c4b5fd', dash: '6 4', glyph: '∿' };
}

export const SOURCE_META: Record<string, { label: string; icon: LucideIcon }> = {
  speech: { label: 'Spoken', icon: Mic },
  typing: { label: 'Typed', icon: Keyboard },
  restore: { label: 'Restored', icon: RotateCcw },
  correction: { label: 'Correction', icon: PenLine },
  edit: { label: 'Edited', icon: PenLine },
};

export const CERTAINTY_META = {
  certain: { label: 'Placed', icon: Star },
  approximate: { label: 'Estimated', icon: CircleDashed },
  unplaced: { label: 'Not placed yet', icon: HelpCircle },
};

export const MODE_LABELS: Record<string, string> = {
  original: 'First telling',
  addition: 'Added details',
  retelling: 'Retold',
  correction: 'Corrected',
  edit: 'Wording edit',
  restore: 'Restored',
};

const PORTRAIT_TINTS = [
  '#8b5cf6',
  '#ec4899',
  '#0ea5e9',
  '#14b8a6',
  '#f59e0b',
  '#f43f5e',
  '#6366f1',
];

export function tintFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PORTRAIT_TINTS[hash % PORTRAIT_TINTS.length]!;
}

export function hashNumber(seed: string): number {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

export function initials(name: string): string {
  const parts = name
    .replace(/^(Mr|Mrs|Ms|Dr|Miss)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return parts.length === 1
    ? parts[0]!.slice(0, 2)
    : `${parts[0]![0]}${parts[parts.length - 1]![0]}`;
}
