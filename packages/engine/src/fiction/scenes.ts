import { TermIndex } from '../retrieval/index';
import { splitSentences } from '../text/sentences';

export interface StoryLinkTypeInfo {
  id: string;
  label: string;
  hint: string;
}

export const STORY_LINK_TYPES: StoryLinkTypeInfo[] = [
  {
    id: 'foreshadowing',
    label: 'Foreshadowing',
    hint: 'An early hint of something that pays off later.',
  },
  { id: 'callback', label: 'Callback', hint: 'A later scene that reaches back to an earlier one.' },
  { id: 'echo', label: 'Echo', hint: 'Two scenes that mirror each other in image or feeling.' },
  { id: 'parallel', label: 'Parallel', hint: 'Different characters going through the same thing.' },
  { id: 'cause', label: 'Cause and effect', hint: 'One scene sets up what happens in another.' },
  { id: 'reveal', label: 'Reveal', hint: 'A scene that answers a question another one raised.' },
  { id: 'continuity', label: 'Check continuity', hint: 'Two scenes that might not agree yet.' },
];

export function storyLinkLabel(id: string): string {
  return STORY_LINK_TYPES.find((t) => t.id === id)?.label ?? id.replace(/_/g, ' ');
}

const NOT_NAMES = new Set(
  `the a an and but or so if then when while after before because though although yet still just
  i i'm i'd i'll i've me my we our you your he she it they them their his her its this that these those
  there here what who whom whose which why how where yes no not now never always maybe perhaps
  mr mrs ms dr miss sir madam lord lady god oh ah well okay ok hey hello goodbye
  monday tuesday wednesday thursday friday saturday sunday
  january february march april may june july august september october november december
  spring summer autumn fall winter morning evening night today tomorrow yesterday
  chapter scene part prologue epilogue`.split(/\s+/),
);

export function suggestCharacterNames(text: string, known: string[], limit = 5): string[] {
  const knownKeys = new Set(known.map((name) => name.toLowerCase()));
  const counts = new Map<string, { surface: string; count: number; midSentence: boolean }>();
  for (const sentence of splitSentences(text)) {
    const words = [...sentence.text.matchAll(/[A-Z][a-z'’]+(?:\s+[A-Z][a-z'’]+)?/g)];
    for (const match of words) {
      let parts = match[0].split(/\s+/);
      let offset = match.index ?? 0;
      if (parts.length > 1 && NOT_NAMES.has(parts[0]!.toLowerCase())) {
        offset += parts[0]!.length + 1;
        parts = parts.slice(1);
      }
      const surface = parts.join(' ').replace(/['’]s$/, '');
      const first = parts[0]!.toLowerCase();
      if (NOT_NAMES.has(first) || surface.length < 3) continue;
      const key = surface.toLowerCase();
      if (knownKeys.has(key) || [...knownKeys].some((k) => k.split(/\s+/)[0] === first)) continue;
      const atStart = offset === sentence.text.search(/\S/);
      const entry = counts.get(key) ?? { surface, count: 0, midSentence: false };
      entry.count += 1;
      if (!atStart) entry.midSentence = true;
      counts.set(key, entry);
    }
  }
  return [...counts.values()]
    .filter((entry) => entry.midSentence || entry.count >= 2)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((entry) => entry.surface);
}

export interface SceneForEchoes {
  id: string;
  title: string;
  text: string;
  order: number | null;
}

export interface EchoSuggestion {
  sceneId: string;
  title: string;
  type: 'foreshadowing' | 'callback' | 'echo';
  shared: string[];
  score: number;
}

export function suggestEchoes(
  scene: SceneForEchoes,
  others: SceneForEchoes[],
  limit = 3,
): EchoSuggestion[] {
  const pool = others.filter((o) => o.id !== scene.id && o.text.trim());
  if (!pool.length) return [];
  const index = new TermIndex(pool.map((o) => ({ id: o.id, text: `${o.title} ${o.text}` })));
  const byId = new Map(pool.map((o) => [o.id, o]));
  return index
    .search(`${scene.title} ${scene.text}`, limit * 3)
    .filter((hit) => hit.score >= 0.1 && hit.shared.length >= 2)
    .slice(0, limit)
    .map((hit) => {
      const other = byId.get(hit.id)!;
      const type: EchoSuggestion['type'] =
        scene.order === null || other.order === null || scene.order === other.order
          ? 'echo'
          : other.order < scene.order
            ? 'callback'
            : 'foreshadowing';
      return {
        sceneId: other.id,
        title: other.title,
        type,
        shared: hit.shared.slice(0, 4),
        score: Number(hit.score.toFixed(3)),
      };
    });
}
