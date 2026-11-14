import { collectionRecap } from '@living-draft/engine';
import { Archive } from '../archive/snapshot';

export function recapFor(
  focusPeople: string[],

  label: string,
  memoryIds: string[],
  includeQuiet: boolean,
): { lines: string[] } {
  const archive = Archive.load();
  const wanted = new Set(memoryIds);
  const cards = archive.cards().filter((card) => wanted.has(card.id));
  const counted = new Set<string>();
  for (const card of cards) {
    for (const connection of archive.connectionsFor(card.id)) {
      if (connection.status === 'confirmed') counted.add(connection.id);
    }
  }
  return {
    lines: collectionRecap({
      label,
      memories: cards.map((card) => ({
        title: card.title,
        ages: card.temporal.placedAges,
        season: card.temporal.season,
        approximate: card.temporal.certainty !== 'certain',
        people: card.people.map((p) => p.name),
        feelingsThen: card.emotions.filter((e) => e.phase === 'then').map((e) => e.tag),
        feelingsNow: card.emotions.filter((e) => e.phase === 'now').map((e) => e.tag),
        sensitive: card.sensitive,
      })),
      connectionCount: counted.size,
      includeQuiet,
      focusPeople,
    }),
  };
}
